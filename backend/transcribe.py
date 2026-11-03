# speech to text for the voice screens. whisper through transformers, on modal's gpu (or the cpu locally)
import os
import subprocess
import tempfile

MODEL = os.environ.get("WHISPER_MODEL", "openai/whisper-large-v3-turbo")
MAX_SECONDS = 180


def load(model_id=MODEL, device="cuda"):
    import torch
    from transformers import pipeline

    return pipeline(
        "automatic-speech-recognition",
        model=model_id,
        dtype=torch.float16 if device == "cuda" else torch.float32,
        device=device,
    )


def decode(audio, rate=16000):
    # the phone sends m4a/aac, browsers send webm/opus. ffmpeg turns either into 16khz mono floats.
    # it goes through a temp file because m4a keeps its index at the end, which ffmpeg can't read from a pipe.
    # the file is closed before ffmpeg opens it: windows won't let another program read a file python still has open
    import numpy as np

    f = tempfile.NamedTemporaryFile(suffix=".m4a", delete=False)
    try:
        f.write(audio)
        f.close()
        try:
            out = subprocess.run(
                ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", f.name, "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"],
                capture_output=True, timeout=60,
            )
        except FileNotFoundError:
            raise RuntimeError("ffmpeg isn't installed")
    finally:
        try:
            os.unlink(f.name)
        except OSError:
            pass
    samples = np.frombuffer(out.stdout, np.float32)
    if out.returncode != 0 or samples.size == 0:
        print("ffmpeg couldn't read the recording:", out.stderr.decode(errors="replace").strip()[-300:])
        raise ValueError("That recording couldn't be read. Try again.")
    return samples


def run(asr, audio):
    samples = decode(audio)
    seconds = len(samples) / 16000
    if seconds < 0.3:
        raise ValueError("That was too short to hear anything.")
    if seconds > MAX_SECONDS:
        raise ValueError(f"Keep it under {MAX_SECONDS // 60} minutes.")

    # over 30s whisper needs timestamps to run its own long-form decoding
    out = asr({"raw": samples, "sampling_rate": 16000}, task="transcribe", return_timestamps=seconds > 30)
    return {"text": " ".join(out["text"].split()), "seconds": round(seconds, 1)}
