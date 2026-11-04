import io
import os
import random
import time
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import envfile

envfile.load()  # backend/.env, before anything reads the keys

import assistant  # noqa: E402
import chores as chore_lib  # noqa: E402
import muse  # noqa: E402
import planner  # noqa: E402
import store  # noqa: E402

web = FastAPI(title="MoLakaz")
web.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# modal_app.py plugs the gpu calls in here. running locally they stay None
hooks = {"verify": None, "warm": None, "saved": None, "reload": None, "transcribe": None, "warm_ears": None}

# whisper on the cpu when running locally without modal, loaded the first time someone talks
_local_asr = None


class NewHousehold(BaseModel):
    name: str
    your_name: str
    tz: str = planner.TZ


class Setup(BaseModel):
    member_id: str
    members: list[dict]
    chores: list[dict]
    notes: str = ""


class Who(BaseModel):
    member_id: str


class Away(BaseModel):
    member_id: str
    day: int


class Text(BaseModel):
    text: str


class Chat(BaseModel):
    member_id: str
    text: str
    history: list[dict] = []


class UndoChange(BaseModel):
    member_id: str
    change_id: str


class PushToken(BaseModel):
    member_id: str
    token: str


def load(hid):
    hh = store.get("hh:" + hid)
    if not hh:
        raise HTTPException(404, "Household not found")
    # first visit of a new week rolls the plan over (the morning job usually gets there first)
    if hh.get("chores") and hh.get("week") != planner.week_start(hh["tz"]):
        planner.new_week(hh)
        save(hh)
    return hh


def save(hh):
    store.put("hh:" + hh["id"], hh)


def member(hh, mid, admin=False):
    for m in hh["members"]:
        if m["id"] == mid:
            if admin and not m.get("admin"):
                raise HTTPException(403, "Only the household admin can do that")
            return m
    raise HTTPException(404, "You're not in this household anymore")


def task(hh, tid):
    for t in hh["tasks"]:
        if t["id"] == tid:
            return t
    raise HTTPException(404, "That chore isn't in this week's plan anymore")


def view(hh):
    out = dict(hh)
    out.pop("undo", None)  # undo snapshots stay on the server
    out["members"] = [{k: v for k, v in m.items() if k != "push"} for m in hh["members"]]
    out["today"] = planner.today_index(hh["tz"])
    out["board"] = planner.board(hh)
    out["fairness"] = planner.fairness(hh, hh.get("tasks", []))
    out["ai"] = muse.ready()
    return out


def new_code():
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(random.choices(letters, k=6))
        if not store.get("code:" + code):
            return code


def keep_photo(name, data):
    from PIL import Image, ImageOps

    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        raise HTTPException(400, "That doesn't look like a photo")
    img.thumbnail((1280, 1280))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    jpg = buf.getvalue()
    (store.PHOTOS / name).write_bytes(jpg)
    return jpg


def saved():
    if hooks["saved"]:
        hooks["saved"]()


def photo_url(name):
    return f"/photos/{name}?v={int(time.time())}"


@web.get("/")
def health():
    return {"ok": True, "app": "molakaz", "ai": muse.ready(), "gpu": hooks["verify"] is not None}


@web.post("/households")
def create_household(body: NewHousehold):
    try:
        ZoneInfo(body.tz)
        tz = body.tz
    except Exception:
        tz = planner.TZ
    me = planner.clean_member({"name": body.your_name, "admin": True, "color": 0})
    hh = {
        "id": planner.new_id("h"),
        "name": body.name.strip()[:40] or "Our home",
        "code": new_code(),
        "tz": tz,
        "members": [me],
        "chores": [],
        "tasks": [],
        "notes": "",
        "week": planner.week_start(tz),
        "history": {},
        "created": time.time(),
    }
    save(hh)
    store.put("code:" + hh["code"], hh["id"])
    store.put("index", (store.get("index") or []) + [hh["id"]])
    return {"household": view(hh), "me": me["id"]}


@web.get("/join/{code}")
def join(code: str):
    hid = store.get("code:" + code.strip().upper())
    if not hid:
        raise HTTPException(404, "No household with that code")
    return view(load(hid))


@web.get("/households/{hid}")
def get_household(hid: str):
    return view(load(hid))


