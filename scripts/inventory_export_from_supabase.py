"""Export live Supabase inventory back to local JSON (same schema as data/inventory.json).

Usage:
    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_KEY=<service_role key>
    python inventory_export_from_supabase.py              -> data/inventory_from_supabase.json
    python inventory_export_from_supabase.py --overwrite  -> data/inventory.json (replaces backup!)

Voided (undone) transactions are excluded. Balances come straight from the live
items table, so the file always matches what the app shows.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime

def _load_dotenv():
    """Fill missing env vars from ../.env so the script runs with no setup."""
    path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY (env vars or abc-stock/.env) first.")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
OVERWRITE = "--overwrite" in sys.argv
OUT_PATH = os.path.join(DATA_DIR, "inventory.json" if OVERWRITE else "inventory_from_supabase.json")

# Supabase branch code -> JSON branch key (matches the old file)
KEY_FOR = {"ABCYQ": "ABCYQ", "ABCSO": "ABCSO", "ABCHA": "ABCHA", "ABCQQ": "ABCQQ", "LEHONG": "LeHong"}


def get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers={
        "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def get_all(path_base):
    """Page through PostgREST results (default cap is 1000 rows)."""
    rows, offset = [], 0
    while True:
        batch = get(f"{path_base}&offset={offset}&limit=1000")
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        offset += 1000


def dmy(iso):
    return datetime.fromisoformat(iso).strftime("%d/%m/%Y") if iso else ""


def num(x):
    f = float(x)
    return int(f) if f == int(f) else f


def main():
    branches = get("branches?select=id,code")
    catalog = {c["id"]: c for c in get("catalog?select=id,name,unit&limit=1000")}
    items = get_all("items?select=id,branch_id,catalog_id,balance,reorder_point&order=id")
    txs = get_all(
        "transactions?select=id,item_id,type,qty,note,created_at,voided,legacy_tx_id&voided=eq.false&order=created_at,id"
    )

    item_by_id = {i["id"]: i for i in items}
    out = {}
    for b in branches:
        key = KEY_FOR[b["code"]]
        br_items = [i for i in items if i["branch_id"] == b["id"]]
        br_txs = [t for t in txs if item_by_id[t["item_id"]]["branch_id"] == b["id"]]

        last_update = {}
        for t in br_txs:
            last_update[t["item_id"]] = t["created_at"]  # txs are date-ordered

        out[key] = {
            "items": [
                {
                    "name": catalog[i["catalog_id"]]["name"],
                    "unit": catalog[i["catalog_id"]]["unit"],
                    "balance": num(i["balance"]),
                    "last_update": dmy(last_update.get(i["id"])),
                    "reorder_point": num(i["reorder_point"]) if i["reorder_point"] is not None else None,
                }
                for i in sorted(br_items, key=lambda x: catalog[x["catalog_id"]]["name"])
            ],
            "transactions": [
                {
                    "tx_id": t["legacy_tx_id"] if t["legacy_tx_id"] is not None else t["id"],
                    "date": dmy(t["created_at"]),
                    "item": catalog[item_by_id[t["item_id"]]["catalog_id"]]["name"],
                    "type": t["type"],
                    "qty": num(t["qty"]),
                    "unit": catalog[item_by_id[t["item_id"]]["catalog_id"]]["unit"],
                    "note": t["note"] or "",
                }
                for t in br_txs
            ],
        }
        print(f"[{key}] {len(out[key]['items'])} items, {len(out[key]['transactions'])} transactions")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nSaved -> {os.path.abspath(OUT_PATH)}")
    if OVERWRITE:
        print("(overwrote data/inventory.json — old backup replaced by live Supabase data)")


if __name__ == "__main__":
    main()
