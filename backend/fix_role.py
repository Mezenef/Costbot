from app.database import get_connection

conn = get_connection()
conn.executescript("ALTER TABLE Users ADD COLUMN IF NOT EXISTS Role TEXT DEFAULT 'Kullanici';")
print("Role kolonu eklendi.")

rows = conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'").fetchall()
for r in rows:
    print(dict(r))

conn.close()
