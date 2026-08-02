from app.database import get_connection
conn = get_connection()

print("=== SUBSCRIPTIONS ===")
for r in conn.execute("SELECT DISTINCT SubscriptionId, SubscriptionName FROM CloudCosts").fetchall():
    print(dict(r))

print()
print("=== TARIH ARALIGI ===")
r = conn.execute("SELECT MIN(UsageDate), MAX(UsageDate), COUNT(DISTINCT UsageDate) FROM CloudCosts").fetchone()
print("En eski:", r[0], "| En yeni:", r[1], "| Farkli gun sayisi:", r[2])

print()
print("=== RESOURCE GROUP SAYISI ===")
r = conn.execute("SELECT COUNT(DISTINCT ResourceGroup) FROM CloudCosts").fetchone()
print("Toplam resource group:", r[0])

print()
print("=== SERVIS LISTESI (ServiceName) ===")
for r in conn.execute("SELECT DISTINCT ServiceName FROM CloudCosts ORDER BY ServiceName").fetchall():
    print("-", r[0])

print()
print("=== TOPLAM KAYNAK SAYISI ===")
r = conn.execute("SELECT COUNT(DISTINCT ResourceId) FROM CloudCosts").fetchone()
print("Toplam benzersiz kaynak:", r[0])

print()
print("=== BOLGE LISTESI (ResourceLocation) ===")
for r in conn.execute("SELECT DISTINCT ResourceLocation FROM CloudCosts WHERE ResourceLocation IS NOT NULL AND ResourceLocation != '' ORDER BY ResourceLocation").fetchall():
    print("-", r[0])

print()
print("=== TOPLAM SATIR SAYISI ===")
r = conn.execute("SELECT COUNT(*) FROM CloudCosts").fetchone()
print(r[0])

conn.close()