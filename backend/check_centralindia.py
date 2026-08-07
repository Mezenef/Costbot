from app.database import get_connection
conn = get_connection()

rows = conn.execute("""
    SELECT DISTINCT ResourceName, ServiceName, ResourceGroup
    FROM CloudCosts
    WHERE ResourceLocation = 'centralindia'
    ORDER BY ServiceName
""").fetchall()
for r in rows:
    print(f"{r['servicename']} -- {r['resourcename']} -- {r['resourcegroup']}")

conn.close()
