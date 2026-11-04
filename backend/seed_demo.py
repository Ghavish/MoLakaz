# loads one realistic household for demos: mum, dad, john and sara, half way through the week.
# run it again any time to reset the demo.
#   local backend:  python seed_demo.py
#   on modal:       modal run modal_app.py::seed
#   on modal, with a real SAM 3.1 check of your own photos on john's dishes:
#                   modal run modal_app.py::seed --before sink_before.jpg --after sink_after.jpg
# then in the app: join with the code DEMO26 and pick john (or mum for approvals).
# nothing here is a made-up photo check: photo results only come from SAM, when you pass photos on modal.
import os
import time
from datetime import datetime, timedelta

HID = "h_demo"
CODE = "DEMO26"


def _ts(week, day, hour, minute, tz):
    from zoneinfo import ZoneInfo

    d = datetime.fromisoformat(week) + timedelta(days=day, hours=hour, minutes=minute)
    return d.replace(tzinfo=ZoneInfo(tz)).timestamp()


def _save_photo(folder, name, data):
    # same shrink-and-save as the app's uploads
    import io

    from PIL import Image, ImageOps

    folder.mkdir(parents=True, exist_ok=True)
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    img.thumbnail((1280, 1280))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    jpg = buf.getvalue()
    (folder / name).write_bytes(jpg)
    return jpg, f"/photos/{name}?v={int(time.time())}"


def build(tz="Indian/Mauritius"):
    import chores as chore_lib
    import planner

    members = [
        planner.clean_member({"id": "m_mum", "color": 0, "name": "Mum", "age": 45, "admin": True, "free": [45, 45, 45, 45, 45, 150, 120]}),
        planner.clean_member({"id": "m_dad", "color": 1, "name": "Dad", "age": 47, "free": [60, 60, 60, 60, 60, 150, 150]}),
        # light on wednesday, the day before his exam
        planner.clean_member({"id": "m_john", "color": 2, "name": "John", "age": 20, "free": [60, 45, 15, 30, 60, 120, 120]}),
        # football on wednesdays
        planner.clean_member({"id": "m_sara", "color": 3, "name": "Sara", "age": 9, "free": [25, 25, 0, 25, 25, 60, 60]}),
    ]
    chores = [chore_lib.clean({"id": "c_" + k, "icon": k}) for k in ["dishes", "table", "sweep", "trash", "tidy", "laundry"]]
    hh = {
        "id": HID, "name": "Our home", "code": CODE, "tz": tz,
        "members": members, "chores": chores, "tasks": [],
        "notes": "John has exams on Thursday\nSara has football on Wednesdays",
        "history": {}, "created": time.time(),
    }

    week = planner.week_start(tz)
    last = (datetime.fromisoformat(week) - timedelta(days=7)).date().isoformat()
    today = planner.today_index(tz)

    # last week: planned the same way, nearly everything done, then saved so "Last week" has something to show
    hh["week"] = last
    hh["tasks"] = sorted(planner.allocate(hh, planner.make_slots(chores), [], 0), key=lambda t: (t["day"], t["member"]))
    for i, t in enumerate(hh["tasks"]):
        missed = i in (5, 17)
        t["status"] = "todo" if missed else "done"
        if not missed:
            t["done_at"] = _ts(last, t["day"], 18, 10 + i % 40, tz)
    hh["summary"] = "Shared out by free time. Dad took more weekday evenings, Sara kept to small jobs."
    planner.archive(hh)
    hh["history"] = planner.count_history(hh["tasks"])
    stats = {}
    for t in hh["tasks"]:
        s = stats.setdefault(t["member"], {"given": 0, "done": 0})
        s["given"] += 1
        s["done"] += t["status"] == "done"
    hh["last_week"] = stats

    # this week
    hh["week"] = week
    hh["tasks"] = sorted(planner.allocate(hh, planner.make_slots(chores), [], 0), key=lambda t: (t["day"], t["member"]))
    return hh, today


