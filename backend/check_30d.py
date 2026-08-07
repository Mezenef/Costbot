from app.database import get_connection
conn = get_connection()

max_row = conn.execute("SELECT MAX(UsageDate)::date AS max_d FROM CloudCosts").fetchone()
max_d = max_row["max_d"]
print(f"Veri setinin son günü: {max_d}")

row = conn.execute("""
    SELECT
      SUM(CASE WHEN UsageDate::date > %s::date - INTERVAL '30 days' THEN PreTaxCost ELSE 0 END) AS current_30d,
      SUM(CASE WHEN UsageDate::date <= %s::date - INTERVAL '30 days' AND UsageDate::date > %s::date - INTERVAL '60 days' THEN PreTaxCost ELSE 0 END) AS previous_30d
    FROM CloudCosts
""".replace("%s", f"'{max_d}'")).fetchone()
print(dict(row))

pct = (row["current_30d"] - row["previous_30d"]) / row["previous_30d"] * 100
print(f"Yüzde değişim: {pct:.2f}%")

conn.close()
