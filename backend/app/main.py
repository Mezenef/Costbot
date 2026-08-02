"""
main.py
CostBot Backend API (Python + FastAPI).

DoD Bölüm 1: "Backend API servisi (Python + FastAPI) üzerinden
LangChain SQL Agent'a bağlanıyor."
DoD Risks/Blockers: "İki ayrı servisin (frontend/backend) deploy ve CORS
yönetimi karmaşıklığı" — bu dosyada CORSMiddleware ile en baştan çözüldü.

Çalıştırma:
    uvicorn app.main:app --reload --port 8000
"""

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
import json
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .security import RequestIDMiddleware, SecurityHeadersMiddleware, global_exception_handler

from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse
from . import sql_agent
from . import auth
from . import dashboard
from . import report
from .email_service import EmailNotConfiguredError, EmailSendError
from .database import build_database, get_connection
from .database import get_connection
from .email_service import send_cost_alert_email, EmailNotConfiguredError, EmailSendError
from .teams_service import send_teams_notification, get_teams_recipients, TeamsNotConfiguredError, TeamsSendError
from .scheduler import start_scheduler, check_and_notify
from . import forecast 

WORKING_CSV = Path(__file__).parent.parent / "data" / "azure_cost_mock_data_WORKING.csv"
DB_PATH = Path(__file__).parent.parent / "data" / "costbot.db"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Uygulama açılışında veritabanı yoksa otomatik kur (DoD: "CSV → SQLite otomatik yükleme")
    if not DB_PATH.exists():
        stats = build_database(csv_path=WORKING_CSV)
        print(f"[startup] Veritabanı kuruldu: {stats['inserted']} satır, {stats['skipped']} atlandı")
    else:
        print(f"[startup] Mevcut veritabanı kullanılıyor: {DB_PATH}")

    start_scheduler()

    yield


app = FastAPI(
    title="CostBot API",
    description="Bulut Maliyet Analiz Agent'ı — Backend API",
    version="0.1.0",
    lifespan=lifespan,
)
# ── API sağlamlaştırma: rate limiting, request ID, güvenlik header'ları,
# güvenli hata formatı (bkz. security.py) ──
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

# ── CORS ──
ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic modelleri ──
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Doğal dilde maliyet sorusu")
    session_id: str = Field(default="default", description="Chat oturumu kimliği")
    language: str = Field(default="tr", pattern="^(tr|en)$", description="Yanıt dili")
    user_id: int | None = Field(default=None, description="Giriş yapmış kullanıcının kimliği")
    previous_answer: str | None = Field(default=None, description="Bir önceki bot cevabı (bağlam için)")


class QueryResponse(BaseModel):
    status: str
    answer: str
    sql: str | None = None
    data: list = []
    execution_time: float


class RecommendationOut(BaseModel):
    RecommendationId: int
    CreatedDate: str
    TargetService: str | None
    TargetResourceName: str | None
    RecommendationText: str | None
    PotentialSavings: float | None
    Currency: str | None
    Status: str
    ActionDate: str | None


class RecommendationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Beklemede|Uygulandı|Reddedildi)$")


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1)
    email: str
    password: str = Field(..., min_length=8)
    role: str = Field(default="Kullanıcı")


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)

class SendAlertRequest(BaseModel):
    user_id: int
    language: str = "tr"
    service_name: str | None = None  # None = tüm uyarıları gönder

class SendTeamsAlertRequest(BaseModel):
    user_id: int
    language: str = "tr"
    service_name: str | None = None
    recipient: str

class VerifyResetCodeRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)

class ResendCodeRequest(BaseModel):
    email: str


class UserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str


class RegisterResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    email_sent: bool




@app.post("/alerts/check-now")
def alerts_check_now():
    """Test/manuel tetikleme -- normalde saatte bir otomatik çalışan
    kontrolü hemen çalıştırır, saatlerce beklemeden test edebilesin."""
    check_and_notify()
    return {"status": "checked"}


# ── Health ──
@app.get("/health")
def health():
    return {"status": "ok", "time": time.time()}


@app.get("/dashboard/summary")
def dashboard_summary(language: str = "tr", user_id: int | None = None):
    return dashboard.get_dashboard_summary(language=language, user_id=user_id)

