"""
security.py
API sağlamlaştırma: request ID izleme, güvenlik header'ları (CSP vb.),
ve global hata yakalayıcı -- kullanıcıya ham Python/SQL hata mesajı
sızdırmadan, sunucu tarafında tam detayı loglayan.

NOT: Rate limiting (slowapi) main.py'de ayrı tanımlanıyor çünkü
FastAPI'nin Limiter nesnesi app düzeyinde kurulmak zorunda.
"""
import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("costbot.api")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Her isteğe benzersiz bir kimlik (X-Request-ID) atar -- hem yanıt
    header'ına eklenir hem loglara yazılır. Hata ayıklarken 'kullanıcının
    bahsettiği o istek hangisiydi' sorusuna cevap verir."""
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        t0 = time.time()
        response = await call_next(request)
        elapsed = time.time() - t0
        response.headers["X-Request-ID"] = request_id
        logger.info("[%s] %s %s -> %s (%.2fs)", request_id, request.method, request.url.path, response.status_code, elapsed)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Temel güvenlik header'ları -- tarayıcı seviyesinde ek koruma
    (XSS, clickjacking, MIME sniffing)."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Yakalanmamış HERHANGİ bir hatada, kullanıcıya HAM Python hata
    mesajı/stack trace sızdırmadan, sade ve güvenli bir JSON döndürür.
    Gerçek hata detayı, request_id ile eşlenebilecek şekilde SUNUCU
    LOGUNA yazılıyor -- geliştirici hâlâ teşhis koyabiliyor, kullanıcı
    iç sistem detaylarını görmüyor."""
    request_id = getattr(request.state, "request_id", "bilinmiyor")
    logger.error("[%s] Beklenmeyen hata: %s", request_id, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Beklenmeyen bir sunucu hatası oluştu. Lütfen tekrar deneyin.",
            "request_id": request_id,
        },
    )