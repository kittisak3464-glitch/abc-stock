"""Reset an ABC Stock user's password to a fresh random 6-digit number.

Usage:
    python reset_password.py <email or part of name>
    e.g.  python reset_password.py moiuk
          python reset_password.py arjun.qq@abcstock.app

Reads keys from abc-stock/.env automatically. If the user is listed in
credentials_PRIVATE.csv, that row is updated too so the file stays accurate.
"""
import csv
import json
import os
import secrets
import sys
import urllib.request


def _load_dotenv():
    path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not URL or not KEY:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY (env vars or abc-stock/.env) first.")

CSV_PATH = os.path.join(os.path.dirname(__file__), "credentials_PRIVATE.csv")


def api(path, body=None, method=None):
    req = urllib.request.Request(f"{URL}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method or ("POST" if body is not None else "GET"),
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    query = sys.argv[1].strip().lower()

    users = api("/auth/v1/admin/users?per_page=200").get("users", [])
    matches = [u for u in users
               if query in u["email"].lower()
               or query in (u.get("user_metadata", {}).get("display_name", "")).lower()]

    if not matches:
        sys.exit(f"No user matching '{query}'. Try part of the email, e.g. 'moiuk' or 'arjun.qq'.")
    if len(matches) > 1:
        print(f"'{query}' matches {len(matches)} users — be more specific:")
        for u in matches:
            print("  -", u["email"], f"({u.get('user_metadata', {}).get('display_name', '')})")
        sys.exit(1)

    user = matches[0]
    new_pw = f"{secrets.randbelow(900000) + 100000}"
    api(f"/auth/v1/admin/users/{user['id']}", {"password": new_pw}, method="PUT")

    name = user.get("user_metadata", {}).get("display_name", "")
    print("Password reset OK")
    print(f"  name    : {name}")
    print(f"  email   : {user['email']}")
    print(f"  password: {new_pw}")

    # keep the credentials file accurate if this user is listed there
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
        changed = False
        for row in rows[1:]:
            if len(row) >= 5 and row[3].lower() == user["email"].lower():
                row[4] = new_pw
                changed = True
        if changed:
            try:
                with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
                    csv.writer(f).writerows(rows)
                print("  credentials_PRIVATE.csv updated")
            except PermissionError:
                print("  WARNING: could not update credentials_PRIVATE.csv (file is open in Excel?)")
                print("           close it and note the new password manually, or rerun this script.")


if __name__ == "__main__":
    main()
