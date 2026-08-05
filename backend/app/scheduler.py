"""
scheduler.py
Saatte bir çalışan arka plan görevi -- yeni bir maliyet artışı (spike)
tespit edilince otomatik olarak e-posta + Teams bildirimi gönderir.
Aynı artış için TEKRAR bildirim GÖNDERMEZ (AlertHistory tablosunda
kaydı tutuluyor, ServiceName+Period eşsiz anahtar).

Başlangıç senkronizasyonu notu: start_scheduler() artık _daily_job()'u
sadece "sync_hours saat sonra" değil, backend her başladığında da HEMEN
(next_run_time=datetime.now()) bir kez tetikliyor -- bu, APScheduler'ın
KENDİ arka plan iş parçacığında çalıştığı için FastAPI'nin başlangıcını
BLOKLAMAZ (API hemen kullanılabilir olur, senkronizasyon arka planda
ilerler). Aksi hâlde, geliştirme sırasında backend sık sık yeniden
başlatıldığında (ör. kod değişikliği sonrası), 24 saatlik sayaç hiç
dolma fırsatı bulamıyor, veri günlerce eskiyebiliyordu (kullanıcı
testinde bulunan gerçek durum -- Dashboard'daki "Bugünkü Maliyet"
kartı, gerçek bugünün 1 gün gerisinde kalmıştı).
"""
import os
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

from .database import get_connection
from .dashboard import get_dashboard_summary
from .email_service import send_cost_alert_email, EmailNotConfiguredError, EmailSendError
from .teams_service import send_teams_notification, get_teams_recipients, TeamsNotConfiguredError, TeamsSendError
from .forecast import get_cost_forecast

logger = logging.getLogger("costbot.scheduler")


def _already_notified(service_name: str, period: str) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT 1 FROM AlertHistory WHERE ServiceName = ? AND Period = ?",
        (service_name, period),
    ).fetchone()
    conn.close()
    return row is not None


def _log_notified(service_name: str, period: str, change_pct: float) -> None:
    conn = get_connection()
    conn.execute(
        "INSERT INTO AlertHistory (ServiceName, Period, ChangePct) VALUES (?, ?, ?)",
        (service_name, period, change_pct),
    )
    conn.commit()
    conn.close()


def _check_forecast_threshold() -> None:
    """Her kullanıcının KENDİ belirlediği bütçe eşiğini (Users.BudgetThreshold)
    kontrol eder. Tahmini ay sonu maliyeti bir kullanıcının eşiğini aşarsa,
    O KULLANICIYA e-posta gönderir -- ayrıca kullanıcının kendi Teams webhook'u
    (Users.TeamsWebhookUrl) tanımlıysa, oraya da bildirim gönderir. Aynı
    kullanıcı için aynı ay içinde SADECE BİR KEZ bildirir."""
    try:
        data = get_cost_forecast(language="tr")
    except Exception as e:
        logger.error("Forecast eşik kontrolü başarısız: %s", e)
        return

    if not data.get("available"):
        return

    estimated = data["estimated_month_end"]
    period = data["current_month"]

    conn = get_connection()
    users = conn.execute(
        'SELECT UserId AS "UserId", FullName AS "FullName", Email AS "Email", '
        'BudgetThreshold AS "BudgetThreshold", TeamsWebhookUrl AS "TeamsWebhookUrl" '
        'FROM Users WHERE BudgetThreshold IS NOT NULL'
    ).fetchall()
    conn.close()

    for user in users:
        threshold = user["BudgetThreshold"]
        if threshold is None or estimated < threshold:
            continue

        marker = f"__FORECAST_THRESHOLD__:{user['UserId']}"
        if _already_notified(marker, period):
            continue

        try:
            send_cost_alert_email(
                user["Email"], user["FullName"], "Ay Sonu Tahmini Eşik Aşımı",
                data.get("trend_pct") or 0, estimated,
            )
            logger.info("Tahmin eşik aşımı e-postası gönderildi: %s (%s, eşik: %s)", user["Email"], period, threshold)
        except (EmailNotConfiguredError, EmailSendError) as e:
            logger.warning("Otomatik eşik e-postası gönderilemedi (%s): %s", user["Email"], e)

        webhook_url = user["TeamsWebhookUrl"]
        if webhook_url:
            message = (
                f"Tahmini ay sonu maliyetiniz ({period}) ${estimated:,.2f} ile "
                f"belirlediğiniz ${threshold:,.2f} eşiğini aştı."
            )
            try:
                send_teams_notification(webhook_url, "CostBot Tahmin Uyarısı", [message])
                logger.info("Tahmin eşik aşımı Teams bildirimi gönderildi: %s (%s)", user["Email"], period)
            except (TeamsNotConfiguredError, TeamsSendError) as e:
                logger.warning("Otomatik eşik Teams bildirimi gönderilemedi (%s): %s", user["Email"], e)

        _log_notified(marker, period, estimated)

