from app.database import get_connection
conn = get_connection()
rows = conn.execute("""
    SELECT UsageDate, COUNT(*) AS row_count, SUM(PreTaxCost) AS total
    FROM CloudCosts
    WHERE UsageDate >= '2026-08-03' AND UsageDate <= '2026-08-07'
    GROUP BY UsageDate ORDER BY UsageDate
""").fetchall()
for r in rows:
    print(dict(r))
conn.close()
