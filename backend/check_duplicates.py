from app.database import get_connection
conn = get_connection()

row = conn.execute("""
    SELECT COUNT(*) AS total_rows,
           COUNT(DISTINCT (ResourceId, UsageDate, MeterName, ChargeType)) AS unique_rows
    FROM CloudCosts
    WHERE UsageDate >= '2026-07-31' AND UsageDate <= '2026-08-07'
""").fetchone()
print(dict(row))

conn.close()
