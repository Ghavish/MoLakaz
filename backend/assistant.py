# the household assistant: muse spark reads the week, answers, and asks for changes as actions.
# every action is checked here against the same rules as the planner before anything moves.
import json
import random
import string

import muse
import planner

RULES = """You are the assistant inside MoLakaz, a chore app for families in Mauritius. You're talking to ME_NAME (id ME_ID).
Today is TODAY_NAME (day TODAY). Days are 0=Mon ... 6=Sun.
You get the household as JSON: people (with free minutes left each day and their share of free time spent on chores this week),
chores, this week's tasks, and the planner notes. Answer questions from that data. When they ask for a change, make it with actions.

Reply with JSON only, nothing else:
{"reply": "1-3 short, warm sentences in plain words. Use names, never ids.", "actions": []}

Actions you can use:
{"type": "move", "task": "<task id>", "member": "<member id>", "day": 0}   give a chore to someone else and/or move it to another day
{"type": "swap", "a": "<task id>", "b": "<task id>"}                      two people swap chores (each keeps the other's day)
{"type": "note", "text": "..."}                                           add a note the weekly planner reads (exams, shifts, sport)
{"type": "busy_today"}                                                    ME can't do chores today: their chores today go to whoever is free

Rules:
- only change tasks with status "todo", never to a day before TODAY
- only give a chore to someone old enough for it (min_age) with free minutes left that day
- keep it fair: when moving a chore off someone, prefer whoever has the lowest share, and give ME something lighter later in the week if that keeps it even
- don't change anything they didn't ask for. If they only ask a question, actions is []
- if you can't do it, say why in the reply and leave actions empty"""

MAX_NOTES = 1000
MAX_FAIRNESS_DROP = 0.15  # the weekly planner allows 0.05; a direct request gets more room


def _id():
    return "c_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def _context(hh, me, today):
    chores = {c["id"]: c for c in hh["chores"]}
    used = {}
    for t in hh.get("tasks", []):
        c = chores.get(t["chore"])
        if c:
            used[(t["member"], t["day"])] = used.get((t["member"], t["day"]), 0) + c["minutes"]
    loads = planner.loads(hh, hh.get("tasks", []))
    return {
        "me": me,
        "today": today,
        "people": [{
            "id": m["id"],
            "name": m["name"],
            "age": m["age"],
            "free_left": {planner.DAYS[d]: max(0, planner.free_on(m, d) - used.get((m["id"], d), 0)) for d in range(today, 7)},
            "share_of_free_time": round(loads[m["id"]] / planner.capacity(m), 2) if planner.capacity(m) else None,
            "busy_days": [planner.DAYS[d] for d in m.get("away", [])],
        } for m in hh["members"]],
        "chores": [{"id": c["id"], "name": c["name"], "minutes": c["minutes"], "min_age": c.get("min_age", 0)} for c in hh["chores"]],
        "tasks": [{"id": t["id"], "chore": chores[t["chore"]]["name"], "member": t["member"], "day": t["day"], "status": t["status"]}
                  for t in hh.get("tasks", []) if t["chore"] in chores],
        "notes": hh.get("notes", ""),
    }


def ask(hh, me, text, history):
    """Ask muse spark. Returns {"reply", "actions"}; nothing is changed yet."""
    today = planner.today_index(hh.get("tz", planner.TZ))
    name = next(m["name"] for m in hh["members"] if m["id"] == me)
    rules = (RULES.replace("ME_NAME", name).replace("ME_ID", me)
             .replace("TODAY_NAME", planner.DAYS[today]).replace("TODAY", str(today)))
    convo = [{"from": "me" if h.get("from") == "me" else "assistant", "text": str(h.get("text", ""))[:500]}
             for h in (history or [])[-10:]]
    payload = {"household": _context(hh, me, today), "conversation_so_far": convo, "message": text}
    reply = muse.ask(rules, json.dumps(payload))
    actions = reply.get("actions") if isinstance(reply.get("actions"), list) else []
    return {"reply": str(reply.get("reply") or "").strip()[:600] or "Done.", "actions": actions[:6]}


def _label(hh, t):
    chore = next((c["name"] for c in hh["chores"] if c["id"] == t["chore"]), "A chore")
    return f"{chore} ({planner.DAYS[t['day']]})"


