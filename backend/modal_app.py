import os

import modal

app = modal.App("molakaz")

# sam 3.1 weights converted to the transformers Sam3Model format (not gated).
# set SAM_MODEL=facebook/sam3 when you deploy to use meta's official sam 3 instead (needs HF_TOKEN)
SAM_MODEL = os.environ.get("SAM_MODEL", "unsloth/sam3.1")


def env_secret(*names):
    # takes keys from your shell when you deploy, skips any you haven't set
    return modal.Secret.from_dict({n: os.environ[n] for n in names if os.environ.get(n)})


web_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi[standard]", "openai", "httpx", "pillow", "tzdata")
    .add_local_python_source("api", "chores", "jobs", "muse", "planner", "store")
)

sam_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("torch", "torchvision", "transformers>=5", "accelerate", "pillow", "numpy")
    .env({"HF_HOME": "/cache", "SAM_MODEL": SAM_MODEL})
    .add_local_python_source("verify")
)

# speech to text for the voice screens
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "openai/whisper-large-v3-turbo")

whisper_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("torch", "transformers>=5", "accelerate", "numpy")
    .env({"HF_HOME": "/cache", "WHISPER_MODEL": WHISPER_MODEL})
    .add_local_python_source("transcribe")
)

weights = modal.Volume.from_name("molakaz-weights", create_if_missing=True)
photos = modal.Volume.from_name("molakaz-photos", create_if_missing=True)
muse_keys = env_secret("MODEL_API_KEY", "MUSE_MODEL", "MUSE_BASE_URL")


@app.cls(gpu="L4", image=sam_image, volumes={"/cache": weights}, secrets=[env_secret("HF_TOKEN")],
         scaledown_window=300, timeout=600)
class Verifier:
    @modal.enter()
    def load(self):
        from transformers import Sam3Model, Sam3Processor

        self.model = Sam3Model.from_pretrained(SAM_MODEL).to("cuda").eval()
        self.processor = Sam3Processor.from_pretrained(SAM_MODEL)
        weights.commit()  # keep the download around for the next cold start

    @modal.method()
    def warm(self):
        return True

    @modal.method()
    def check(self, before, after, check):
        import verify

        return verify.run(self.model, self.processor, before, after, check)


@app.cls(gpu="T4", image=whisper_image, volumes={"/cache": weights}, scaledown_window=300, timeout=300)
class Transcriber:
    @modal.enter()
    def load(self):
        import transcribe

        self.asr = transcribe.load(WHISPER_MODEL, "cuda")
        weights.commit()

    @modal.method()
    def warm(self):
        return True

    @modal.method()
    def transcribe(self, audio):
        import transcribe

        return transcribe.run(self.asr, audio)


# one web container so the dict and the photo volume never disagree with themselves
@app.function(image=web_image, volumes={"/photos": photos}, secrets=[muse_keys], max_containers=1, timeout=300)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    import api

    api.hooks["verify"] = lambda before, after, check: Verifier().check.remote(before, after, check)
    api.hooks["warm"] = lambda: Verifier().warm.spawn()
    api.hooks["saved"] = photos.commit
    api.hooks["transcribe"] = lambda audio: Transcriber().transcribe.remote(audio)
    api.hooks["warm_ears"] = lambda: Transcriber().warm.spawn()
    return api.web


# 6:30 every morning: plan the new week on mondays, otherwise carry over missed chores, then remind everyone
@app.function(image=web_image, secrets=[muse_keys], timeout=900,
              schedule=modal.Cron("30 6 * * *", timezone="Indian/Mauritius"))
def morning():
    import jobs

    jobs.morning()


# 7pm nudge for anything still not done today
@app.function(image=web_image, timeout=300, schedule=modal.Cron("0 19 * * *", timezone="Indian/Mauritius"))
def evening():
    import jobs

    jobs.evening()


# try the photo check on your own pictures:
# modal run modal_app.py --before before.jpg --after after.jpg --chore dishes
@app.local_entrypoint()
def try_photos(before: str, after: str, chore: str = "dishes"):
    import chores

    check = chores.TEMPLATES[chore]["check"]
    print("looking for", check["look_for"], "at the", check["spot"] or "(anywhere)")
    res = Verifier().check.remote(open(before, "rb").read(), open(after, "rb").read(), check)
    for kind in ("before", "after"):
        with open(f"{kind}_marked.jpg", "wb") as f:
            f.write(res.pop(kind + "_marked"))
    print(res["verdict"].upper(), "-", res["reason"])
    print(res)
    print("saved before_marked.jpg and after_marked.jpg")
