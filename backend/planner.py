import copy
import random
import string
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = "Indian/Mauritius"
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
EFFORT = {1: 1.0, 2: 1.3, 3: 1.6}

# how much each nudge is worth, counted in "minutes of chores"
REPEAT_COST = 12   # already had this chore this week (or last week)
DISLIKE_COST = 30
MOVE_COST = 10     # per day a chore drifts from the day it was meant for
STAY_BONUS = 8     # when rebalancing, prefer leaving things where they were


def new_id(prefix):
    return prefix + "_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def clamp(x, lo, hi):
    try:
        x = int(x)
    except (TypeError, ValueError):
        x = lo
    return max(lo, min(hi, x))


def now(tz=TZ):
    return datetime.now(ZoneInfo(tz or TZ))


def week_start(tz=TZ):
    d = now(tz).date()
    return (d - timedelta(days=d.weekday())).isoformat()


def today_index(tz=TZ):
    return now(tz).weekday()


def next_week_start(tz=TZ):
    return (datetime.fromisoformat(week_start(tz)) + timedelta(days=7)).date().isoformat()


KEEP_WEEKS = 8


def weight(chore):
    # a 20 min hard chore counts for more than a 20 min easy one
    return chore["minutes"] * EFFORT.get(chore.get("effort", 2), 1.3)


def free_on(m, day):
    if day in m.get("away", []):
        return 0
    return m["free"][day]


def capacity(m):
    return sum(free_on(m, d) for d in range(7))


def can_do(m, chore, task=None):
    if m.get("age", 30) < chore.get("min_age", 0):
        return False
    if task and m["id"] in task.get("not", []):
        return False
    return True


def clean_member(m, old=None, chore_names=None):
    old = old or {}
    free = list(m.get("free") or old.get("free") or [45, 45, 45, 45, 45, 120, 120])
    free = [clamp(x, 0, 720) for x in (free + [0] * 7)[:7]]

    # dislikes can come in as chore ids (from the app) or names (from muse spark)
    dislikes = [str(d) for d in m.get("dislikes") or []]
    if chore_names is not None:
        ids = set(chore_names.values())
        dislikes = [chore_names.get(d.lower(), d) for d in dislikes]
        dislikes = [d for d in dislikes if d in ids]

    return {
        "id": m.get("id") or old.get("id") or new_id("m"),
        "name": str(m.get("name") or "Someone").strip()[:24],
        "age": clamp(m.get("age") or old.get("age") or 30, 1, 110),
        "admin": bool(m.get("admin", old.get("admin", False))),
        "free": free,
        "dislikes": dislikes,
        "away": old.get("away", []),
        "push": old.get("push"),
    }


def spread(per_week, start):
    # 3 times a week -> mon, wed, fri style, not mon, tue, wed
    n = clamp(per_week, 1, 7)
    return sorted({(start + int(k * 7 / n + 0.5)) % 7 for k in range(n)})


def make_slots(chores):
    slots = []
    for i, c in enumerate(chores):
        # stagger the start so every weekly chore doesn't land on monday
        for d in spread(c.get("per_week", 1), (i * 3) % 7):
            slots.append({"chore": c["id"], "day": d})
    return slots


