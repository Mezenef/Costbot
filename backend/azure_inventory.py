from app.database import get_connection
conn = get_connection()

print("=== SERVISLER ===")
rows = conn.execute("SELECT ServiceName, COUNT(DISTINCT ResourceName) AS resource_count, SUM(PreTaxCost) AS total FROM CloudCosts GROUP BY ServiceName ORDER BY total DESC").fetchall()
for r in rows:
    print(f"{r['servicename']}: {r['resource_count']} kaynak, ${r['total']:,.2f}")

print()
print("=== RESOURCE GROUPLAR ===")
row = conn.execute("SELECT COUNT(DISTINCT ResourceGroup) AS c FROM CloudCosts").fetchone()
print(f"Toplam: {row['c']}")

print()
print("=== BOLGELER ===")
rows = conn.execute("SELECT ResourceLocation, COUNT(DISTINCT ResourceName) AS c FROM CloudCosts GROUP BY ResourceLocation ORDER BY c DESC").fetchall()
for r in rows:
    print(f"{r['resourcelocation']}: {r['c']} kaynak")

print()
print("=== GENEL TOPLAM ===")
row = conn.execute("SELECT COUNT(DISTINCT ResourceName) AS resources, COUNT(DISTINCT ServiceName) AS services, COUNT(DISTINCT ResourceGroup) AS groups, COUNT(DISTINCT ResourceLocation) AS regions, SUM(PreTaxCost) AS total_cost, MIN(UsageDate) AS min_d, MAX(UsageDate) AS max_d FROM CloudCosts").fetchone()
print(dict(row))

conn.close()
