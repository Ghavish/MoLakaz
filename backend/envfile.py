# reads backend/.env so keys don't have to be typed into the terminal every time.
# anything already set in the terminal wins over the file. the file is never committed (see .gitignore).
import os
from pathlib import Path

FILE = Path(__file__).parent / ".env"


def load(path=FILE):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        if key and value:
            os.environ.setdefault(key, value)
