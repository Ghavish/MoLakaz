import planner

# the usual chores, plus what sam should look for in the photos.
# mode "clear" = the stuff in look_for should be gone in the after photo
# mode "show"  = the stuff in look_for should turn up in the after photo
# spot = something that's in both photos, so we know it's the same place
TEMPLATES = {
    "dishes": {"name": "Wash the dishes", "minutes": 20, "effort": 2, "per_week": 7, "min_age": 8,
               "check": {"mode": "clear", "look_for": ["dirty dish", "cup", "pan"], "spot": "sink"}},
    "table": {"name": "Clear the table", "minutes": 10, "effort": 1, "per_week": 7, "min_age": 6,
              "check": {"mode": "clear", "look_for": ["plate", "cup", "crumbs"], "spot": "table"}},
    "sweep": {"name": "Sweep the floor", "minutes": 15, "effort": 2, "per_week": 3, "min_age": 9,
              "check": {"mode": "clear", "look_for": ["dust", "crumbs", "litter"], "spot": "floor"}},
    "trash": {"name": "Take out the trash", "minutes": 5, "effort": 1, "per_week": 3, "min_age": 7,
              "check": {"mode": "clear", "look_for": ["trash bag", "garbage"], "spot": "trash can"}},
    "tidy": {"name": "Tidy the living room", "minutes": 15, "effort": 1, "per_week": 3, "min_age": 5,
             "check": {"mode": "clear", "look_for": ["toy", "clothes", "shoe"], "spot": "sofa"}},
    "laundry": {"name": "Fold the laundry", "minutes": 20, "effort": 2, "per_week": 2, "min_age": 10,
                "check": {"mode": "show", "look_for": ["folded clothes"], "spot": ""}},
    "bathroom": {"name": "Clean the bathroom", "minutes": 30, "effort": 3, "per_week": 1, "min_age": 13,
                 "check": {"mode": "clear", "look_for": ["stain", "dirt", "towel on the floor"], "spot": "toilet"}},
    "cook": {"name": "Cook dinner", "minutes": 45, "effort": 3, "per_week": 5, "min_age": 15,
             "check": {"mode": "show", "look_for": ["cooked food"], "spot": ""}},
    "yard": {"name": "Sweep the yard", "minutes": 20, "effort": 2, "per_week": 1, "min_age": 10,
             "check": {"mode": "clear", "look_for": ["dry leaves", "litter"], "spot": ""}},
    "bed": {"name": "Make the bed", "minutes": 5, "effort": 1, "per_week": 7, "min_age": 6,
            "check": {"mode": "clear", "look_for": ["clothes", "crumpled blanket"], "spot": "bed"}},
}

# order matters, "sweep the yard" has to hit yard before sweep
KEYWORDS = [
    ("yard", ["yard", "lakour", "garden", "leaves"]),
    ("dishes", ["dish", "vesel", "wash up", "washing up"]),
    ("table", ["table"]),
    ("sweep", ["sweep", "mop", "balye", "floor", "vacuum"]),
    ("trash", ["trash", "bin", "garbage", "rubbish"]),
    ("laundry", ["laundry", "fold", "linz", "clothes"]),
    ("bathroom", ["bathroom", "toilet", "shower", "lasal ben"]),
    ("cook", ["cook", "dinner", "lunch", "manze"]),
    ("tidy", ["tidy", "living room", "lounge", "salon", "clutter"]),
    ("bed", ["make the bed", "make bed", "beds"]),
]


def match(name):
    n = (name or "").lower()
    for key, words in KEYWORDS:
        if any(w in n for w in words):
            return key
    return None


def clean(c):
    key = c.get("icon") if c.get("icon") in TEMPLATES else match(c.get("name", ""))
    base = TEMPLATES.get(key, {})
    check = c.get("check") or base.get("check") or {}
    look = [str(x).strip().lower()[:40] for x in (check.get("look_for") or []) if str(x).strip()][:4]
    min_age = c.get("min_age")
    if min_age is None:
        min_age = base.get("min_age", 0)

    return {
        "id": c.get("id") or planner.new_id("c"),
        "name": str(c.get("name") or base.get("name") or "Chore").strip()[:40],
        "icon": key or "other",
        "minutes": planner.clamp(c.get("minutes") or base.get("minutes") or 15, 1, 240),
        "effort": planner.clamp(c.get("effort") or base.get("effort") or 2, 1, 3),
        "per_week": planner.clamp(c.get("per_week") or base.get("per_week") or 1, 1, 7),
        "min_age": planner.clamp(min_age, 0, 99),
        "check": {
            "mode": "show" if check.get("mode") == "show" else "clear",
            "look_for": look or ["mess", "clutter"],
            "spot": str(check.get("spot") or "").strip().lower()[:40],
        },
    }


def suggest(name):
    name = (name or "").strip()[:40]
    key = match(name)
    if key:
        return clean({**TEMPLATES[key], "name": name or TEMPLATES[key]["name"], "icon": key})

    # not one we know, let muse spark guess how long it takes and what to photograph
    import muse
    if muse.ready():
        try:
            return clean({**muse.guess_chore(name), "name": name})
        except Exception as e:
            print("muse spark chore guess failed:", e)
    return clean({"name": name})