def _sync_azure_data() -> None:
    """Günde bir kez (varsayılan), gerçek Azure Cost Management verisini
    yeniden çeker ve CloudCosts tablosunu günceller. Azure kimlik bilgileri
    .env'de tanımlı değilse (ör. mock veriyle çalışılan bir ortamda),
    sessizce atlanır -- hata olarak sayılmaz."""
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")

    if not all([tenant_id, client_id, client_secret, subscription_id]):
        return

    try:
        from .azure_cost_fetcher import fetch_azure_cost_rows
        from .database import load_from_azure

        days = int(os.getenv("AZURE_SYNC_DAYS", "30"))
        rows = fetch_azure_cost_rows(tenant_id, client_id, client_secret, subscription_id, days=days)

        from datetime import date, timedelta
        end_date = date.today().isoformat()
        start_date = (date.today() - timedelta(days=days)).isoformat()

        conn = get_connection()
        stats = load_from_azure(conn, rows, start_date=start_date, end_date=end_date)
        conn.close()

        logger.info("Azure verisi otomatik güncellendi: %s satır yüklendi.", stats["inserted"])
    except Exception as e:
        logger.error("Otomatik Azure veri senkronizasyonu başarısız: %s", e)


def check_and_notify() -> None:
    """APScheduler tarafından saatte bir çağrılır (ya da /alerts/check-now
    ile elle tetiklenebilir). Hem servis bazlı ani artışları HEM DE
    tahmini ay sonu eşik aşımını kontrol eder -- ikisi BİRBİRİNDEN
    BAĞIMSIZ, biri diğerini engellemez."""
    try:
        summary = get_dashboard_summary(language="tr", user_id=None)
        period = summary.get("current_month") or "bilinmiyor"
        new_spikes = [s for s in summary["cost_spikes"] if not _already_notified(s["service_name"], period)]
    except Exception as e:
        logger.error("Zamanlanmış kontrol başarısız (dashboard verisi alınamadı): %s", e)
        new_spikes = []

    if new_spikes:
        notify_email = os.getenv("ALERT_NOTIFY_EMAIL")
        notify_name = os.getenv("ALERT_NOTIFY_NAME", "Kullanıcı")
        teams_recipient_key = os.getenv("TEAMS_AUTO_ALERT_RECIPIENT")
        teams_webhook = get_teams_recipients().get(teams_recipient_key) if teams_recipient_key else None

        for spike in new_spikes:
            if notify_email:
                try:
                    send_cost_alert_email(notify_email, notify_name, spike["service_name"], spike["change_pct"], spike["current_total"])
                except (EmailNotConfiguredError, EmailSendError) as e:
                    logger.warning("Otomatik e-posta gönderilemedi (%s): %s", spike["service_name"], e)

            if teams_webhook:
                try:
                    send_teams_notification(
                        teams_webhook, "CostBot Otomatik Maliyet Uyarısı",
                        [f"**{spike['service_name']}**: %{spike['change_pct']} artış, güncel maliyet ${spike['current_total']:,.2f}"],
                    )
                except (TeamsNotConfiguredError, TeamsSendError) as e:
                    logger.warning("Otomatik Teams bildirimi gönderilemedi (%s): %s", spike["service_name"], e)

            _log_notified(spike["service_name"], period, spike["change_pct"])
            logger.info("Otomatik uyarı gönderildi: %s (%s)", spike["service_name"], period)

    # Tahmin esik kontrolu -- spike olsun olmasin HER ZAMAN calisir
    _check_forecast_threshold()


_scheduler = None


def _daily_job() -> None:
    """Günde bir kez: önce Azure verisini güncelle, HEMEN ARDINDAN o taze
    veri üzerinden uyarı kontrolü yap. İkisini AYRI zamanlayıcılara
    bölmüyoruz -- aksi hâlde uyarı kontrolü, veri henüz güncellenmeden
    (eski veri üzerinden) çalışabilir, bu da anlamsız/gereksiz olurdu."""
    _sync_azure_data()
    check_and_notify()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()

    sync_hours = int(os.getenv("AZURE_SYNC_INTERVAL_HOURS", "24"))
    # NOT: "next_run_time=datetime.now()" (backend her başladığında hemen
    # senkronize etme) GERİ ALINDI -- geliştirme sırasında kod üzerinde
    # sık değişiklik yapılırken, her backend yeniden başlatmasında Azure'a
    # istek gitmesi, hız sınırına (429) daha sık takılmaya neden oluyordu.
    # Şimdilik normal "interval" davranışına dönüldü: ilk çalıştırma,
    # backend açıldıktan "sync_hours" saat SONRA gerçekleşir.
    _scheduler.add_job(_daily_job, "interval", hours=sync_hours)

    _scheduler.start()
    print(f"[scheduler] Zamanlanmış görev başlatıldı ({sync_hours} saatte bir: Azure senkronizasyonu + uyarı kontrolü).")
    logger.info("Zamanlanmış görev başlatıldı (%s saatte bir: senkronizasyon + kontrol).", sync_hours)