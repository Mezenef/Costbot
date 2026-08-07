from app.database import get_connection
conn = get_connection()

row = conn.execute("""
    SELECT COUNT(*) AS row_count, SUM(PreTaxCost) AS total
    FROM CloudCosts WHERE UsageDate = CURRENT_DATE::text
""").fetchone()
print(dict(row))

conn.close()
