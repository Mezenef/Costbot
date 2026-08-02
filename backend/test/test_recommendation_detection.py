from app.sql_agent import _is_recommendation_question


def test_detects_turkish_keywords():
    assert _is_recommendation_question("Maliyetlerimi nasıl azaltabilirim?") is True


def test_detects_english_keywords():
    assert _is_recommendation_question("How can I reduce costs?") is True


def test_non_recommendation_question():
    assert _is_recommendation_question("Toplam maliyetim nedir?") is False


def test_short_affirmative_with_recommendation_context():
    prev = "...5 öneri üretildi... ➡️ Sonraki Adım\nBaşka bir kaynak için de öneri görmek ister misiniz?"
    assert _is_recommendation_question("tamam", prev) is True


def test_short_affirmative_without_context():
    assert _is_recommendation_question("tamam", None) is False


def test_independent_question_not_affected_by_context():
    prev = "...Sonraki Adım..."
    assert _is_recommendation_question("toplam maliyetim nedir", prev) is False