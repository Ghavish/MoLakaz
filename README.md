# MoLakaz

An AI household chore manager that fairly splits chores around each family member's schedule and confirms them with a quick photo.

The person who runs the home sets up the household once (people, how much free time each has per day, the chores). MoLakaz shares the chores out so everyone gives up the same *share of their free time*, not the same number of chores. When a chore's done you snap a before and after photo, and SAM 3.1 checks the mess is actually gone.

*Mo lakaz* = "my home" in Kreol Morisien.

```
mobile/   Expo (SDK 58) app, expo-router
backend/  Python, deployed on Modal
```

## How it uses Modal

| What | Where |
|---|---|
| SAM 3.1 on an L4 GPU segments the before/after photos and compares them | `Verifier` class in `backend/modal_app.py`, logic in `backend/verify.py` |
| Whisper (large-v3-turbo) on a T4 writes out what you say on the voice screens | `Transcriber` class in `modal_app.py`, logic in `backend/transcribe.py`, route `POST /transcribe` |
| FastAPI web endpoint, the backend between the app and Muse Spark | `web` in `modal_app.py`, routes in `backend/api.py` |
| 6:30am cron: plans the new week on Mondays, carries over missed chores, sends reminders | `morning` → `backend/jobs.py` |
| 7pm cron: nudges anyone with chores still not done | `evening` |
| `modal.Dict` for households, `modal.Volume` for photos and cached model weights | `backend/store.py` |

When someone uploads the before photo, the backend spawns a warm-up call so the GPU is ready by the time they're done cleaning.

## How the photo check works

Every chore has a check, e.g. dishes:

```json
{ "mode": "clear", "look_for": ["dirty dish", "cup", "pan"], "spot": "sink" }
```

SAM 3.1 segments every `look_for` thing in both photos. `clear` chores pass when the count drops to zero, or most of the masked area is gone. `show` chores (fold laundry, cook dinner) pass when the thing appears in the after photo. If the `spot` (sink) shows up in the before photo but not the after, it asks for a retake from the same place. You get the photos back with what SAM found painted red/green. The household admin can always approve a chore by hand.

Weights: `unsloth/sam3.1`, which is SAM 3.1 converted to transformers' `Sam3Model` format (not gated). Meta's official `facebook/sam3.1` repo only ships the video multiplex checkpoint with no transformers support. To use Meta's official SAM 3 image model instead, deploy with `SAM_MODEL=facebook/sam3` and an `HF_TOKEN` that has access.

## How the fair split works

`backend/planner.py`:

1. Each chore becomes N slots spread across the week (3x a week → Mon/Wed/Fri style).
2. Biggest jobs first, each slot goes to whoever ends up with the lowest *(chore minutes × effort) / free minutes this week*, and only if they have the time free that day and are old enough. Small nudges: rotate who gets what (last week counts too), avoid dislikes, don't drift more than 2 days, never the same chore twice on one day.
3. Fairness score = Jain's index over everyone's load/free-time ratio. 100% means everyone gives up the same share of their free time.

Muse Spark then gets the household, the notes ("John has exams Thursday"), last week's record and the draft, and suggests moves plus a short note for each person. Its moves are only kept if they don't make the week less fair or push anyone past their free time. With no key set, the fair-share plan is used as is.

Muse Spark also reads a plain-English description of the household on setup ("Mum works 8-5, Sara is 9...") and fills in people, free time, chores and photo checks. For chores MoLakaz doesn't know, it guesses the time and what to photograph.

Rebalancing: "Busy today?" moves your chores for the day to whoever's free. "Can't do it today" hands a single chore off. Missed daily chores get dropped, missed weekly ones roll over. Load evens back out over the rest of the week.

The Assistant tab (`backend/assistant.py`, `POST /households/{id}/assistant`) sends Muse Spark the week and your message. It answers questions straight from the plan, and for changes it replies with actions (move, swap, add a planner note, busy today). Every action is checked against the planner's rules before anything moves: only chores still to do, no past days, old enough, free time that day, nobody pushed past their free time, and fairness can't drop more than 15 points. The reply comes back with a summary card and an Undo for your latest change.

## Running it

### Backend on Modal

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # mac/linux: source .venv/bin/activate
pip install -r requirements.txt
modal setup                     # log in once
```

Muse Spark key: the hackathon's Baseten key for Muse Spark Open (`meta-models/muse-spark-open-1026` at `https://inference.baseten.co/v1`, both the defaults in `backend/muse.py`). Put it in `backend/.env` (copy `backend/.env.example`; the file is never committed), then check it works with `python try_muse.py`. The local backend and `modal deploy` both read that file, and a key set in your terminal wins over it:

```bash
cp .env.example .env            # then fill in MODEL_API_KEY
modal deploy modal_app.py
```

The deploy prints the URL, something like `https://<workspace>--molakaz-web.modal.run`.

Try the photo check on your own pictures (saves `before_marked.jpg` / `after_marked.jpg`):

```bash
modal run modal_app.py --before sink_before.jpg --after sink_after.jpg --chore dishes
```

The first run downloads the weights into a volume, so it's slow once.

### Backend locally, no Modal

Everything except the SAM check works. Photo checks get waved through. Voice needs Modal too, unless you `pip install torch transformers` and have ffmpeg, in which case it runs a small Whisper (`openai/whisper-base`, change with `WHISPER_MODEL`) on your CPU.

```bash
cd backend
MOLAKAZ_LOCAL=1 uvicorn api:web --host 0.0.0.0 --port 8000      # powershell: $env:MOLAKAZ_LOCAL="1"; uvicorn ...
python try_planner.py                                           # planner sanity check with a made-up family
```

### Demo household

`python seed_demo.py` (local) or `modal run modal_app.py::seed` (Modal) loads Mum, Dad, John and Sara half way through the week: chores done, one in progress, a photo result, one waiting for approval, Muse Spark's notes and last week saved. Run it again any time to reset. In the app, join with the code `DEMO26` and pick John (or Mum for approvals).

### App

```bash
cd mobile
npm install
cp .env.example .env            # set EXPO_PUBLIC_API_URL to your modal url
npx expo start
```

Scan the QR code with Expo Go (needs a version that supports SDK 58), or press `w` for web. Push reminders need a development build and an EAS project id (`npx eas-cli init`), since Expo Go can't get push tokens.

## Limits

- No real accounts: a household has a 6 letter join code and you pick who you are. Fine for a demo, not for production.
- One web container on purpose, so the Dict and photo volume stay consistent.
- Crons run on Mauritius time.
