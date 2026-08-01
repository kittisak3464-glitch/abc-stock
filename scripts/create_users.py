"""Create all 27 ABC Stock accounts with random 6-digit passwords (Phase 1).

Usage:
    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_KEY=<service_role key>
    python create_users.py

Writes credentials_PRIVATE.csv next to this script — hand each person their
line, then keep/delete the file yourself. NEVER commit it (gitignored).
"""
import csv
import json
import os
import secrets
import sys
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables first.")

# (display_name, email, role, branch_code|None, lang)
ROSTER = [
    ("Kittisak", "admin@abcstock.app",   "admin", None,     "en"),
    ("Owner",    "owner@abcstock.app",   "owner", None,     "zh"),
    ("Gas",      "gas@abcstock.app",     "owner", None,     "th"),
    ("Moiuk",    "moiuk.yq@abcstock.app",  "staff", "ABCYQ",  "en"),
    ("Lar",      "lar.yq@abcstock.app",    "staff", "ABCYQ",  "en"),
    ("Ramu",     "ramu.yq@abcstock.app",   "staff", "ABCYQ",  "en"),
    ("Pong",     "pong.yq@abcstock.app",   "staff", "ABCYQ",  "en"),
    ("Nadi",     "nadi.yq@abcstock.app",   "staff", "ABCYQ",  "en"),
    ("Kumari",   "kumari.yq@abcstock.app", "staff", "ABCYQ",  "en"),
    ("Ko Thet",  "kothet.yq@abcstock.app", "staff", "ABCYQ",  "en"),
    ("Htike",    "htike.so@abcstock.app",  "staff", "ABCSO",  "en"),
    ("B Maw",    "bmaw.so@abcstock.app",   "staff", "ABCSO",  "en"),
    ("Arjun",    "arjun.so@abcstock.app",  "staff", "ABCSO",  "en"),
    ("Keran",    "keran.so@abcstock.app",  "staff", "ABCSO",  "en"),
    ("Suraj",    "suraj.ha@abcstock.app",  "staff", "ABCHA",  "en"),
    ("Oak",      "oak.ha@abcstock.app",    "staff", "ABCHA",  "en"),
    ("Chit Pu",  "chitpu.ha@abcstock.app", "staff", "ABCHA",  "en"),
    ("Arjun",    "arjun.qq@abcstock.app",  "staff", "ABCQQ",  "en"),
    ("Vicky",    "vicky.qq@abcstock.app",  "staff", "ABCQQ",  "en"),
    ("Aung",     "aung.qq@abcstock.app",   "staff", "ABCQQ",  "en"),
    ("Mahesh",   "mahesh.qq@abcstock.app", "staff", "ABCQQ",  "en"),
    ("Teelak",   "teelak.lh@abcstock.app", "staff", "LEHONG", "en"),
    ("Qiew",     "qiew.lh@abcstock.app",   "staff", "LEHONG", "en"),
    ("A Naing",  "anaing.lh@abcstock.app", "staff", "LEHONG", "en"),
    ("Mathet",   "mathet.lh@abcstock.app", "staff", "LEHONG", "en"),
    ("May",      "may.lh@abcstock.app",    "staff", "LEHONG", "en"),
    ("Liam",     "liam.lh@abcstock.app",   "staff", "LEHONG", "en"),
]


def call(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}


def get(url):
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    branches = {b["code"]: b["id"] for b in get(f"{SUPABASE_URL}/rest/v1/branches?select=id,code")}
    out_path = os.path.join(os.path.dirname(__file__), "credentials_PRIVATE.csv")
    rows = []
    for display, email, role, br_code, lang in ROSTER:
        password = f"{secrets.randbelow(900000) + 100000}"  # 6-digit, never leading 0
        user = call(f"{SUPABASE_URL}/auth/v1/admin/users", {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"display_name": display},
        })
        uid = user["id"]
        call(f"{SUPABASE_URL}/rest/v1/profiles", {
            "user_id": uid,
            "display_name": display,
            "role": role,
            "branch_id": branches.get(br_code) if br_code else None,
            "lang": lang,
        })
        rows.append([br_code or "-", display, role, email, password])
        print(f"created {role:5}  {email}")

    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["branch", "name", "role", "email", "password"])
        w.writerows(rows)
    print(f"\n{len(rows)} accounts created. Passwords saved to:\n  {out_path}")
    print("Hand out one line per person. Do NOT commit this file.")


if __name__ == "__main__":
    main()
