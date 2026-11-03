import json
import os
import re

# muse spark open, served by baseten for the hackathon. it speaks the openai format.
# the hackathon key only works with exactly this model name
BASE_URL = os.environ.get("MUSE_BASE_URL", "https://inference.baseten.co/v1")
MODEL = os.environ.get("MUSE_MODEL", "meta-models/muse-spark-open-1026")


def ready():
    return bool(os.environ.get("MODEL_API_KEY"))


def ask(rules, payload):
    from openai import OpenAI

    client = OpenAI(base_url=BASE_URL, api_key=os.environ["MODEL_API_KEY"], timeout=90, max_retries=1)
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": rules},
            {"role": "user", "content": payload if isinstance(payload, str) else json.dumps(payload)},
        ],
    )
    return read_json(resp.choices[0].message.content or "")


def read_json(text):
    # open-weights models can think out loud first, so drop any <think> block before looking for the json
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    text = text.split("</think>")[-1]
    # it sometimes wraps the json in ``` fences or adds a sentence, just grab the object
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no json in muse spark reply: " + text[:200])
    return json.loads(text[start:end + 1])


PLAN_RULES = """You are the planner inside MoLakaz, a household chore app used by families in Mauritius.
You get a household, its chores for the week, and a draft plan made by a fair-share algorithm.
Improve the draft only where it actually helps the family:
- respect the notes (exams, work shifts, sport, who's away), dislikes and each person's free minutes per day
- fair means chore time is proportional to free time, not equal. kids get lighter, age-appropriate chores
- spread the same chore around instead of giving it to one person every day, unless the notes say otherwise
- only move tasks that aren't locked, and never to a day before day TODAY. days are 0=Mon ... 6=Sun
Reply with JSON only, nothing else:
{"moves": [{"task": "<task id>", "member": "<member id>", "day": 0}],
 "messages": {"<member id>": "one short, warm line about their week, mention why if you moved something for them"},
 "summary": "one sentence on how the week was split"}
Leave "moves" empty if the draft is already good."""


def improve(hh, today):
    import planner

    chores = {c["id"]: c for c in hh["chores"]}
    people = {m["id"]: m for m in hh["members"]}
    movable = {t["id"] for t in hh["tasks"] if t["status"] == "todo" and t["day"] >= today}
    if not movable:
        return False

    payload = {
        "today": today,
        "notes": hh.get("notes", ""),
        "people": [{
            "id": m["id"],
            "name": m["name"],
            "age": m["age"],
            "free_minutes": dict(zip(planner.DAYS, m["free"])),
            "away_days": m.get("away", []),
            "dislikes": [chores[d]["name"] for d in m.get("dislikes", []) if d in chores],
        } for m in hh["members"]],
        "chores": [{k: c[k] for k in ("id", "name", "minutes", "effort", "min_age")} for c in hh["chores"]],
        "draft": [{"task": t["id"], "chore": t["chore"], "member": t["member"], "day": t["day"],
                   "locked": t["id"] not in movable} for t in hh["tasks"]],
        "last_week": hh.get("last_week", {}),
    }
    reply = ask(PLAN_RULES.replace("TODAY", str(today)), payload)

    tasks = [dict(t) for t in hh["tasks"]]
    by_id = {t["id"]: t for t in tasks}
    for mv in reply.get("moves") or []:
        t = by_id.get(str(mv.get("task")))
        m = people.get(str(mv.get("member")))
        if not t or not m or t["id"] not in movable:
            continue
        day = planner.clamp(mv.get("day", t["day"]), 0, 6)
        if day < today or not planner.can_do(m, chores[t["chore"]], t) or planner.free_on(m, day) == 0:
            continue
        t["member"], t["day"] = m["id"], day

    # muse gets the final say on the details, but it can't make the week less fair
    before = planner.fairness(hh, hh["tasks"])
    after = planner.fairness(hh, tasks)
    if after < before - 0.05 or planner.overflow(hh, tasks) > planner.overflow(hh, hh["tasks"]):
        print(f"muse spark plan rejected, fairness {before} -> {after}")
        return False

    hh["tasks"] = tasks
    hh["messages"] = {k: str(v)[:240] for k, v in (reply.get("messages") or {}).items() if k in people}
    hh["summary"] = str(reply.get("summary") or "")[:300]
    hh["plan_by"] = "muse-spark"
    return True


SETUP_RULES = """Turn a family's description of their household into JSON for a chore app.
People: name, age (guess 35 for an adult if not said), and free minutes for chores on each day Mon..Sun as 7 numbers.
Think about work, school and shifts: someone working 9-5 has about 30-45 on weekdays and 90-150 on weekends, a kid has 15-30 on school days.
Chores: name, minutes per go, effort 1-3, times per week (1-7), min_age, and how a photo can prove it's done:
  check.mode "clear" when stuff should be gone afterwards (dishes, clutter, trash) or "show" when something should appear (folded clothes, cooked food)
  check.look_for: 1-3 short noun phrases a segmentation model can find in a photo, like "dirty dish", "toy", "folded clothes"
  check.spot: one object that's in both the before and after photo so we know it's the same place, like "sink" or "sofa", or "" if there isn't one
If they don't list chores, pick the usual ones for a home like theirs.
Reply with JSON only:
{"members": [{"name": "", "age": 0, "free": [0, 0, 0, 0, 0, 0, 0], "dislikes": ["chore name"]}],
 "chores": [{"name": "", "minutes": 0, "effort": 1, "per_week": 1, "min_age": 0, "check": {"mode": "clear", "look_for": [""], "spot": ""}}],
 "notes": "anything else the weekly planner should know, like exams or shifts"}"""


def read_household(text):
    import chores as chore_lib
    import planner

    reply = ask(SETUP_RULES, text[:3000])
    chores = [chore_lib.clean(c) for c in reply.get("chores") or [] if isinstance(c, dict) and c.get("name")]
    names = {c["name"].lower(): c["id"] for c in chores}
    members = [planner.clean_member(m, None, names) for m in reply.get("members") or []
               if isinstance(m, dict) and m.get("name")]
    return {"members": members, "chores": chores, "notes": str(reply.get("notes") or "")[:1000]}


CHORE_RULES = """A family added a chore to their chore app. Guess sensible defaults.
check.mode is "clear" if stuff should be gone in the after photo, "show" if something should appear.
check.look_for is 1-3 short noun phrases a segmentation model can find in a photo.
check.spot is one object visible in both photos (same place), or "".
Reply with JSON only:
{"minutes": 15, "effort": 2, "per_week": 2, "min_age": 8, "check": {"mode": "clear", "look_for": ["..."], "spot": "..."}}"""


def guess_chore(name):
    return ask(CHORE_RULES, "Chore: " + name)
