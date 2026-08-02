from app.sql_agent import validate_sql


def test_valid_select():
    assert validate_sql("SELECT * FROM CloudCosts") is None


def test_valid_cte():
    assert validate_sql("WITH x AS (SELECT 1) SELECT * FROM x") is None


def test_rejects_insert():
    assert validate_sql("INSERT INTO CloudCosts VALUES (1)") is not None


def test_rejects_drop():
    assert validate_sql("DROP TABLE CloudCosts") is not None


def test_rejects_delete():
    assert validate_sql("DELETE FROM CloudCosts") is not None


def test_rejects_multiple_statements():
    assert validate_sql("SELECT 1; SELECT 2;") is not None


def test_rejects_unknown_table():
    assert validate_sql("SELECT * FROM SecretTable") is not None


def test_empty_sql():
    assert validate_sql("") is not None


def test_rejects_attach():
    assert validate_sql("SELECT * FROM CloudCosts; ATTACH DATABASE 'x' AS y") is not None