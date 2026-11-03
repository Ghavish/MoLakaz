# check your muse spark key works: put MODEL_API_KEY in backend/.env, then python try_muse.py
import os
import sys

import envfile

envfile.load()

import muse  # noqa: E402

if not muse.ready():
    sys.exit("Put MODEL_API_KEY=... in backend/.env first (copy .env.example to .env)")

from openai import OpenAI

print("calling", muse.MODEL, "at", muse.BASE_URL)
client = OpenAI(base_url=muse.BASE_URL, api_key=os.environ["MODEL_API_KEY"], timeout=60)
r = client.chat.completions.create(model=muse.MODEL, messages=[{"role": "user", "content": "Say hello to the MoLakaz family in one line."}])
print("chat:", r.choices[0].message.content)

print("reading a household description...")
draft = muse.read_household("Mum works 8-5, Dad is free after 6, Sara is 9. We need the dishes every night and the floors swept twice a week.")
print("people:", [m["name"] for m in draft["members"]])
print("chores:", [c["name"] for c in draft["chores"]])
