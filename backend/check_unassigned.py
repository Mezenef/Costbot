from app.database import get_connection
conn = get_connection()
rows = conn.execute("SELECT DISTINCT ResourceName, ServiceName FROM CloudCosts WHERE ResourceLocation = 'Unassigned'").fetchall()
for r in rows:
    print(f"{r['resourcename']} -- {r['servicename']}")
conn.close()
