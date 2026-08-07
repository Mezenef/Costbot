"""
email_service.py
Herhangi bir standart SMTP saglayicisiyla (Gmail, Outlook, kurumsal
SMTP, Azure Communication Services SMTP relay vb.) calisan, genel
amacli e-posta gonderme modulu.

GMAIL ICIN NOT: Google, normal hesap sifresiyle SMTP girisine izin
vermiyor -- "Uygulama Sifresi" (App Password) uretmek gerekiyor.

TESLIM EDILEBILIRLIK NOTU: HTML'e ek olarak DUZ METIN alternatifi
gonderiliyor (bazi spam filtreleri sadece-HTML e-postalari daha supheli
goruyor), gonderen adi "CostBot <e-posta>" seklinde ayarlandi.
"""
import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.utils import formataddr


class EmailNotConfiguredError(Exception):
    pass


class EmailSendError(Exception):
    pass


def _html_to_plain(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def send_email(to_email: str, subject: str, body_html: str, body_text: str = None) -> None:
    host = os.getenv("SMTP_HOST")
    port = os.getenv("SMTP_PORT")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    from_addr = os.getenv("SMTP_FROM", user)

    if not all([host, port, user, password]):
        raise EmailNotConfiguredError(
            "SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD .env dosyasında tanımlı değil."
        )

    if body_text is None:
        body_text = _html_to_plain(body_html)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("CostBot", from_addr))
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(host, int(port), timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to_email], msg.as_string())
    except Exception as e:
        raise EmailSendError(f"E-posta gönderilemedi: {e}")


def send_verification_code_email(to_email: str, full_name: str, code: str) -> None:
    subject = "CostBot - Doğrulama Kodunuz"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #2563eb; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <span style="color: white; font-size: 20px; font-weight: bold;">🤖 CostBot</span>
      </div>
      <div style="background: #f8fafc; padding: 32px 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #1e293b; font-size: 15px;">Merhaba {full_name},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Hesabınızı doğrulamak için aşağıdaki kodu kullanın. Bu kod
          <b>10 dakika</b> süreyle geçerlidir.
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px;
                    padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">{code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">
          Bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.
        </p>
      </div>
    </div>
    """
    body_text = (
        f"Merhaba {full_name},\n\n"
        f"Hesabınızı doğrulamak için kodunuz: {code}\n"
        f"Bu kod 10 dakika süreyle geçerlidir.\n\n"
        f"Bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.\n\n"
        f"— CostBot"
    )
    send_email(to_email, subject, body_html, body_text)


def send_cost_alert_email(to_email: str, full_name: str, service_name: str, change_pct: float, current_total: float) -> None:
    """DoD Final Faz: maliyet artış uyarısı e-postası (dashboard.py'deki
    cost_spikes tespitiyle tetiklenir)."""
    subject = f"CostBot Uyarı: {service_name} maliyetinde %{change_pct:.1f} artış"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #d97706; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <span style="color: white; font-size: 20px; font-weight: bold;">⚠️ Maliyet Uyarısı</span>
      </div>
      <div style="background: #f8fafc; padding: 32px 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #1e293b; font-size: 15px;">Merhaba {full_name},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          <b>{service_name}</b> hizmetinin maliyeti bir önceki aya göre
          <b style="color: #dc2626;">%{change_pct:.1f}</b> arttı.
          Bu ayki toplam maliyet: <b>${current_total:,.2f}</b>.
        </p>
        <p style="color: #475569; font-size: 14px;">
          Detayları ve önerileri görmek için CostBot Dashboard'u ziyaret edin.
        </p>
      </div>
    </div>
    """
    body_text = (
        f"Merhaba {full_name},\n\n"
        f"{service_name} hizmetinin maliyeti bir önceki aya göre %{change_pct:.1f} arttı.\n"
        f"Bu ayki toplam maliyet: ${current_total:,.2f}\n\n"
        f"Detayları ve önerileri görmek için CostBot Dashboard'u ziyaret edin.\n\n"
        f"— CostBot"
    )
    send_email(to_email, subject, body_html, body_text)


