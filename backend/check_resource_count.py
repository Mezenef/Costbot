from app.database import get_connection
conn = get_connection()

row = conn.execute("""
    SELECT
      COUNT(DISTINCT ResourceId) AS by_id,
      COUNT(DISTINCT ResourceName) AS by_name,
      COUNT(DISTINCT ServiceName) AS services,
      COUNT(DISTINCT ResourceGroup) AS groups
    FROM CloudCosts
""").fetchone()
print(dict(row))

conn.close()
