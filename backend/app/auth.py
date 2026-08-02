"""
auth.py
Basit email/şifre kimlik doğrulaması + e-posta kodu (OTP) ile hesap
doğrulama + şifre sıfırlama.

PostgreSQL'e geçiş notu: TÜM SELECT sorgularına çift tırnaklı alias
(AS "KolonAdi") eklendi -- PostgreSQL tırnaksız kolon adlarını küçük
harfe çeviriyordu, bu da row["IsVerified"] gibi erişimlerin hepsini
kırıyordu. Ayrıca cur.lastrowid (SQLite'a özel) PostgreSQL'de hiçbir
zaman çalışmıyordu -- INSERT ... RETURNING ile değiştirildi.
"""
import hashlib
import secrets
import re
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from .database import get_connection
from .email_service import (
    send_verification_code_email, send_password_reset_email,
    EmailNotConfiguredError, EmailSendError,
)

PBKDF2_ITERATIONS = 260_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CODE_EXPIRY_MINUTES = 10


class AuthError(Exception):
    """Kayıt/giriş sırasında kullanıcıya gösterilecek anlamlı hatalar için."""


class EmailNotVerifiedError(AuthError):
    """login() sırasında hesap henüz doğrulanmamışsa -- frontend bunu
    yakalayıp kullanıcıyı 'kodu doğrula' sayfasına yönlendirmeli, genel
    bir 'şifre yanlış' hatası gibi göstermemeli."""


@dataclass
class User:
    user_id: int
    full_name: str
    email: str
    role: str = "Kullanıcı"


@dataclass
class RegisterResult:
    user: User
    email_sent: bool
    email_error: Optional[str] = None


def _hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    )
    return digest.hex(), salt


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _code_expiry_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)).isoformat()


def _is_expired(expiry_iso: str) -> bool:
    try:
        expiry = datetime.fromisoformat(expiry_iso)
    except (TypeError, ValueError):
        return True
    return datetime.now(timezone.utc) > expiry


ALLOWED_ROLES = ["Yönetici", "Finans", "DevOps", "Kullanıcı"]


