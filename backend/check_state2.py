from app.database import get_connection
from datetime import datetime
from zoneinfo import ZoneInfo
conn = get_connection()

rows = conn.execute("SELECT ScheduleId, Recipients, TimeOfDay, Granularity, DayOfWeek, DayOfMonth, Enabled, LastSentDate FROM ScheduledReports ORDER BY ScheduleId DESC").fetchall()
for r in rows:
    print(dict(r))

tr_now = datetime.now(ZoneInfo("Europe/Istanbul"))
print(f"\nŞu anki Türkiye saati: {tr_now.strftime('%H:%M')}, isoweekday: {tr_now.isoweekday()}")

conn.close()
