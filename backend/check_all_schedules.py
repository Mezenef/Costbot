from app.database import get_connection
conn = get_connection()
rows = conn.execute("SELECT ScheduleId, Recipients, TimeOfDay, Granularity, DayOfWeek, DayOfMonth, LastSentDate FROM ScheduledReports ORDER BY ScheduleId DESC LIMIT 3").fetchall()
for r in rows:
    print(dict(r))
conn.close()
