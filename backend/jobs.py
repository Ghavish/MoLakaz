import httpx

import planner
import store


def households():
    for hid in store.get("index") or []:
        hh = store.get("hh:" + hid)
        if hh and hh.get("chores"):
            yield hh


def send_push(messages):
    # expo's push service, no key needed. tokens only exist on real builds (not expo go).
    # returns expo's ticket per message, so a failure (like missing FCM credentials) can be shown
    messages = [m for m in messages if str(m.get("to", "")).startswith("ExponentPushToken")]
    tickets = []
    for i in range(0, len(messages), 100):
        try:
            r = httpx.post("https://exp.host/--/api/v2/push/send", json=messages[i:i + 100], timeout=15)
            print("push", r.status_code, len(messages[i:i + 100]))
            data = r.json().get("data", [])
            tickets += data if isinstance(data, list) else [data]
        except Exception as e:
            print("push failed:", e)
            tickets.append({"status": "error", "message": str(e)})
    return tickets


def push_to(members, title, body):
    return send_push([{"to": m["push"], "title": title, "body": body, "sound": "default"} for m in members if m.get("push")])


def remind(hh, evening=False):
    today = planner.today_index(hh["tz"])
    names = {c["id"]: c["name"] for c in hh["chores"]}
    messages = []
    for m in hh["members"]:
        if not m.get("push"):
            continue
        mine = [t for t in hh["tasks"] if t["member"] == m["id"] and t["day"] == today and t["status"] != "done"]
        if not mine:
            continue
        what = ", ".join(names.get(t["chore"], "a chore") for t in mine)
        if evening:
            title = f"Still on your list, {m['name']}"
            body = what + ". Snap a photo when it's done 📸"
        else:
            title = f"Bonzour {m['name']}! ☀️"
            body = "Today: " + what
        messages.append({"to": m["push"], "title": title, "body": body, "sound": "default"})
    send_push(messages)


def morning():
    for hh in households():
        try:
            if hh.get("week") != planner.week_start(hh["tz"]):
                # new week: muse spark plans it from scratch
                planner.new_week(hh, ai=True)
            else:
                # carry over whatever got missed yesterday
                planner.rebalance(hh)
            store.put("hh:" + hh["id"], hh)
            remind(hh)
        except Exception as e:
            print("morning job failed for", hh.get("id"), e)


def evening():
    for hh in households():
        try:
            remind(hh, evening=True)
        except Exception as e:
            print("evening job failed for", hh.get("id"), e)
