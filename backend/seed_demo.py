# loads one realistic household for demos: mum, dad, john and sara, half way through the week.
# run it again any time to reset the demo.
#   local backend:  python seed_demo.py
#   on modal:       modal run modal_app.py::seed
# then in the app: join with the code DEMO26 and pick john (or mum for approvals)
import os
import time
from datetime import datetime, timedelta

HID = "h_demo"
CODE = "DEMO26"


def _ts(week, day, hour, minute, tz):
    from zoneinfo import ZoneInfo

    d = datetime.fromisoformat(week) + timedelta(days=day, hours=hour, minutes=minute)
    return d.replace(tzinfo=ZoneInfo(tz)).timestamp()


def _photos(folder):
    # simple drawings that stand in for real photos: a sink, a table and a sofa, before and after,
    # plus "marked" copies like the ones SAM paints (orange for mess, green for clean)
    from PIL import Image, ImageDraw

    orange, green = (217, 105, 42), (31, 181, 133)

    def scene(kind, mess, mark=None):
        im = Image.new("RGB", (800, 600), (224, 219, 210))
        d = ImageDraw.Draw(im, "RGBA")
        d.rectangle([0, 420, 800, 600], fill=(196, 188, 176))
        items = []
        if kind == "sink":
            d.rectangle([60, 170, 740, 230], fill=(240, 240, 238))
            d.polygon([(130, 230), (670, 230), (610, 470), (190, 470)], fill=(176, 184, 192), outline=(120, 128, 136))
            d.rectangle([380, 90, 420, 175], fill=(150, 156, 162))
            area = [(130, 230), (670, 230), (610, 470), (190, 470)]
            items = [(250, 330, 360, 400), (330, 360, 450, 430), (450, 300, 520, 420), (520, 350, 600, 410)] if mess else []
        elif kind == "table":
            d.rectangle([120, 260, 680, 300], fill=(150, 108, 72))
            d.rectangle([150, 300, 180, 470], fill=(130, 92, 60))
            d.rectangle([620, 300, 650, 470], fill=(130, 92, 60))
            area = [(120, 260), (680, 260), (680, 300), (120, 300)]
            items = [(190, 215, 300, 262), (360, 220, 430, 262), (500, 205, 610, 262)] if mess else []
        else:  # sofa
            d.rounded_rectangle([110, 220, 690, 420], 30, fill=(96, 122, 150))
            d.rounded_rectangle([150, 160, 650, 260], 30, fill=(110, 138, 168))
            area = [(110, 160), (690, 160), (690, 420), (110, 420)]
            items = [(230, 300, 300, 360), (480, 450, 560, 520)] if mess == 2 else ([(480, 450, 560, 520)] if mess else [])
        for box in items:
            d.ellipse(box, fill=(250, 250, 250), outline=(150, 150, 150), width=3)
            if mark == "mess":
                d.ellipse(box, fill=orange + (150,), outline=orange, width=5)
        if mark == "clean":
            d.polygon(area, fill=green + (60,), outline=green)
            d.line(area + [area[0]], fill=green, width=6)
        return im

    folder.mkdir(parents=True, exist_ok=True)
    shots = {
        "demo_sink_before.jpg": scene("sink", True),
        "demo_sink_after.jpg": scene("sink", False),
        "demo_table_before.jpg": scene("table", True),
        "demo_table_after.jpg": scene("table", False),
        "demo_table_before_marked.jpg": scene("table", True, "mess"),
        "demo_table_after_marked.jpg": scene("table", False, "clean"),
        "demo_sofa_before.jpg": scene("sofa", 2),
        "demo_sofa_after.jpg": scene("sofa", 1),
        "demo_sofa_before_marked.jpg": scene("sofa", 2, "mess"),
        "demo_sofa_after_marked.jpg": scene("sofa", 1, "mess"),
    }
    for name, im in shots.items():
        im.save(folder / name, "JPEG", quality=85)
    return {k: f"/photos/{k}?v={int(time.time())}" for k in shots}


