from datetime import datetime
from zoneinfo import ZoneInfo

utc_now = datetime.now(ZoneInfo("UTC"))
tr_now = datetime.now(ZoneInfo("Europe/Istanbul"))
local_now = datetime.now()

print(f"VM yerel saati (dilimsiz): {local_now.strftime('%H:%M:%S')}")
print(f"UTC:                       {utc_now.strftime('%H:%M:%S')}")
print(f"Türkiye (hesaplanan):      {tr_now.strftime('%H:%M:%S')}")
