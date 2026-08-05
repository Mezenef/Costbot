from app.database import get_connection
conn = get_connection()
row = conn.execute("SELECT MIN(UsageDate) AS min_d, MAX(UsageDate) AS max_d, COUNT(*) AS total FROM CloudCosts").fetchone()
print(dict(row))
conn.close()