@web.put("/households/{hid}/setup")
def setup(hid: str, body: Setup):
    hh = load(hid)
    member(hh, body.member_id, admin=True)

    chores = [chore_lib.clean(c) for c in body.chores if str(c.get("name") or "").strip()]
    names = {c["name"].lower(): c["id"] for c in chores}
    old = {m["id"]: m for m in hh["members"]}
    members = [planner.clean_member(m, old.get(m.get("id")), names)
               for m in body.members if str(m.get("name") or "").strip()]

    if len(members) > planner.MAX_MEMBERS:
        raise HTTPException(400, f"A household can have up to {planner.MAX_MEMBERS} people")
    planner.assign_colors(members)
    if not any(m["id"] == body.member_id for m in members):
        raise HTTPException(400, "You can't take yourself out of the household")
    for m in members:
        if m["id"] == body.member_id:
            m["admin"] = True

    hh["members"] = members
    hh["chores"] = chores
    hh["notes"] = body.notes[:1000]
    planner.plan(hh, ai=True)
    save(hh)
    return view(hh)


@web.post("/households/{hid}/plan")
def replan(hid: str, body: Who):
    hh = load(hid)
    member(hh, body.member_id, admin=True)
    planner.plan(hh, ai=True)
    save(hh)
    return view(hh)


@web.post("/households/{hid}/rebalance")
def rebalance(hid: str, body: Who):
    hh = load(hid)
    member(hh, body.member_id)
    planner.rebalance(hh)
    save(hh)
    return view(hh)


@web.post("/households/{hid}/away")
def away(hid: str, body: Away):
    hh = load(hid)
    m = member(hh, body.member_id)
    days = set(m.get("away", []))
    days ^= {planner.clamp(body.day, 0, 6)}  # toggle
    m["away"] = sorted(days)
    planner.rebalance(hh)
    save(hh)
    return view(hh)


@web.post("/households/{hid}/tasks/{tid}/skip")
def skip(hid: str, tid: str, body: Who):
    hh = load(hid)
    member(hh, body.member_id)
    t = task(hh, tid)
    if t["status"] == "done":
        raise HTTPException(400, "That one's already done")
    # can't do it today, hand it to someone else and even it out later in the week
    t["not"] = sorted(set(t.get("not", [])) | {body.member_id})
    t["status"] = "todo"
    planner.rebalance(hh)
    save(hh)
    return view(hh)


@web.post("/households/{hid}/tasks/{tid}/before")
def before_photo(hid: str, tid: str, member_id: str = Form(...), photo: UploadFile = File(...)):
    hh = load(hid)
    member(hh, member_id)
    t = task(hh, tid)
    name = f"{hid}_{tid}_before.jpg"
    keep_photo(name, photo.file.read())
    saved()
    t.update({"status": "started", "before": photo_url(name), "after": None, "check": None, "by": member_id})
    save(hh)

    # start the gpu up while they're cleaning, so the after photo check is quick
    if hooks["warm"]:
        try:
            hooks["warm"]()
        except Exception as e:
            print("warmup failed:", e)
    return view(hh)


@web.post("/households/{hid}/tasks/{tid}/after")
def after_photo(hid: str, tid: str, member_id: str = Form(...), photo: UploadFile = File(...)):
    hh = load(hid)
    member(hh, member_id)
    t = task(hh, tid)
    chore = next((c for c in hh["chores"] if c["id"] == t["chore"]), None)
    before_file = store.PHOTOS / f"{hid}_{tid}_before.jpg"
    if not t.get("before") or not before_file.exists():
        raise HTTPException(400, "Take the before photo first")

    name = f"{hid}_{tid}_after.jpg"
    after_jpg = keep_photo(name, photo.file.read())
    check = chore["check"] if chore else {"mode": "clear", "look_for": ["mess"], "spot": ""}

    if hooks["verify"]:
        try:
            res = hooks["verify"](before_file.read_bytes(), after_jpg, check)
        except Exception as e:
            print("verify failed:", e)
            raise HTTPException(502, "Couldn't check the photos right now, try again in a minute")
    else:
        res = {"verdict": "done", "mode": check["mode"], "look_for": check["look_for"], "spot": check["spot"],
               "reason": "Local mode: SAM only runs on Modal, so this one was waved through."}

    for kind in ("before", "after"):
        marked = res.pop(kind + "_marked", None)
        if marked:
            n = f"{hid}_{tid}_{kind}_marked.jpg"
            (store.PHOTOS / n).write_bytes(marked)
            res[kind + "_marked"] = photo_url(n)
    saved()

    # sam can take a while on a cold start, so reload before saving so we don't stomp on other changes
    hh = load(hid)
    t = task(hh, tid)
    t["after"] = photo_url(name)
    t["check"] = res
    if res["verdict"] == "done":
        t["status"] = "done"
        t["done_at"] = time.time()
        t["by"] = member_id
    else:
        t["status"] = "retry"
    save(hh)
    return {"household": view(hh), "check": res}


