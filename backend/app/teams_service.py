"""
teams_service.py
Microsoft Teams'e "Workflows Webhook" üzerinden bildirim gönderir.

ÖNEMLİ GÜNCEL NOT: Teams'in eski "Connectors / Incoming Webhook" sistemi
Mayıs 2026'da Microsoft tarafından TAMAMEN kapatıldı. Yerine Power
Automate tabanlı "Workflows" webhook'ları geldi. İyi haber: Microsoft'un
kendi duyurusuna göre, eski JSON formatı (MessageCard) yeni Workflows
webhook'larında da "drop-in" (aynen) çalışmaya devam ediyor -- bu yüzden
bu modülün kendisi değişmedi, sadece webhook URL'inin ALINDIĞI YER değişti.

WEBHOOK URL NASIL ALINIR (güncel, Mayıs 2026 sonrası):
  Teams kanalı -> "..." (Diğer seçenekler) -> Workflows -> "Bir kanala
  webhook alınca mesaj gönder" şablonunu seç -> webhook URL'ini kopyala
  -> .env dosyasına TEAMS_WEBHOOKS olarak yapıştır.
  (Eski "Connectors" menüsü artık YOK, kafanız karışmasın.)
"""
import os
import json
import requests


class TeamsNotConfiguredError(Exception):
    pass


class TeamsSendError(Exception):
    pass


def get_teams_recipients() -> dict[str, str]:
    """TEAMS_WEBHOOKS .env'de JSON olarak tutulur:
    {"Aleyna": "https://...", "Mentor": "https://..."}
    -- her biri, Teams tarafında o kişiyle "Flow bot" sohbetine kurulmuş
    ayrı bir Workflows webhook'u. Boş/hatalıysa sessizce boş sözlük döner."""
    raw = os.getenv("TEAMS_WEBHOOKS", "{}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def send_teams_notification(webhook_url: str, title: str, message_lines: list[str], color: str = "0078D4") -> None:
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": color,
        "summary": title,
        "sections": [
            {
                "activityTitle": f"**{title}**",
                "text": "<br>".join(message_lines),
            }
        ],
    }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=10)
        if resp.status_code >= 300:
            raise TeamsSendError(f"Teams bildirimi gönderilemedi: HTTP {resp.status_code}")
    except requests.RequestException as e:
        raise TeamsSendError(f"Teams bildirimi gönderilemedi: {e}")