def allocate(hh, slots, fixed, first_day=0):
    chores = {c["id"]: c for c in hh["chores"]}
    people = hh["members"]
    if not people:
        return []

    load = {m["id"]: 0.0 for m in people}
    used = {m["id"]: [0] * 7 for m in people}
    times = {m["id"]: {} for m in people}
    taken = set()  # (chore, day) pairs, so a chore never doubles up on one day

    # last week counts half, so the same person doesn't get stuck with the same thing
    for mid, counts in (hh.get("history") or {}).items():
        if mid in times:
            for cid, n in counts.items():
                times[mid][cid] = n * 0.5

    def add(mid, c, day):
        load[mid] += weight(c)
        used[mid][day] += c["minutes"]
        times[mid][c["id"]] = times[mid].get(c["id"], 0) + 1
        taken.add((c["id"], day))

    for t in fixed:
        c = chores.get(t["chore"])
        if c and t["member"] in load:
            add(t["member"], c, t["day"])

    caps = {m["id"]: capacity(m) for m in people}
    avg = sum(caps.values()) / len(caps) or 1

    placed = []
    slots = [s for s in slots if s["chore"] in chores]
    # every slot holds on to its own day, so others don't drift onto it
    for s in slots:
        taken.add((s["chore"], max(s["day"], first_day)))
    # biggest jobs first, they're the hardest to fit in
    for s in sorted(slots, key=lambda s: (-weight(chores[s["chore"]]), s["day"])):
        c = chores[s["chore"]]
        want = max(s["day"], first_day)
        best = None

        for m in people:
            mid = m["id"]
            if caps[mid] <= 0 or not can_do(m, c, s):
                continue
            for d in range(first_day, 7):
                if abs(d - want) > 2 or used[mid][d] + c["minutes"] > free_on(m, d):
                    continue
                if d != want and (c["id"], d) in taken:
                    continue
                # main thing: how full their week gets compared to how much free time they have
                cost = (load[mid] + weight(c)) / caps[mid] * avg
                cost += REPEAT_COST * times[mid].get(c["id"], 0)
                cost += MOVE_COST * abs(d - want)
                if c["id"] in m.get("dislikes", []):
                    cost += DISLIKE_COST
                if s.get("member") == mid and s.get("day") == d:
                    cost -= STAY_BONUS
                if best is None or cost < best[0]:
                    best = (cost, mid, d)

        tight = best is None
        if tight:
            # nobody has the time, give it to whoever is least busy and flag it
            ok = [m for m in people if can_do(m, c, s)] or [m for m in people if can_do(m, c)] or people
            m = min(ok, key=lambda m: load[m["id"]] / max(caps[m["id"]], 1))
            best = (0, m["id"], want)

        _, mid, d = best
        add(mid, c, d)
        t = {k: v for k, v in s.items() if k not in ("member", "day", "status", "tight")}
        t.update({"id": s.get("id") or new_id("t"), "member": mid, "day": d, "status": "todo", "tight": tight})
        placed.append(t)

    return placed


def loads(hh, tasks):
    chores = {c["id"]: c for c in hh["chores"]}
    out = {m["id"]: 0.0 for m in hh["members"]}
    for t in tasks:
        if t["chore"] in chores and t["member"] in out:
            out[t["member"]] += weight(chores[t["chore"]])
    return out


def fairness(hh, tasks):
    # jain's index on (chore load / free time). 1.0 means everyone gives up the same share of their free time
    l = loads(hh, tasks)
    xs = [l[m["id"]] / capacity(m) for m in hh["members"] if capacity(m) > 0]
    if len(xs) < 2 or not any(xs):
        return 1.0
    return round(sum(xs) ** 2 / (len(xs) * sum(x * x for x in xs)), 3)


def overflow(hh, tasks):
    # minutes people got on top of what they said they had free
    chores = {c["id"]: c for c in hh["chores"]}
    people = {m["id"]: m for m in hh["members"]}
    used = {}
    for t in tasks:
        if t["chore"] in chores and t["member"] in people:
            key = (t["member"], t["day"])
            used[key] = used.get(key, 0) + chores[t["chore"]]["minutes"]
    return sum(max(0, v - free_on(people[mid], d)) for (mid, d), v in used.items())