def build(tz="Indian/Mauritius"):
    import chores as chore_lib
    import planner

    members = [
        planner.clean_member({"id": "m_mum", "name": "Mum", "age": 45, "admin": True, "free": [45, 45, 45, 45, 45, 150, 120]}),
        planner.clean_member({"id": "m_dad", "name": "Dad", "age": 47, "free": [60, 60, 60, 60, 60, 150, 150]}),
        # light on wednesday, the day before his exam
        planner.clean_member({"id": "m_john", "name": "John", "age": 20, "free": [60, 45, 15, 30, 60, 120, 120]}),
        # football on wednesdays
        planner.clean_member({"id": "m_sara", "name": "Sara", "age": 9, "free": [25, 25, 0, 25, 25, 60, 60]}),
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


def run():
    import planner
    import store

    hh, today = build()
    week, tz = hh["week"], hh["tz"]
    pics = _photos(store.PHOTOS)
    by = lambda chore, day: [t for t in hh["tasks"] if t["chore"] == chore and t["day"] == day]

    # earlier days are done (one missed, so the week shows that too)
    past = [t for t in hh["tasks"] if t["day"] < today]
    for i, t in enumerate(past):
        if i == 3 and t["chore"] != "c_dishes":
            continue
        t["status"], t["done_at"], t["by"] = "done", _ts(week, t["day"], 18, 5 + (i * 7) % 50, tz), t["member"]

    # today, for john: cleared the table (checked by photo), dishes in progress, one still to do
    table = by("c_table", today)[0]
    table.update({"member": "m_john", "status": "done", "done_at": time.time() - 3600, "by": "m_john",
                  "before": pics["demo_table_before.jpg"], "after": pics["demo_table_after.jpg"],
                  "check": {"verdict": "done", "mode": "clear", "look_for": ["plate", "cup", "crumbs"], "spot": "table",
                            "before": {"count": 3, "area": 0.06}, "after": {"count": 0, "area": 0.0}, "cleared": 1.0,
                            "reason": "3 → 0. 100% cleared, looks done!",
                            "before_marked": pics["demo_table_before_marked.jpg"], "after_marked": pics["demo_table_after_marked.jpg"]}})
    dishes = by("c_dishes", today)[0]
    dishes.update({"member": "m_john", "status": "started", "by": "m_john", "before": pics["demo_sink_before.jpg"]})
    rest = [t for t in hh["tasks"] if t["day"] == today and t not in (table, dishes) and t["chore"] != "c_laundry"]
    todo = rest[0] if rest else None
    if todo:
        todo.update({"member": "m_john", "status": "todo"})
    # anything else john had today goes to dad, so john's day is just those three
    for t in hh["tasks"]:
        if t["day"] == today and t["member"] == "m_john" and t not in (table, dishes, todo):
            t["member"] = "m_dad"

    # sara: tidied the living room, but the photo check wasn't sure, so it waits for mum in Approvals
    tidy = next((t for t in hh["tasks"] if t["chore"] == "c_tidy" and t["day"] <= today), None) or \
        next(t for t in hh["tasks"] if t["chore"] == "c_tidy")
    tidy.update({"member": "m_sara", "day": min(tidy["day"], today), "status": "retry", "by": "m_sara",
                 "before": pics["demo_sofa_before.jpg"], "after": pics["demo_sofa_after.jpg"],
                 "check": {"verdict": "retry", "mode": "clear", "look_for": ["toy", "clothes", "shoe"], "spot": "sofa",
                           "before": {"count": 2, "area": 0.03}, "after": {"count": 1, "area": 0.012}, "cleared": 0.6,
                           "reason": "2 → 1. There's still a toy by the sofa.",
                           "before_marked": pics["demo_sofa_before_marked.jpg"], "after_marked": pics["demo_sofa_after_marked.jpg"]}})
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
    os.environ.setdefault("MOLAKAZ_LOCAL", "1")
    run()
