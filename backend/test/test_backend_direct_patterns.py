from app.sql_agent import _normalize_question, _BACKEND_DIRECT_PATTERNS


def match_intent(question):
    normalized = _normalize_question(question)
    for pattern, name in _BACKEND_DIRECT_PATTERNS:
        if pattern.match(normalized):
            return name
    return None


def test_total_cost_pattern():
    assert match_intent("Toplam maliyetim nedir?") == "total_cost"


def test_does_not_match_with_extra_words():
    assert match_intent("Geçen ayki toplam maliyetim nedir?") is None


def test_top_service_pattern():
    assert match_intent("En pahalı servis hangisi?") == "top_service"


def test_resource_count_pattern():
    assert match_intent("Kaç kaynağım var?") == "resource_count"


def test_english_total_cost_pattern():
    assert match_intent("What is my total cost?") == "total_cost"