def apply(hh, me, actions):
    """Check and apply actions to hh in place. Returns (changes or None, list of reasons something was refused)."""
    tz = hh.get("tz", planner.TZ)
    today = planner.today_index(tz)
    chores = {c["id"]: c for c in hh["chores"]}
    people = {m["id"]: m for m in hh["members"]}
    me_m = people[me]

    before_tasks = [dict(t) for t in hh.get("tasks", [])]
    snapshot = {"tasks": {t["id"]: [t["member"], t["day"]] for t in before_tasks if t["status"] == "todo"},
                "notes": hh.get("notes", ""), "away": list(me_m.get("away", [])), "week": hh.get("week")}
    tasks = [dict(t) for t in before_tasks]
    by_id = {t["id"]: t for t in tasks}
    refused, notes_added, busy = [], [], False

    def movable(t):
        return t and t["status"] == "todo" and t["day"] >= today

    for a in actions:
        if not isinstance(a, dict):
            continue
        kind = a.get("type")
        if kind == "move":
            t, m = by_id.get(str(a.get("task"))), people.get(str(a.get("member")))
            day = planner.clamp(a.get("day", t["day"] if t else today), 0, 6) if t else today
            if not movable(t):
                refused.append("that chore is already started, done or in the past")
            elif not m:
                refused.append("I couldn't tell who should take it")
            elif day < today:
                refused.append("chores can't move to a day that's gone")
            elif not planner.can_do(m, chores[t["chore"]], t):
                refused.append(f"{m['name']} can't do {chores[t['chore']]['name'].lower()}")
            elif planner.free_on(m, day) == 0:
                refused.append(f"{m['name']} has no free time on {planner.DAYS[day]}")
            else:
                t["member"], t["day"] = m["id"], day
        elif kind == "swap":
            x, y = by_id.get(str(a.get("a"))), by_id.get(str(a.get("b")))
            if not (movable(x) and movable(y)) or x is y:
                refused.append("one of those chores is already started, done or in the past")
                continue
            mx, my = people.get(x["member"]), people.get(y["member"])
            if not mx or not my or not planner.can_do(my, chores[x["chore"]], x) or not planner.can_do(mx, chores[y["chore"]], y):
                refused.append("that swap would give someone a chore they can't do")
                continue
            x["member"], y["member"] = y["member"], x["member"]
        elif kind == "note":
            text = " ".join(str(a.get("text") or "").split())[:200]
            if text:
                notes_added.append(text)
        elif kind == "busy_today":
            busy = True

    # someone asked for this, so allow a small dip in fairness (the card shows it and Undo is one tap),
    # but never push anyone past their free time and never wreck the week
    old = {t["id"]: t for t in before_tasks}
    if any((t["member"], t["day"]) != (old[t["id"]]["member"], old[t["id"]]["day"]) for t in tasks):
        if planner.overflow(hh, tasks) > planner.overflow(hh, before_tasks):
            refused.append("it would give someone more chores than they have free time for that day")
            tasks = [dict(t) for t in before_tasks]
        elif planner.fairness(hh, tasks) < planner.fairness(hh, before_tasks) - MAX_FAIRNESS_DROP:
            refused.append("it would make the week a lot less fair. Try swapping instead, so you take something back")
            tasks = [dict(t) for t in before_tasks]

    hh["tasks"] = tasks
    if busy and today not in me_m.get("away", []):
        me_m["away"] = sorted(set(me_m.get("away", [])) | {today})
        planner.rebalance(hh)
    if notes_added:
        hh["notes"] = "\n".join(filter(None, [hh.get("notes", "")] + notes_added))[:MAX_NOTES]

    # describe what changed, from the point of view of the person asking
    moved_lines, added_lines = [], []
    for t in hh["tasks"]:
        b = old.get(t["id"])
        if not b or (b["member"], b["day"]) == (t["member"], t["day"]):
            continue
        frm, to = people.get(b["member"], {}).get("name", "?"), people.get(t["member"], {}).get("name", "?")
        if t["member"] == me and b["member"] != me:
            added_lines.append(f"{_label(hh, t)} → {to}")
        elif b["member"] == t["member"]:
            moved_lines.append(f"{_label(hh, b)} → {planner.DAYS[t['day']]} · {to}")
        else:
            moved_lines.append(f"{_label(hh, b)} · {frm} → {to}")

    if not (moved_lines or added_lines or notes_added or busy):
        return None, refused

    change_id = _id()
    hh.setdefault("undo", {})[me] = {"id": change_id, **snapshot}
    changes = {"id": change_id, "moved": moved_lines, "added": added_lines, "notes": notes_added}
    if moved_lines or added_lines:
        changes["fairness"] = {"from": round(planner.fairness(hh, before_tasks) * 100),
                               "to": round(planner.fairness(hh, hh["tasks"]) * 100)}
    return changes, refused


def undo(hh, me, change_id):
    """Put back the last change set this person made. Returns an error message, or None when it worked."""
    snap = (hh.get("undo") or {}).get(me)
    if not snap or snap.get("id") != change_id:
        return "Only your latest change can be undone."
    if snap.get("week") != hh.get("week"):
        return "That was last week's plan, so it can't be undone now."
    for t in hh.get("tasks", []):
        if t["status"] == "todo" and t["id"] in snap["tasks"]:
            t["member"], t["day"] = snap["tasks"][t["id"]]
    hh["notes"] = snap["notes"]
    for m in hh["members"]:
        if m["id"] == me:
            m["away"] = snap["away"]
    hh["tasks"].sort(key=lambda t: (t["day"], t["member"]))
    del hh["undo"][me]
    return None


def explain_refusal(reply, refused, changed):
    # the model may have said "done" for something the rules then blocked, so say what actually happened
    if not refused:
        return reply
    why = refused[0]
    if not changed:
        return f"I couldn't do that: {why}. Want to try a different day or person?"
    return f"{reply} One part didn't go through: {why}."