def board(hh):
    chores = {c["id"]: c for c in hh["chores"]}
    tasks = hh.get("tasks", [])
    l = loads(hh, tasks)
    total = sum(l.values()) or 1
    caps = {m["id"]: capacity(m) for m in hh["members"]}
    cap_total = sum(caps.values()) or 1
    out = []
    for m in hh["members"]:
        mine = [t for t in tasks if t["member"] == m["id"] and t["chore"] in chores]
        out.append({
            "member": m["id"],
            "tasks": len(mine),
            "done": sum(1 for t in mine if t["status"] == "done"),
            "minutes": sum(chores[t["chore"]]["minutes"] for t in mine),
            "free": caps[m["id"]],
            "share": round(l[m["id"]] / total, 3),
            "fair_share": round(caps[m["id"]] / cap_total, 3),
        })
    return out


# rough clock for the parts of the day, just to put a day's chores in order
PART_AT = {"morning": 8 * 60, "afternoon": 14 * 60, "evening": 18 * 60 + 30}


def time_of(t, chore, m=None):
    # muse spark can pin a time on one person's chore ("dad's only free after 6"). it stops counting if the chore changes hands
    if t.get("time") and t.get("time_for") == t["member"]:
        return t["time"]
    when = (chore or {}).get("when") or "anytime"
    if when != "anytime":
        return when
    # no set time: weekends get the morning, on weekdays kids do it after school and grown ups after work
    if t["day"] >= 5:
        return "morning"
    if m and m.get("age", 30) < 18:
        return "afternoon"
    return "evening"


def time_order(when):
    if ":" in when:
        h, mins = when.split(":")
        return int(h) * 60 + int(mins)
    return PART_AT.get(when, 12 * 60)


def time_label(when):
    # "07:00" -> "7:00 am", "evening" -> "Evening"
    if ":" not in when:
        return when.capitalize()
    h, mins = (int(x) for x in when.split(":"))
    return f"{(h - 1) % 12 + 1}:{mins:02d} {'am' if h < 12 else 'pm'}"


def with_times(hh, tasks):
    # copies of the tasks with their time of day filled in, in the order they happen
    chores = {c["id"]: c for c in hh["chores"]}
    people = {m["id"]: m for m in hh["members"]}
    out = [{**t, "time": time_of(t, chores.get(t["chore"]), people.get(t["member"]))} for t in tasks]
    return sorted(out, key=lambda t: (t["day"], time_order(t["time"])))


def plan(hh, ai=False):
    tz = hh.get("tz", TZ)
    if hh.get("week") != week_start(tz):
        archive(hh)
        hh["week"] = week_start(tz)
        hh["tasks"] = []
        for m in hh["members"]:
            m["away"] = []

    today = today_index(tz)
    chore_ids = {c["id"] for c in hh["chores"]}
    member_ids = {m["id"] for m in hh["members"]}

    # anything already started or finished this week stays where it is
    fixed = [t for t in hh.get("tasks", [])
             if t["status"] != "todo" and t["chore"] in chore_ids and t["member"] in member_ids]

    every = make_slots(hh["chores"])
    slots = []
    for c in hh["chores"]:
        left = [s for s in every if s["chore"] == c["id"] and s["day"] >= today]
        if not left and not any(t["chore"] == c["id"] for t in fixed):
            # all of this week's goes were already in the past, still do it once
            left = [{"chore": c["id"], "day": today}]
        slots += left

    # don't double up on something that's already been started/done that day
    for t in fixed:
        for s in slots:
            if s["chore"] == t["chore"] and s["day"] == t["day"]:
                slots.remove(s)
                break

    hh["tasks"] = fixed + allocate(hh, slots, fixed, today)
    hh["plan_by"] = "fair-share"
    hh["messages"] = {}
    hh["summary"] = ""

    if ai:
        import muse
        if muse.ready():
            try:
                muse.improve(hh, today)
            except Exception as e:
                print("muse spark plan failed, keeping the fair-share plan:", e)

    hh["tasks"].sort(key=lambda t: (t["day"], t["member"]))
    hh["planned_at"] = now(tz).isoformat(timespec="minutes")
    return hh