@app.post("/alerts/send-email")
def send_alert_email(body: SendAlertRequest):
    conn = get_connection()
    user_row = conn.execute('SELECT FullName AS "FullName", Email AS "Email" FROM Users WHERE UserId = ?', (body.user_id,)).fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    summary = dashboard.get_dashboard_summary(language=body.language, user_id=body.user_id)
    spikes = summary["cost_spikes"]
    if body.service_name:
        spikes = [s for s in spikes if s["service_name"] == body.service_name]
    conn.close()

    if not spikes:
        raise HTTPException(status_code=400, detail="Gönderilecek uyarı bulunamadı")

    sent = 0
    errors = []
    for spike in spikes:
        try:
            send_cost_alert_email(
                user_row["Email"], user_row["FullName"],
                spike["service_name"], spike["change_pct"], spike["current_total"],
            )
            sent += 1
        except (EmailNotConfiguredError, EmailSendError) as e:
            errors.append(str(e))

    return {"sent": sent, "errors": errors}


@app.post("/alerts/send-teams")
def send_teams_alert(body: SendTeamsAlertRequest):
    recipients = get_teams_recipients()
    webhook_url = recipients.get(body.recipient)
    if not webhook_url:
        raise HTTPException(status_code=404, detail="Bu alıcı için bir Teams webhook'u tanımlı değil")

    summary = dashboard.get_dashboard_summary(language=body.language, user_id=body.user_id)
    spikes = summary["cost_spikes"]
    if body.service_name:
        spikes = [s for s in spikes if s["service_name"] == body.service_name]

    if not spikes:
        raise HTTPException(status_code=400, detail="Gönderilecek uyarı bulunamadı")

    lines = [
        f"**{s['service_name']}**: %{s['change_pct']} artış, güncel maliyet ${s['current_total']:,.2f}"
        for s in spikes
    ]
    try:
        send_teams_notification(webhook_url, "CostBot Maliyet Uyarısı", lines)
    except (TeamsNotConfiguredError, TeamsSendError) as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"sent": len(spikes)}


@app.get("/alerts/teams-recipients")
def teams_recipients():
    return {"recipients": list(get_teams_recipients().keys())}


@app.get("/resources")
def list_resources(search: str = "", limit: int = 50, offset: int = 0):
    return dashboard.get_resources(search=search, limit=limit, offset=offset)


@app.get("/dashboard/service-breakdown-by-period")
def service_breakdown_by_period(granularity: str = "month", language: str = "tr"):
    return dashboard.get_service_breakdown_by_period(granularity=granularity, language=language)

@app.get("/dashboard/resource-group/{group_name}")
def resource_group_detail(group_name: str, language: str = "tr"):
    return dashboard.get_resource_group_detail(group_name, language=language)

@app.get("/reports/download")
def download_report(language: str = "tr", user_id: int | None = None, granularity: str | None = None):
    pdf_bytes = report.generate_pdf_report(language=language, user_id=user_id, granularity=granularity)

    if user_id is not None:
        conn = get_connection()
        month_row = conn.execute(
            "SELECT MAX(TO_CHAR(UsageDate::date, 'YYYY-MM')) AS m FROM CloudCosts"
        ).fetchone()
        period_label = month_row["m"]
        if granularity:
            period_label = f"{period_label} ({granularity})"
        conn.execute(
            "INSERT INTO ReportHistory (UserId, Period, Language) VALUES (?, ?, ?)",
            (user_id, period_label, language),
        )
        conn.commit()
        conn.close()
    filename = f"costbot-rapor-{time.strftime('%Y-%m-%d-%H%M%S')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


# ── Kimlik doğrulama ──
@app.post("/auth/register", response_model=RegisterResponse)
def auth_register(req: RegisterRequest):
    try:
        result = auth.register(req.full_name, req.email, req.password, role=req.role)
    except auth.AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RegisterResponse(
        user_id=result.user.user_id, full_name=result.user.full_name,
        email=result.user.email, role=result.user.role, email_sent=result.email_sent,
    )


@app.post("/auth/verify", response_model=UserOut)
def auth_verify(req: VerifyRequest):
    try:
        user = auth.verify_code(req.email, req.code)
    except auth.AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return UserOut(user_id=user.user_id, full_name=user.full_name, email=user.email, role=user.role)


@app.post("/auth/resend-code")
def auth_resend_code(req: ResendCodeRequest):
    try:
        auth.resend_code(req.email)
    except auth.AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (EmailNotConfiguredError, EmailSendError) as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"sent": True}


