from app.forecast import _confidence_score


def test_confidence_low_with_little_data():
    assert _confidence_score([100.0]) == 30.0


def test_confidence_reasonable_with_stable_data():
    score = _confidence_score([100.0] * 14)
    assert score > 50


def test_confidence_zero_mean():
    assert _confidence_score([0.0, 0.0]) == 30.0


def test_confidence_bounded():
    score = _confidence_score([1.0, 1000.0, 1.0, 1000.0])
    assert 20.0 <= score <= 95.0