def register(full_name: str, email: str, password: str, role: str = "Kullanıcı") -> RegisterResult:
    full_name = full_name.strip()
    email = email.strip().lower()

    if not full_name:
        raise AuthError("Ad soyad boş olamaz.")
    if not EMAIL_RE.match(email):
        raise AuthError("Geçerli bir e-posta adresi girin.")
    if len(password) < 8:
        raise AuthError("Şifre en az 8 karakter olmalı.")
    if role not in ALLOWED_ROLES:
        role = "Kullanıcı"

    conn = get_connection()
    existing = conn.execute("SELECT UserId FROM Users WHERE Email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise AuthError("Bu e-posta adresiyle zaten bir hesap var.")

    password_hash, salt = _hash_password(password)
    code = _generate_code()
    expiry = _code_expiry_iso()
    cur = conn.execute(
        "INSERT INTO Users (FullName, Email, PasswordHash, PasswordSalt, IsVerified, "
        "VerificationCode, VerificationExpiry, Role) VALUES (?, ?, ?, ?, 0, ?, ?, ?) "
        'RETURNING UserId AS "UserId"',
        (full_name, email, password_hash, salt, code, expiry, role),
    )
    new_row = cur.fetchone()
    conn.commit()
    user_id = new_row["UserId"]
    conn.close()

    user = User(user_id=user_id, full_name=full_name, email=email, role=role)

    try:
        send_verification_code_email(email, full_name, code)
        return RegisterResult(user=user, email_sent=True)
    except (EmailNotConfiguredError, EmailSendError) as e:
        return RegisterResult(user=user, email_sent=False, email_error=str(e))


def verify_code(email: str, code: str) -> User:
    email = email.strip().lower()
    conn = get_connection()
    row = conn.execute(
        'SELECT UserId AS "UserId", FullName AS "FullName", Email AS "Email", '
        'IsVerified AS "IsVerified", VerificationCode AS "VerificationCode", '
        'VerificationExpiry AS "VerificationExpiry", Role AS "Role" '
        "FROM Users WHERE Email = ?", (email,),
    ).fetchone()

    if not row:
        conn.close()
        raise AuthError("Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.")
    if row["IsVerified"]:
        conn.close()
        raise AuthError("Bu hesap zaten doğrulanmış.")
    if not row["VerificationCode"] or row["VerificationCode"] != code.strip():
        conn.close()
        raise AuthError("Doğrulama kodu hatalı.")
    if _is_expired(row["VerificationExpiry"]):
        conn.close()
        raise AuthError("Doğrulama kodunun süresi dolmuş. Yeni kod isteyin.")

    conn.execute(
        "UPDATE Users SET IsVerified = 1, VerificationCode = NULL, VerificationExpiry = NULL "
        "WHERE UserId = ?", (row["UserId"],),
    )
    conn.commit()
    conn.close()
    return User(user_id=row["UserId"], full_name=row["FullName"], email=row["Email"], role=row["Role"] or "Kullanıcı")


def resend_code(email: str) -> None:
    email = email.strip().lower()
    conn = get_connection()
    row = conn.execute(
        'SELECT UserId AS "UserId", FullName AS "FullName", IsVerified AS "IsVerified" '
        "FROM Users WHERE Email = ?", (email,)
    ).fetchone()

    if not row:
        conn.close()
        raise AuthError("Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.")
    if row["IsVerified"]:
        conn.close()
        raise AuthError("Bu hesap zaten doğrulanmış.")

    code = _generate_code()
    expiry = _code_expiry_iso()
    conn.execute(
        "UPDATE Users SET VerificationCode = ?, VerificationExpiry = ? WHERE UserId = ?",
        (code, expiry, row["UserId"]),
    )
    conn.commit()
    full_name = row["FullName"]
    conn.close()

    send_verification_code_email(email, full_name, code)


def login(email: str, password: str) -> User:
    email = email.strip().lower()
    conn = get_connection()
    row = conn.execute(
        'SELECT UserId AS "UserId", FullName AS "FullName", Email AS "Email", '
        'PasswordHash AS "PasswordHash", PasswordSalt AS "PasswordSalt", '
        'IsVerified AS "IsVerified", Role AS "Role" FROM Users WHERE Email = ?',
        (email,),
    ).fetchone()
    conn.close()

    if not row:
        raise AuthError("E-posta veya şifre hatalı.")

    computed_hash, _ = _hash_password(password, salt=row["PasswordSalt"])
    if not secrets.compare_digest(computed_hash, row["PasswordHash"]):
        raise AuthError("E-posta veya şifre hatalı.")

    if not row["IsVerified"]:
        raise EmailNotVerifiedError("Hesabınız henüz doğrulanmamış. Lütfen e-postanıza gönderilen kodu girin.")

    return User(user_id=row["UserId"], full_name=row["FullName"], email=row["Email"], role=row["Role"] or "Kullanıcı")


def request_password_reset(email: str) -> None:
    """Şifremi unuttum akışının 1. adımı. Kullanıcı yoksa da sessizce
    başarılı gibi davranır (email enumeration önlemi)."""
    email = email.strip().lower()
    conn = get_connection()
    row = conn.execute(
        'SELECT UserId AS "UserId", FullName AS "FullName" FROM Users WHERE Email = ?', (email,)
    ).fetchone()
    if not row:
        conn.close()
        return

    code = _generate_code()
    expiry = _code_expiry_iso()
    conn.execute(
        "UPDATE Users SET ResetCode = ?, ResetExpiry = ? WHERE UserId = ?",
        (code, expiry, row["UserId"]),
    )
    conn.commit()
    full_name = row["FullName"]
    conn.close()
    send_password_reset_email(email, full_name, code)


def verify_reset_code(email: str, code: str) -> None:
    """Şifre sıfırlamanın 2 adımlı akışında ARA doğrulama."""
    email = email.strip().lower()
    conn = get_connection()
    row = conn.execute(
        'SELECT ResetCode AS "ResetCode", ResetExpiry AS "ResetExpiry" FROM Users WHERE Email = ?', (email,)
    ).fetchone()
    conn.close()
    if not row or not row["ResetCode"] or row["ResetCode"] != code.strip() or _is_expired(row["ResetExpiry"]):
        raise AuthError("Kod hatalı veya süresi dolmuş.")


def reset_password(email: str, code: str, new_password: str) -> None:
    email = email.strip().lower()
    if len(new_password) < 8:
        raise AuthError("Şifre en az 8 karakter olmalı.")

    conn = get_connection()
    row = conn.execute(
        'SELECT UserId AS "UserId", ResetCode AS "ResetCode", ResetExpiry AS "ResetExpiry" '
        "FROM Users WHERE Email = ?", (email,)
    ).fetchone()
    if not row or not row["ResetCode"] or row["ResetCode"] != code.strip() or _is_expired(row["ResetExpiry"]):
        conn.close()
        raise AuthError("Kod hatalı veya süresi dolmuş.")

    password_hash, salt = _hash_password(new_password)
    conn.execute(
        "UPDATE Users SET PasswordHash = ?, PasswordSalt = ?, ResetCode = NULL, ResetExpiry = NULL WHERE UserId = ?",
        (password_hash, salt, row["UserId"]),
    )
    conn.commit()
    conn.close()