@web.post("/households/{hid}/tasks/{tid}/approve")
def approve(hid: str, tid: str, body: Who):
    hh = load(hid)
    boss = member(hh, body.member_id, admin=True)
    t = task(hh, tid)
    t["status"] = "done"
    t["done_at"] = time.time()
    t["check"] = {**(t.get("check") or {}), "verdict": "done", "manual": True,
                  "reason": f"Approved by {boss['name']}"}
    save(hh)
    return view(hh)


@web.post("/households/{hid}/push")
def push_token(hid: str, body: PushToken):
    hh = load(hid)
    m = member(hh, body.member_id)
    m["push"] = body.token
    save(hh)
    return {"ok": True}


@web.get("/households/{hid}/weeks/{week}")
def get_week(hid: str, week: str):
    hh = load(hid)
    if week == hh.get("week"):
        return planner.week_snapshot(hh, "current")
    if week == planner.next_week_start(hh["tz"]):
        return planner.preview_next(hh) if hh.get("chores") else {**planner.week_snapshot({**hh, "tasks": []}, "next"), "week": week}
    saved = store.get(f"week:{hid}:{week}")
    if not saved:
        raise HTTPException(404, "That week isn't saved")
    return saved


@web.post("/households/{hid}/assistant")
def assistant_chat(hid: str, body: Chat):
    hh = load(hid)
    member(hh, body.member_id)
    text = body.text.strip()[:1000]
    if not text:
        raise HTTPException(400, "Say something first")
    if not muse.ready():
        return {"reply": "I need Muse Spark to answer, and it isn't switched on for this server yet (MODEL_API_KEY). "
                         "You can still hand chores off from Today.", "changes": None, "household": view(hh)}
    try:
        out = assistant.ask(hh, body.member_id, text, body.history)
    except Exception as e:
        print("assistant failed:", e)
        raise HTTPException(502, "The assistant couldn't answer right now. Try again in a moment.")

    # muse can take a few seconds, so apply its actions to a fresh copy and don't stomp on other changes
    hh = load(hid)
    member(hh, body.member_id)
    changes, refused = assistant.apply(hh, body.member_id, out["actions"])
    if changes:
        save(hh)
    reply = assistant.explain_refusal(out["reply"], refused, bool(changes))
    return {"reply": reply, "changes": changes, "household": view(hh)}


@web.post("/households/{hid}/assistant/undo")
def assistant_undo(hid: str, body: UndoChange):
    hh = load(hid)
    member(hh, body.member_id)
    problem = assistant.undo(hh, body.member_id, body.change_id)
    if problem:
        raise HTTPException(409, problem)
    save(hh)
    return view(hh)


@web.post("/ai/setup")
def ai_setup(body: Text):
    if not muse.ready():
        raise HTTPException(503, "Muse Spark isn't set up on the server yet (MODEL_API_KEY)")
    try:
        return muse.read_household(body.text)
    except Exception as e:
        print("muse spark setup failed:", e)
        raise HTTPException(502, "Muse Spark couldn't make sense of that, try saying it another way")


@web.post("/ai/chore")
def ai_chore(body: Text):
    return chore_lib.suggest(body.text)


@web.post("/transcribe")
def transcribe_audio(audio: UploadFile = File(...)):
    global _local_asr
    data = audio.file.read()
    if not data:
        raise HTTPException(400, "The recording was empty")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "That recording is too long")

    try:
        if hooks["transcribe"]:
            res = hooks["transcribe"](data)
        else:
            try:
                import transcribe
                if _local_asr is None:
                    _local_asr = transcribe.load(os.environ.get("WHISPER_MODEL", "openai/whisper-base"), "cpu")
                res = transcribe.run(_local_asr, data)
            except ImportError:
                raise HTTPException(503, "Voice needs the Modal backend, or requirements-voice.txt and ffmpeg "
                                         "to run it on this laptop. You can type instead.")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        print("transcribe failed:", e)
        raise HTTPException(502, "Couldn't write that out right now. Try again, or type it.")

    if not res.get("text"):
        raise HTTPException(422, "Didn't catch anything. Try again a bit closer to the phone.")
    return res


# the voice screen calls this when it opens, so whisper is awake by the time they stop talking
@web.post("/transcribe/warm")
def transcribe_warm():
    if hooks["warm_ears"]:
        try:
            hooks["warm_ears"]()
        except Exception as e:
            print("whisper warmup failed:", e)
    return {"ok": True}


@web.get("/photos/{name}")
def photo(name: str):
    path = store.PHOTOS / Path(name).name
    if not path.exists() and hooks["reload"]:
        # written by another container (like the demo seed), so pick up the latest volume
        try:
            hooks["reload"]()
        except Exception as e:
            print("photo reload failed:", e)
    if not path.exists():
        raise HTTPException(404, "No such photo")
    return FileResponse(path, media_type="image/jpeg")
