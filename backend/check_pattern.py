from app.database import get_connection
conn = get_connection()

rows = conn.execute("""
    SELECT ResourceId, UsageDate, ServiceName, MeterName, Quantity, PreTaxCost, COUNT(*) AS tekrar
    FROM CloudCosts
    WHERE UsageDate = '2026-08-05'
    GROUP BY ResourceId, UsageDate, ServiceName, MeterName, Quantity, PreTaxCost
    HAVING COUNT(*) > 1
    ORDER BY tekrar DESC
    LIMIT 10
""").fetchall()
for r in rows:
    print(dict(r))

conn.close()
