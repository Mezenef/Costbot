from app.azure_cost_fetcher import _resolve_column, _normalize_date


def test_resolve_column_finds_alias():
    headers = ["Date", "SubscriptionId", "ConsumedService"]
    assert _resolve_column(headers, "UsageDate") == "Date"
    assert _resolve_column(headers, "ServiceName") == "ConsumedService"


def test_resolve_column_missing():
    assert _resolve_column(["Foo"], "UsageDate") is None


def test_normalize_date_iso():
    assert _normalize_date("2026-06-15") == "2026-06-15"


def test_normalize_date_us_format():
    assert _normalize_date("07/28/2026") == "2026-07-28"


def test_normalize_date_invalid_fallback():
    assert _normalize_date("garbage!!") == "garbage!!"[:10]