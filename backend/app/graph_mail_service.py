"""
graph_mail_service.py
Microsoft Graph API (Delegated Mail.Send izniyle) üzerinden e-posta
gönderir. Önce app/graph_mail_setup.py BİR KERE çalıştırılıp token
önbelleği oluşturulmuş olmalı (bkz. o dosyanın üst yorumu).

SMTP'den farkı: gönderim, gerçek bir kurumsal Microsoft 365 kiracısı
(sabancidx.com) üzerinden, Microsoft'un kendi büyük/itibarlı sunucu
ağı kullanılarak yapılıyor -- bu, kurumsal alıcılara teslimat
ihtimalini kişisel Gmail SMTP'sine göre önemli ölçüde artırabilir
(garanti değil, ama çok daha güçlü bir temel).
"""
import os
from pathlib import Path
import msal
import requests

CLIENT_ID = os.getenv("GRAPH_CLIENT_ID")
TENANT_ID = os.getenv("GRAPH_TENANT_ID")
CACHE_PATH = Path(__file__).parent.parent / "data" / "graph_token_cache.bin"
SCOPES = ["Mail.Send"]


class GraphMailNotConfiguredError(Exception):
    pass


class GraphMailSendError(Exception):
    pass


def _get_access_token() -> str:
    if not CLIENT_ID or not TENANT_ID:
        raise GraphMailNotConfiguredError("GRAPH_CLIENT_ID / GRAPH_TENANT_ID .env dosyasında tanımlı değil.")
    if not CACHE_PATH.exists():
        raise GraphMailNotConfiguredError(
            "Token önbelleği bulunamadı. Önce 'python -m app.graph_mail_setup' komutunu bir kere çalıştırın."
        )

    cache = msal.SerializableTokenCache()
    cache.deserialize(CACHE_PATH.read_text())

    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        token_cache=cache,
    )

    accounts = app.get_accounts()
    if not accounts:
        raise GraphMailNotConfiguredError(
            "Önbellekte kayıtlı hesap yok. 'python -m app.graph_mail_setup' komutunu tekrar çalıştırın."
        )

    result = app.acquire_token_silent(SCOPES, account=accounts[0])
    if not result or "access_token" not in result:
        raise GraphMailNotConfiguredError(
            "Token sessizce yenilenemedi (muhtemelen süresi dolmuş). "
            "'python -m app.graph_mail_setup' komutunu tekrar çalıştırın."
        )

    if cache.has_state_changed:
        CACHE_PATH.write_text(cache.serialize())

    return result["access_token"]


def send_graph_mail(to_email: str, subject: str, body_html: str) -> None:
    access_token = _get_access_token()

    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": "true",
    }

    try:
        resp = requests.post(
            "https://graph.microsoft.com/v1.0/me/sendMail",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if resp.status_code >= 300:
            raise GraphMailSendError(f"Graph API e-posta gönderilemedi: HTTP {resp.status_code} - {resp.text[:300]}")
    except requests.RequestException as e:
        raise GraphMailSendError(f"Graph API e-posta gönderilemedi: {e}")