def rebalance(hh):
    tz = hh.get("tz", TZ)
    if hh.get("week") != week_start(tz):
        return new_week(hh)

    today = today_index(tz)
    chores = {c["id"]: c for c in hh["chores"]}
    member_ids = {m["id"] for m in hh["members"]}
    keep, slots = [], []

    for t in hh.get("tasks", []):
        c = chores.get(t["chore"])
        if not c:
            continue
        if t["status"] == "done":
            keep.append(t)
        elif t["day"] < today:
            # missed it. daily-ish chores just get dropped, the rest roll over
            if c["per_week"] >= 4:
                hh.setdefault("missed", []).append({"chore": t["chore"], "member": t["member"], "day": t["day"]})
                continue
            slots.append({"id": t["id"], "chore": t["chore"], "day": t["day"], "member": t["member"],
                          "not": t.get("not", []), "carried": t.get("carried", 0) + 1})
        elif t["status"] in ("started", "retry") and t["member"] in member_ids:
            keep.append(t)
        else:
            slots.append(t)

    hh["tasks"] = keep + allocate(hh, slots, keep, today)
    hh["tasks"].sort(key=lambda t: (t["day"], t["member"]))
    return hh


def week_snapshot(hh, kind="past"):
    # everything the week screen needs, with names copied in so it still reads right if people or chores change later
    tasks = hh.get("tasks", [])
    return {
        "kind": kind,
        "week": hh.get("week"),
        "tasks": [{k: t.get(k) for k in ("id", "chore", "member", "day", "status", "time")} for t in with_times(hh, tasks)],
        "board": board(hh),
        "fairness": fairness(hh, tasks),
        "summary": hh.get("summary", ""),
        "members": [{"id": m["id"], "name": m["name"]} for m in hh["members"]],
        "chores": [{k: c.get(k) for k in ("id", "name", "icon", "minutes")} for c in hh["chores"]],
    }


def archive(hh):
    # keep the finished week so people can look back at it from the week screen
    if not hh.get("tasks") or not hh.get("week") or not hh.get("id"):
        return
    import store

    store.put(f"week:{hh['id']}:{hh['week']}", week_snapshot(hh))
    weeks = [w for w in hh.get("past_weeks", []) if w != hh["week"]]
    hh["past_weeks"] = sorted([hh["week"]] + weeks, reverse=True)[:KEEP_WEEKS]


def count_history(tasks):
    history = {}
    for t in tasks:
        history.setdefault(t["member"], {})
        history[t["member"]][t["chore"]] = history[t["member"]].get(t["chore"], 0) + 1
    return history


def preview_next(hh):
    # what next week would look like from today's household. fair-share only, nothing is saved:
    # the real plan is made on monday morning, when muse spark also gets a say
    nxt = copy.deepcopy(hh)
    nxt["history"] = count_history(hh.get("tasks", []))
    nxt["week"] = next_week_start(hh.get("tz", TZ))
    for m in nxt["members"]:
        m["away"] = []
    nxt["tasks"] = allocate(nxt, make_slots(nxt["chores"]), [], 0)
    nxt["tasks"].sort(key=lambda t: (t["day"], t["member"]))
    nxt["summary"] = ""
    return week_snapshot(nxt, "next")


def new_week(hh, ai=False):
    archive(hh)
    # remember who did what, so next week rotates and muse can see who slacked
    history, stats = count_history(hh.get("tasks", [])), {}
    for t in hh.get("tasks", []):
        s = stats.setdefault(t["member"], {"given": 0, "done": 0})
        s["given"] += 1
        if t["status"] == "done":
            s["done"] += 1
    for x in hh.get("missed", []):
        s = stats.setdefault(x["member"], {"given": 0, "done": 0})
        s["given"] += 1

    hh["history"] = history
    hh["last_week"] = stats
    hh["missed"] = []
    hh["tasks"] = []
    hh["week"] = week_start(hh.get("tz", TZ))
    for m in hh["members"]:
        m["away"] = []
    return plan(hh, ai)
