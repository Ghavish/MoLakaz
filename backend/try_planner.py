# quick check of the fair-share planner with a made up family, no modal needed
# python try_planner.py

import chores
import planner

hh = {
    "tz": planner.TZ,
    "members": [
        planner.clean_member({"name": "Mum", "age": 44, "free": [40, 40, 40, 40, 40, 150, 120], "admin": True}),
        planner.clean_member({"name": "Dad", "age": 47, "free": [30, 30, 30, 30, 60, 150, 150]}),
        planner.clean_member({"name": "John", "age": 20, "free": [60, 20, 60, 0, 60, 120, 120]}),
        planner.clean_member({"name": "Sara", "age": 9, "free": [20, 20, 20, 20, 20, 60, 60]}),
    ],
    "chores": [chores.clean({"icon": k}) for k in ["dishes", "table", "sweep", "trash", "tidy", "laundry", "bathroom", "yard"]],
    "tasks": [],
}
names = {m["id"]: m["name"] for m in hh["members"]}
chore_names = {c["id"]: c["name"] for c in hh["chores"]}
ages = {m["id"]: m["age"] for m in hh["members"]}
min_ages = {c["id"]: c["min_age"] for c in hh["chores"]}

# dad hates the bathroom
hh["members"][1]["dislikes"] = [c["id"] for c in hh["chores"] if c["icon"] == "bathroom"]

# plan as if it's monday so the whole week shows
planner.today_index = lambda tz=planner.TZ: 0
planner.plan(hh)


def show(hh):
    for d in range(7):
        todays = [t for t in hh["tasks"] if t["day"] == d]
        print(planner.DAYS[d], " | ".join(f"{names[t['member']]}: {chore_names[t['chore']]}" + (" (!)" if t["tight"] else "") for t in todays))
    print()
    for row in planner.board(hh):
        print(f"{names[row['member']]:5} {row['tasks']:2} chores {row['minutes']:4} min  share {row['share']:.0%}  fair share {row['fair_share']:.0%}")
    print("fairness", planner.fairness(hh, hh["tasks"]), "overflow minutes", planner.overflow(hh, hh["tasks"]))
    print()
    # same chore twice on one day is pointless (two lots of dishes on wednesday, none on thursday)
    pairs = [(t["chore"], t["day"]) for t in hh["tasks"]]
    assert len(pairs) == len(set(pairs)), "a chore landed twice on the same day"


show(hh)

# nobody too young for their chore
for t in hh["tasks"]:
    assert ages[t["member"]] >= min_ages[t["chore"]], t
assert planner.fairness(hh, hh["tasks"]) > 0.85
bathroom = [t for t in hh["tasks"] if chore_names[t["chore"]] == "Clean the bathroom"]
assert all(names[t["member"]] != "Dad" for t in bathroom), "dad got the bathroom even though he hates it"

# wednesday: john says he's away, tuesday's stuff wasn't done
print("--- wednesday, john is away today, nobody did tuesday's chores ---")
planner.today_index = lambda tz=planner.TZ: 2
for t in hh["tasks"]:
    if t["day"] == 0:
        t["status"] = "done"
hh["members"][2]["away"] = [2]
planner.rebalance(hh)
show(hh)
assert not [t for t in hh["tasks"] if t["day"] == 2 and names[t["member"]] == "John"], "john still has chores on his away day"
assert not [t for t in hh["tasks"] if t["day"] == 1 and t["status"] != "done"], "tuesday leftovers weren't moved"

# zara skips a chore, it should go to someone else
z = next(t for t in hh["tasks"] if names[t["member"]] == "Sara" and t["day"] >= 2)
z["not"] = [z["member"]]
planner.rebalance(hh)
moved = next(t for t in hh["tasks"] if t["id"] == z["id"])
print("zara skipped", chore_names[z["chore"]], "-> now", names[moved["member"]], planner.DAYS[moved["day"]])
assert names[moved["member"]] != "Sara"

# next week rotates
planner.week_start = lambda tz=planner.TZ: "2099-01-05"
planner.today_index = lambda tz=planner.TZ: 0
planner.rebalance(hh)
print("\n--- next week ---")
show(hh)
print("all good")