@app.post("/auth/login", response_model=UserOut)
def auth_login(req: LoginRequest):
    try:
        user = auth.login(req.email, req.password)
    except auth.EmailNotVerifiedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except auth.AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return UserOut(user_id=user.user_id, full_name=user.full_name, email=user.email, role=user.role)

@app.post("/auth/forgot-password")
def auth_forgot_password(req: ForgotPasswordRequest):
    try:
        auth.request_password_reset(req.email)
    except (EmailNotConfiguredError, EmailSendError) as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"sent": True}

@app.post("/auth/verify-reset-code")
def auth_verify_reset_code(req: VerifyResetCodeRequest):
    try:
        auth.verify_reset_code(req.email, req.code)
    except auth.AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"valid": True}

    
@app.post("/auth/reset-password")
def auth_reset_password(req: ResetPasswordRequest):
    try:
        auth.reset_password(req.email, req.code, req.new_password)
    except auth.AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"reset": True}


# ── DoD Bölüm 2: Doğal dil -> SQL -> sonuç ──
@app.post("/query", response_model=QueryResponse)
@limiter.limit("15/minute")
def query(request: Request, req: QueryRequest):
    result = sql_agent.ask(req.question, session_id=req.session_id, language=req.language, user_id=req.user_id, previous_answer=req.previous_answer)
    if result.status == "llm_error":
        raise HTTPException(status_code=503, detail=result.answer)
    return QueryResponse(
        status=result.status,
        answer=result.answer,
        sql=result.sql,
        data=result.data,
        execution_time=result.execution_time,
    )