def run(before=b"", after=b"", verify=None):
    """before/after: photo bytes for john's dishes. verify: the real SAM check (modal passes Verifier().check.remote)."""
    import chores as chore_lib
    import planner
    import store

    hh, today = build()
    week, tz = hh["week"], hh["tz"]
    by = lambda chore, day: [t for t in hh["tasks"] if t["chore"] == chore and t["day"] == day]

    # earlier days are done (one missed, so the week shows that too)
    past = [t for t in hh["tasks"] if t["day"] < today]
    for i, t in enumerate(past):
        if i == 3 and t["chore"] != "c_dishes":
            continue
        t["status"], t["done_at"], t["by"] = "done", _ts(week, t["day"], 18, 5 + (i * 7) % 50, tz), t["member"]

    # today, john has the dishes, the table and one more: all to do, so he can do one live on camera
    dishes = by("c_dishes", today)[0]
    table = by("c_table", today)[0]
    dishes.update({"member": "m_john", "status": "todo"})
    table.update({"member": "m_john", "status": "todo"})
    rest = [t for t in hh["tasks"] if t["day"] == today and t not in (table, dishes) and t["chore"] != "c_laundry"]
    todo = rest[0] if rest else None
    if todo:
        todo.update({"member": "m_john", "status": "todo"})
    # anything else john had today goes to dad, so john's day is just those three
    for t in hh["tasks"]:
        if t["day"] == today and t["member"] == "m_john" and t not in (table, dishes, todo):
            t["member"] = "m_dad"

    # with real photos and SAM, john's dishes come with a genuine photo check
    if before and after and verify:
        b_jpg, b_url = _save_photo(store.PHOTOS, "demo_dishes_before.jpg", before)
        a_jpg, a_url = _save_photo(store.PHOTOS, "demo_dishes_after.jpg", after)
        res = verify(b_jpg, a_jpg, chore_lib.TEMPLATES["dishes"]["check"])
        for kind in ("before", "after"):
            marked = res.pop(kind + "_marked", None)
            if marked:
                (store.PHOTOS / f"demo_dishes_{kind}_marked.jpg").write_bytes(marked)
                res[kind + "_marked"] = f"/photos/demo_dishes_{kind}_marked.jpg?v={int(time.time())}"
        ok = res.get("verdict") == "done"
        dishes.update({"status": "done" if ok else "retry", "by": "m_john", "before": b_url, "after": a_url, "check": res})
        if ok:
            dishes["done_at"] = time.time() - 1800
        print("SAM 3.1 checked john's dishes:", res.get("verdict", "?").upper(), "-", res.get("reason", ""))
        print("  scores (before, after):", res.get("scores"))

    # sara tidied the living room and asked mum to check it, so it waits in mum's Approvals
    tidy = next((t for t in hh["tasks"] if t["chore"] == "c_tidy" and t["day"] <= today), None) or \
        next(t for t in hh["tasks"] if t["chore"] == "c_tidy")
    tidy.update({"member": "m_sara", "day": min(tidy["day"], today), "status": "todo", "by": "m_sara", "review": True})
    # the hand-placed chores above shifted the balance, so share the rest of the week out again around them
    fixed = [t for t in hh["tasks"] if t["day"] <= today or t["status"] != "todo"]
    later = [t for t in hh["tasks"] if t not in fixed]
    hh["tasks"] = fixed + planner.allocate(hh, later, fixed, min(today + 1, 6))
    hh["tasks"].sort(key=lambda t: (t["day"], t["member"]))

    # what muse spark would have written when it planned the week
    hh["plan_by"] = "muse-spark"
    hh["summary"] = "Split by free time: Dad does a bit more on weekday evenings, and John gets a lighter Wednesday before his exam."
    hh["messages"] = {
        "m_john": "Light day before your exam on Thursday. Dad picked up Wednesday's dishes so you've got time to study.",
        "m_mum": "The laundry is on the weekend, when you've got more time.",
        "m_dad": "Most of yours fall after 6, when you're home.",
        "m_sara": "Small jobs this week, and nothing on Wednesday because of football.",
    }
    hh["planned_at"] = planner.now(tz).isoformat(timespec="minutes")

    store.put("hh:" + HID, hh)
    store.put("code:" + CODE, HID)
    index = store.get("index") or []
    if HID not in index:
        store.put("index", index + [HID])
    done = sum(t["status"] == "done" for t in hh["tasks"])
    print(f"Demo household ready: {len(hh['tasks'])} chores this week, {done} done, fairness "
          f"{round(planner.fairness(hh, hh['tasks']) * 100)}%, last week saved ({hh['past_weeks'][0]}).")
    print(f"Join in the app with the code {CODE}, then pick John (or Mum for approvals).")


if __name__ == "__main__":
    # the laptop backend has no SAM, so no photo results here
    os.environ.setdefault("MOLAKAZ_LOCAL", "1")
    run()
