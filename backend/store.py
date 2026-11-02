import json
import os
from pathlib import Path

LOCAL = os.environ.get("MOLAKAZ_LOCAL") == "1"
HERE = Path(__file__).parent

if LOCAL:
    # plain json file + folder, so you can work on the app without modal
    DATA = HERE / "local_data.json"
    PHOTOS = HERE / "local_photos"
    PHOTOS.mkdir(exist_ok=True)
    _db = json.loads(DATA.read_text()) if DATA.exists() else {}

    def get(key):
        return _db.get(key)

    def put(key, value):
        _db[key] = value
        DATA.write_text(json.dumps(_db, indent=1))

else:
    import modal

    PHOTOS = Path("/photos")
    _db = modal.Dict.from_name("molakaz-store", create_if_missing=True)

    def get(key):
        return _db.get(key)

    def put(key, value):
        _db[key] = value
