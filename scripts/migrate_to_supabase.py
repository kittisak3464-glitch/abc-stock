"""Migrate data/inventory.json -> Supabase (one-time, Phase 1).

Usage:
    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_KEY=<service_role key>
    python migrate_to_supabase.py

Idempotency: aborts if catalog already has rows (won't double-migrate).
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables first.")

JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "inventory.json")
BRANCH_CODE = {"ABCYQ": "ABCYQ", "ABCSO": "ABCSO", "ABCHA": "ABCHA", "ABCQQ": "ABCQQ", "LeHong": "LEHONG"}
BKK = timezone(timedelta(hours=7))

# Outstanding cross-group loans carried over from the old system (design doc §5)
INITIAL_LOANS = [
    ("ABCYQ", "LEHONG", "Shower Gel", 500, "Migrated outstanding loan: LeHong owes ABCYQ"),
    ("ABCYQ", "LEHONG", "Toilet Tissue", 12, "Migrated outstanding loan: LeHong owes ABCYQ (1 box)"),
    ("LEHONG", "ABCHA", "Drinking Water", 300, "Migrated outstanding loan: ABCHA owes LeHong (25 packs)"),
    ("ABCQQ", "ABCSO", "Drinking Water", 120, "Migrated outstanding loan: ABCSO owes ABCQQ"),
]


def api(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{params}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        print("SERVER ERROR:", e.read().decode("utf-8", "replace")[:500])
        raise


def parse_date(d):
    """Tolerant D/M/YYYY parser -> ISO timestamp at 12:00 Bangkok; unusable -> None.

    Handles sloppy legacy formats: '3/7/2026', '3/7' (no year -> 2026),
    '7/2026' (month/year only -> day 1), '3/6/20226' (typo year -> 2026).
    """
    d = (d or "").strip()
    if not d:
        return None
    parts = d.split("/")
    try:
        if len(parts) == 3:
            day, month, year = (int(p) for p in parts)
        elif len(parts) == 2 and len(parts[1]) == 4:
            day, month, year = 1, int(parts[0]), int(parts[1])
        elif len(parts) == 2:
            day, month, year = int(parts[0]), int(parts[1]), 2026
        else:
            return None
        if year > 2100:  # e.g. 20226 typo
            year = int("20" + str(year)[-2:])
        return datetime(year, month, day, 12, 0, tzinfo=BKK).isoformat()
    except ValueError:
        return None


def main():
    data = json.load(open(JSON_PATH, encoding="utf-8"))

    if api("GET", "catalog", params="?select=id&limit=1"):
        sys.exit("catalog table is not empty — already migrated? Aborting to avoid duplicates.")

    branches = {b["code"]: b["id"] for b in api("GET", "branches", params="?select=id,code")}
    if len(branches) != 5:
        sys.exit("branches table not seeded — run supabase/schema.sql first.")

    # 1) catalog: union of item names across branches (first-seen unit wins;
    #    Trash Bag kg/pack conflict is fine — 1 pack = 1 kg by convention)
    catalog = {}
    for br in data.values():
        for it in br["items"]:
            catalog.setdefault(it["name"], it["unit"])
    rows = api("POST", "catalog", [{"name": n, "unit": u} for n, u in sorted(catalog.items())])
    cat_id = {r["name"]: r["id"] for r in rows}
    print(f"catalog: {len(rows)} items")

    # 2) items per branch (balance set to 0 here; real balance comes from a
    #    baseline adjustment below so trigger math always reconciles)
    item_rows = []
    for br_key, br in data.items():
        bid = branches[BRANCH_CODE[br_key]]
        for it in br["items"]:
            item_rows.append({
                "branch_id": bid,
                "catalog_id": cat_id[it["name"]],
                "balance": 0,
                "reorder_point": it.get("reorder_point"),
            })
    inserted = api("POST", "items", item_rows)
    item_id = {(r["branch_id"], r["catalog_id"]): r["id"] for r in inserted}
    print(f"items: {len(inserted)} rows")

    # 3) transactions with original dates (history), then one baseline
    #    adjustment per item so final balance == old JSON balance exactly.
    total_tx = 0
    for br_key, br in data.items():
        bid = branches[BRANCH_CODE[br_key]]
        tx_rows = []
        net = {}
        skipped_zero = 0
        for tx in br["transactions"]:
            iid = item_id.get((bid, cat_id.get(tx["item"], -1)))
            if iid is None:
                print(f"  WARN {br_key}: transaction for unknown item '{tx['item']}' skipped")
                continue
            if not tx.get("qty") or tx["qty"] <= 0:
                skipped_zero += 1  # zero-qty placeholder rows don't affect balances
                continue
            if tx.get("type") not in ("in", "out"):
                # 3 legacy ABCQQ rows have blank type, all "we take from ABCYQ" = stock in
                print(f"  WARN {br_key}: tx {tx.get('tx_id')} blank type -> 'in' ({tx.get('note', '')})")
                tx["type"] = "in"
            sign = 1 if tx["type"] == "in" else -1
            net[iid] = net.get(iid, 0) + sign * tx["qty"]
            tx_rows.append({
                "item_id": iid,
                "type": tx["type"],
                "qty": tx["qty"],
                "note": tx.get("note") or None,
                "created_at": parse_date(tx.get("date")) or datetime.now(BKK).isoformat(),
                "legacy_tx_id": tx.get("tx_id"),
            })
        for i in range(0, len(tx_rows), 500):
            api("POST", "transactions", tx_rows[i:i + 500])
        total_tx += len(tx_rows)

        # baseline: old balance minus what history already accounts for
        base_rows = []
        for it in br["items"]:
            iid = item_id[(bid, cat_id[it["name"]])]
            diff = it["balance"] - net.get(iid, 0)
            if diff != 0:
                base_rows.append({
                    "item_id": iid,
                    "type": "in" if diff > 0 else "out",
                    "qty": abs(diff),
                    "note": "Opening balance (migrated)",
                    "created_at": parse_date(it.get("last_update")) or datetime.now(BKK).isoformat(),
                })
        if base_rows:
            api("POST", "transactions", base_rows)
            total_tx += len(base_rows)
        note = f" (skipped {skipped_zero} zero-qty placeholder rows)" if skipped_zero else ""
        print(f"transactions [{br_key}]: done{note}")
    print(f"transactions total: {total_tx}")

    # 4) outstanding loans
    loans = [{
        "from_branch": branches[f], "to_branch": branches[t],
        "catalog_id": cat_id[item], "qty": qty,
        "kind": "loan", "status": "pending_return", "note": note,
        "received_at": datetime.now(BKK).isoformat(),
    } for f, t, item, qty, note in INITIAL_LOANS]
    api("POST", "transfers", loans)
    print(f"loans: {len(loans)} pending_return")

    # 5) verify balances against old JSON
    live = api("GET", "items", params="?select=id,balance&limit=1000")
    live_bal = {r["id"]: r["balance"] for r in live}
    bad = 0
    for br_key, br in data.items():
        bid = branches[BRANCH_CODE[br_key]]
        for it in br["items"]:
            got = float(live_bal[item_id[(bid, cat_id[it["name"]])]])
            if got != float(it["balance"]):
                print(f"  MISMATCH {br_key}/{it['name']}: json={it['balance']} db={got}")
                bad += 1
    print("VERIFY: all balances match ✔" if bad == 0 else f"VERIFY: {bad} mismatches ✘")


if __name__ == "__main__":
    main()