def send_password_reset_email(to_email: str, full_name: str, code: str) -> None:
    subject = "CostBot - Şifre Sıfırlama Kodunuz"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #2563eb; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <span style="color: white; font-size: 20px; font-weight: bold;">🤖 CostBot</span>
      </div>
      <div style="background: #f8fafc; padding: 32px 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #1e293b; font-size: 15px;">Merhaba {full_name},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Şifrenizi sıfırlamak için aşağıdaki kodu kullanın. Bu kod
          <b>10 dakika</b> süreyle geçerlidir.
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px;
                    padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">{code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">
          Bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz — şifreniz değişmez.
        </p>
      </div>
    </div>
    """
    body_text = (
        f"Merhaba {full_name},\n\n"
        f"Şifrenizi sıfırlamak için kodunuz: {code}\n"
        f"Bu kod 10 dakika süreyle geçerlidir.\n\n"
        f"Bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.\n\n"
        f"— CostBot"
    )
    send_email(to_email, subject, body_html, body_text)

def send_email_with_attachment(
    to_emails: list[str], subject: str, body_html: str, body_text: str,
    attachment_bytes: bytes, attachment_filename: str,
) -> None:
    """send_email()'in PDF/dosya EKİ gönderebilen versiyonu -- zamanlanmış
    raporlar (ScheduledReports) için kullanılır. Birden fazla alıcıya
    TEK bir e-postada (Cc değil, To listesi olarak) gönderir."""
    host = os.getenv("SMTP_HOST")
    port = os.getenv("SMTP_PORT")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    from_addr = os.getenv("SMTP_FROM", user)

    if not all([host, port, user, password]):
        raise EmailNotConfiguredError(
            "SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD .env dosyasında tanımlı değil."
        )
    if not to_emails:
        raise EmailSendError("Alıcı e-posta adresi belirtilmedi.")

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = formataddr(("CostBot", from_addr))
    msg["To"] = ", ".join(to_emails)

    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(body_text, "plain"))
    body_part.attach(MIMEText(body_html, "html"))
    msg.attach(body_part)

    pdf_part = MIMEApplication(attachment_bytes, _subtype="pdf")
    pdf_part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
    msg.attach(pdf_part)

    try:
        with smtplib.SMTP(host, int(port), timeout=15) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, to_emails, msg.as_string())
    except Exception as e:
        raise EmailSendError(f"E-posta gönderilemedi: {e}")


def send_report_email(to_emails: list[str], pdf_bytes: bytes, language: str = "tr") -> None:
    """Zamanlanmış PDF raporunu, ekli olarak gönderir."""
    import time
    if language == "en":
        subject = "CostBot - Your Scheduled Cost Report"
        body_html = """
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #2563eb; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <span style="color: white; font-size: 20px; font-weight: bold;">🤖 CostBot</span>
          </div>
          <div style="background: #f8fafc; padding: 32px 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #1e293b; font-size: 15px;">Hello,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Your scheduled cloud cost report is attached to this email.
            </p>
          </div>
        </div>
        """
        body_text = "Hello,\n\nYour scheduled cloud cost report is attached to this email.\n\n— CostBot"
    else:
        subject = "CostBot - Zamanlanmış Maliyet Raporunuz"
        body_html = """
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #2563eb; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <span style="color: white; font-size: 20px; font-weight: bold;">🤖 CostBot</span>
          </div>
          <div style="background: #f8fafc; padding: 32px 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #1e293b; font-size: 15px;">Merhaba,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Zamanlanmış bulut maliyet raporunuz bu e-postaya ek olarak iliştirilmiştir.
            </p>
          </div>
        </div>
        """
        body_text = "Merhaba,\n\nZamanlanmış bulut maliyet raporunuz bu e-postaya ek olarak iliştirilmiştir.\n\n— CostBot"

    filename = f"costbot-rapor-{time.strftime('%Y-%m-%d')}.pdf"
    send_email_with_attachment([e for e in to_emails], subject, body_html, body_text, pdf_bytes, filename)