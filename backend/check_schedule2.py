from app.database import get_connection
conn = get_connection()

row = conn.execute("SELECT ScheduleId, TimeOfDay, DayOfWeek, DayOfMonth, Granularity, Enabled, LastSentDate, Recipients FROM ScheduledReports WHERE ScheduleId = 4").fetchone()
print(dict(row))

conn.close()