@app.post("/query/stream")
@limiter.limit("15/minute")
def query_stream(request: Request, req: QueryRequest):
    """Chat cevabını parça parça (Server-Sent Events) akıtır -- kullanıcı
    cevabın 'yazıldığını' görür, tüm cevabın bitmesini beklemez."""
    def event_generator():
        for event in sql_agent.ask_stream(
            req.question,
            session_id=req.session_id,
            language=req.language,
            user_id=req.user_id,
            previous_answer=req.previous_answer,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── DoD: CostRecommendations listeleme ──
_REC_COLUMNS_SQL = (
    'RecommendationId AS "RecommendationId", CreatedDate AS "CreatedDate", '
    'TargetService AS "TargetService", TargetResourceName AS "TargetResourceName", '
    'RecommendationText AS "RecommendationText", PotentialSavings AS "PotentialSavings", '
    'Currency AS "Currency", Status AS "Status", ActionDate AS "ActionDate"'
)


@app.get("/recommendations", response_model=list[RecommendationOut])
def list_recommendations(user_id: int, status: str | None = None):
    conn = get_connection()
    if status:
        rows = conn.execute(
            f"SELECT {_REC_COLUMNS_SQL} FROM CostRecommendations WHERE UserId = ? AND Status = ? ORDER BY CreatedDate DESC",
            (user_id, status),
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT {_REC_COLUMNS_SQL} FROM CostRecommendations WHERE UserId = ? ORDER BY CreatedDate DESC", (user_id,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.patch("/recommendations/{rec_id}", response_model=RecommendationOut)
def update_recommendation_status(rec_id: int, body: RecommendationStatusUpdate, user_id: int):
    conn = get_connection()
    existing = conn.execute(
        "SELECT * FROM CostRecommendations WHERE RecommendationId = ? AND UserId = ?", (rec_id, user_id)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Öneri bulunamadı")

    conn.execute(
        "UPDATE CostRecommendations SET Status = ?, ActionDate = CURRENT_TIMESTAMP WHERE RecommendationId = ?",
        (body.status, rec_id),
    )
    conn.commit()
    updated = conn.execute(
        f"SELECT {_REC_COLUMNS_SQL} FROM CostRecommendations WHERE RecommendationId = ?", (rec_id,)
    ).fetchone()
    conn.close()
    return dict(updated)


@app.delete("/recommendations/{rec_id}")
def delete_recommendation(rec_id: int, user_id: int):
    conn = get_connection()
    existing = conn.execute(
        "SELECT RecommendationId FROM CostRecommendations WHERE RecommendationId = ? AND UserId = ?",
        (rec_id, user_id),
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Öneri bulunamadı")

    conn.execute("DELETE FROM CostRecommendations WHERE RecommendationId = ?", (rec_id,))
    conn.commit()
    conn.close()
    return {"deleted": rec_id}


# ── DoD: ChatHistory ──
@app.get("/history")
def get_history(user_id: int, session_id: str = "default", limit: int = 50):
    conn = get_connection()
    columns_sql = (
        'MessageId AS "MessageId", UserId AS "UserId", SessionId AS "SessionId", '
        'Timestamp AS "Timestamp", UserPrompt AS "UserPrompt", GeneratedSQL AS "GeneratedSQL", '
        'QueryResultJSON AS "QueryResultJSON", BotResponseText AS "BotResponseText", '
        'ExecutionTime AS "ExecutionTime"'
    )
    rows = conn.execute(
        f"SELECT {columns_sql} FROM ChatHistory WHERE SessionId = ? AND UserId = ? ORDER BY Timestamp DESC LIMIT ?",
        (session_id, user_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows][::-1]


# ── Veritabanını manuel yeniden kurma ──
@app.post("/admin/rebuild-database")
def rebuild_database(dataset: str = "working"):
    csv_map = {
        "real": Path(__file__).parent.parent / "data" / "azure_cost_mock_data.csv",
        "working": WORKING_CSV,
    }
    csv_path = csv_map.get(dataset)
    if not csv_path or not csv_path.exists():
        raise HTTPException(status_code=400, detail=f"Bilinmeyen veya bulunamayan veri seti: {dataset}")
    stats = build_database(csv_path=csv_path)
    return {"dataset": dataset, **stats}

@app.get("/reports/history")
def report_history(user_id: int):
    conn = get_connection()
    columns_sql = (
        'ReportId AS "ReportId", UserId AS "UserId", GeneratedDate AS "GeneratedDate", '
        'Period AS "Period", Language AS "Language"'
    )
    rows = conn.execute(
        f"SELECT {columns_sql} FROM ReportHistory WHERE UserId = ? ORDER BY GeneratedDate DESC LIMIT 50",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/forecast")
def cost_forecast(language: str = "tr", include_insight: bool = True):
    data = forecast.get_cost_forecast(language=language)
    if not data.get("available"):
        return data
    if include_insight:
        try:
            data["ai_insight"] = forecast.generate_forecast_insight(data, language=language)
        except Exception as e:
            data["ai_insight"] = None
            data["ai_insight_error"] = str(e)
    return data


@app.post("/admin/sync-real-azure-data")
def sync_real_azure_data(days: int = 30):
    from . import azure_cost_fetcher
    from .database import load_from_azure

    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")

    if not all([tenant_id, client_id, client_secret, subscription_id]):
        raise HTTPException(status_code=503, detail="Azure kimlik bilgileri .env dosyasında eksik.")

    try:
        rows = azure_cost_fetcher.fetch_azure_cost_rows(tenant_id, client_id, client_secret, subscription_id, days=days)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure'dan veri çekilemedi: {e}")

    conn = get_connection()
    stats = load_from_azure(conn, rows)
    conn.close()

    return {"source": "azure_live", "days": days, **stats}

@app.post("/admin/sync-real-azure-data-range")
def sync_real_azure_data_range(start_date: str, end_date: str):
    """Belirli bir tarih aralığı için (ay ay bölerek) geçmiş Azure
    maliyet verisini çeker. UZUN SÜREBİLİR (her ay ayrı bir rapor
    isteği ve bekleme gerektiriyor -- 6 ay için 10-30+ dakika olabilir)."""
    from . import azure_cost_fetcher
    from .database import load_from_azure

    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")

    if not all([tenant_id, client_id, client_secret, subscription_id]):
        raise HTTPException(status_code=503, detail="Azure kimlik bilgileri .env dosyasında eksik.")

    try:
        rows = azure_cost_fetcher.fetch_azure_cost_rows_range(tenant_id, client_id, client_secret, subscription_id, start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure'dan veri çekilemedi: {e}")

    conn = get_connection()
    stats = load_from_azure(conn, rows, start_date=start_date, end_date=end_date)
    conn.close()

    return {"source": "azure_live", "start_date": start_date, "end_date": end_date, **stats}

@app.get("/finops-score")
def finops_score(language: str = "tr", user_id: int | None = None):
    return dashboard.get_finops_score(language=language, user_id=user_id)