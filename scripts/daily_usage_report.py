"""Daily stock-usage summary across all branches, from live Supabase data.

Usage:
    python daily_usage_report.py                 -> today (Bangkok time)
    python daily_usage_report.py 2026-07-31       -> specific date

"Usage" = Stock Out entries only (transfer_id is null) — sending stock to
another branch or receiving one is not "usage", so those are excluded.
Also excludes rows with no created_by (legacy/migrated corrections with a
missing original date got stamped with the migration run date, which would
otherwise falsely show up as "today").
Reads SUPABASE_URL/SUPABASE_SERVICE_KEY from abc-stock/.env automatically.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

BKK = timezone(timedelta(hours=7))


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


def get_all(path):
    rows, offset = [], 0
    while True:
        req = urllib.request.Request(f"{URL}/rest/v1/{path}&offset={offset}&limit=1000",
            headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
        with urllib.request.urlopen(req) as r:
            batch = json.loads(r.read())
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        offset += 1000


def main():
    if len(sys.argv) > 1:
        day = datetime.strptime(sys.argv[1], "%Y-%m-%d").replace(tzinfo=BKK)
    else:
        day = datetime.now(BKK).replace(hour=0, minute=0, second=0, microsecond=0)
    start = urllib.parse.quote(day.isoformat())
    end = urllib.parse.quote((day + timedelta(days=1)).isoformat())

    branches = {b["id"]: b["name"] for b in get_all("branches?select=id,name")}
    items = {i["id"]: i for i in get_all("items?select=id,branch_id,catalog_id&limit=1000")}
    catalog = {c["id"]: c for c in get_all("catalog?select=id,name,unit&limit=1000")}

    txs = get_all(
        "transactions?select=item_id,qty,created_at"
        f"&type=eq.out&voided=eq.false&transfer_id=is.null&created_by=not.is.null"
        f"&created_at=gte.{start}&created_at=lt.{end}"
    )

    usage = {}  # branch_name -> {item_name: (qty, unit)}
    for tx in txs:
        it = items.get(tx["item_id"])
        if not it:
            continue
        cat = catalog[it["catalog_id"]]
        bname = branches[it["branch_id"]]
        bucket = usage.setdefault(bname, {})
        qty, unit = bucket.get(cat["name"], (0, cat["unit"]))
        bucket[cat["name"]] = (qty + float(tx["qty"]), unit)

    date_th = day.strftime("%d/%m/%Y")
    print(f"📦 สรุปการใช้ของประจำวัน {date_th}\n")

    for bname in sorted(branches.values()):
        items_used = usage.get(bname)
        print(f"🏨 {bname}")
        if not items_used:
            print("• ไม่มีการใช้ของวันนี้")
        else:
            for name, (qty, unit) in sorted(items_used.items()):
                q = int(qty) if qty == int(qty) else qty
                print(f"• {name} {q} {unit}")
        print()


if __name__ == "__main__":
    main()
