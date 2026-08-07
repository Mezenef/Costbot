from app.database import get_connection
conn = get_connection()
row = conn.execute("SELECT SUM(PreTaxCost) AS today_total, COUNT(*) AS row_count FROM CloudCosts WHERE UsageDate = '2026-08-05'").fetchone()
print(dict(row))
conn.close()
