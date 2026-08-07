from app.database import get_connection
conn = get_connection()
rows = conn.execute("SELECT * FROM SyncLog ORDER BY SyncId DESC LIMIT 5").fetchall()
for r in rows:
    print(dict(r))
conn.close()
