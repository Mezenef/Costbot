from app.sql_agent import _build_context_rows


def test_small_dataset_returns_all():
    data = [{"ServiceName": f"S{i}"} for i in range(17)]
    assert len(_build_context_rows(data, limit=15)) == 17


def test_large_dataset_respects_limit():
    data = [{"ServiceName": f"S{i}"} for i in range(100)]
    assert len(_build_context_rows(data, limit=15)) == 15


def test_balanced_type_sampling():
    data = [{"Type": "Category", "N": i} for i in range(29)] + [{"Type": "Service", "N": i} for i in range(29)]
    result = _build_context_rows(data, limit=15)
    cats = sum(1 for r in result if r["Type"] == "Category")
    svcs = sum(1 for r in result if r["Type"] == "Service")
    assert cats > 0 and svcs > 0


def test_empty_data():
    assert _build_context_rows([], limit=15) == []