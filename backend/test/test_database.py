from app.database import load_from_azure


def test_incremental_load_preserves_history(memory_db):
    historical = [{"UsageDate": "2026-01-15", "ServiceName": "VM", "PreTaxCost": 100.0}]
    load_from_azure(memory_db, historical)

    daily = [{"UsageDate": "2026-07-20", "ServiceName": "Storage", "PreTaxCost": 50.0}]
    load_from_azure(memory_db, daily, start_date="2026-07-01", end_date="2026-07-29")

    rows = memory_db.execute("SELECT UsageDate FROM CloudCosts").fetchall()
    dates = [r["UsageDate"] for r in rows]
    assert "2026-01-15" in dates
    assert "2026-07-20" in dates


def test_incremental_load_replaces_only_window(memory_db):
    load_from_azure(memory_db, [{"UsageDate": "2026-07-05", "ServiceName": "Storage", "PreTaxCost": 50.0}],
                     start_date="2026-07-01", end_date="2026-07-29")
    load_from_azure(memory_db, [{"UsageDate": "2026-07-05", "ServiceName": "Storage", "PreTaxCost": 55.0}],
                     start_date="2026-07-01", end_date="2026-07-29")

    rows = memory_db.execute("SELECT PreTaxCost FROM CloudCosts WHERE UsageDate = '2026-07-05'").fetchall()
    assert len(rows) == 1
    assert rows[0]["PreTaxCost"] == 55.0