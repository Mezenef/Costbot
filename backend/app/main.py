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
logger = logging.getLogger("costbot.main")
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
from pydantic import BaseModel, Field, field_validator
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
import re
import psycopg2

WORKING_CSV = Path(__file__).parent.parent / "data" / "azure_cost_mock_data_WORKING.csv"
DB_PATH = Path(__file__).parent.parent / "data" / "costbot.db"


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .database import get_connection, init_schema
    conn = get_connection()
    init_schema(conn)
    conn.close()
    print("[startup] Veritabanı şeması doğrulandı/oluşturuldu.")

    start_scheduler()

    yield


app = FastAPI(
    title="CostBot API",
    description="Bulut Maliyet Analiz Agent'ı — Backend API",
    version="0.1.0",
    lifespan=lifespan,
)
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    SkuChange: str | None = None
    EstimatedDowntime: str | None = None
    ImpactSummary: str | None = None


class RecommendationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Beklemede|Uygulandı|Reddedildi)$")


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1)
    email: str
    password: str = Field(..., min_length=8)
    role: str = Field(default="Kullanıcı")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Şifre en az 1 büyük harf içermelidir.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Şifre en az 1 küçük harf içermelidir.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Şifre en az 1 rakam içermelidir.")
        return v


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

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Şifre en az 1 büyük harf içermelidir.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Şifre en az 1 küçük harf içermelidir.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Şifre en az 1 rakam içermelidir.")
        return v


class SendAlertRequest(BaseModel):
    user_id: int
    language: str = "tr"
    service_name: str | None = None


class SendTeamsAlertRequest(BaseModel):
    user_id: int
    language: str = "tr"
    service_name: str | None = None


class VerifyResetCodeRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)


class ResendCodeRequest(BaseModel):
    email: str


class BudgetThresholdUpdate(BaseModel):
    threshold: float | None = Field(default=None, description="Aylık bütçe eşiği (USD). None = eşik kaldırılır.")


class TeamsWebhookUpdate(BaseModel):
    webhook_url: str | None = Field(default=None, description="Kullanıcının kendi Teams webhook adresi. None = kaldırılır.")


class ScheduledReportUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    enabled: bool = True
    granularity: str = Field(default="week", pattern="^(day|week|this_month|month)$")
    day_of_week: int | None = Field(default=None, ge=1, le=7, description="1=Pazartesi, 7=Pazar (haftalık için)")
    day_of_month: int | None = Field(default=None, ge=1, le=28, description="Ayın günü (aylık için)")
    time_of_day: str = Field(default="09:00", pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$")
    recipients: list[str] = Field(default_factory=list)
    language: str = Field(default="tr", pattern="^(tr|en)$")


class UserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    budget_threshold: float | None = None
    teams_webhook_url: str | None = None


class RegisterResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    email_sent: bool


@app.post("/alerts/check-now")
def alerts_check_now():
    check_and_notify()
    return {"status": "checked"}


@app.get("/health")
def health():
    return {"status": "ok", "time": time.time()}


@app.get("/dashboard/summary")
def dashboard_summary(language: str = "tr", user_id: int | None = None):
    return dashboard.get_dashboard_summary(language=language, user_id=user_id)


@app.get("/dashboard/period-summary")
def dashboard_period_summary(timeframe: str = "30d", language: str = "tr", user_id: int | None = None):
    allowed = {"daily", "7d", "30d", "this_month", "3m", "6m", "12m", "all"}
    if timeframe not in allowed:
        raise HTTPException(status_code=400, detail=f"Geçersiz timeframe. İzin verilenler: {', '.join(sorted(allowed))}")
    return dashboard.get_period_summary(timeframe=timeframe, language=language, user_id=user_id)


@app.post("/alerts/send-email")
def send_alert_email(body: SendAlertRequest):
    conn = get_connection()
    user_row = conn.execute('SELECT FullName AS "FullName", Email AS "Email" FROM Users WHERE UserId = ?', (body.user_id,)).fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    spikes = dashboard.get_cost_spikes_only(timeframe="30d", language=body.language)
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
    conn = get_connection()
    user_row = conn.execute(
        'SELECT TeamsWebhookUrl AS "TeamsWebhookUrl" FROM Users WHERE UserId = ?', (body.user_id,)
    ).fetchone()
    conn.close()
    if not user_row or not user_row["TeamsWebhookUrl"]:
        raise HTTPException(status_code=400, detail="Teams webhook adresiniz tanımlı değil. Lütfen Ayarlar sayfasından ekleyin.")
    webhook_url = user_row["TeamsWebhookUrl"]

    spikes = dashboard.get_cost_spikes_only(timeframe="30d", language=body.language)
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


@app.get("/resources")
def list_resources(search: str = "", limit: int = 50, offset: int = 0):
    return dashboard.get_resources(search=search, limit=limit, offset=offset)


@app.get("/dashboard/service-breakdown-by-period")
def service_breakdown_by_period(granularity: str = "month", language: str = "tr"):
    return dashboard.get_service_breakdown_by_period(granularity=granularity, language=language)

@app.get("/cost-analyzer")
def cost_analyzer(
    group_by: str = "service",
    granularity: str = "day",
    start_date: str | None = None,
    end_date: str | None = None,
    filter_service: str | None = None,
    filter_resource_group: str | None = None,
    filter_region: str | None = None,
    language: str = "tr",
):
    allowed_group_by = {"none", "service", "resource_group", "region", "category"}
    if group_by not in allowed_group_by:
        raise HTTPException(status_code=400, detail=f"Geçersiz group_by. İzin verilenler: {', '.join(sorted(allowed_group_by))}")
    allowed_granularity = {"day", "week", "month"}
    if granularity not in allowed_granularity:
        raise HTTPException(status_code=400, detail=f"Geçersiz granularity. İzin verilenler: {', '.join(sorted(allowed_granularity))}")

    return dashboard.get_cost_analyzer_data(
        group_by=group_by,
        granularity=granularity,
        start_date=start_date,
        end_date=end_date,
        filter_service=filter_service,
        filter_resource_group=filter_resource_group,
        filter_region=filter_region,
        language=language,
    )

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
        # NOT: PDF'in binary içeriği (pdf_bytes) artık PdfData sütununa
        # da kaydediliyor -- böylece geçmişteki bu rapor tekrar
        # indirildiğinde, GÜNCEL veriyle yeniden üretilmek yerine
        # o günkü BİREBİR AYNI dosya döndürülebiliyor.
        conn.execute(
            "INSERT INTO ReportHistory (UserId, Period, Language, PdfData) VALUES (?, ?, ?, ?)",
            (user_id, period_label, language, psycopg2.Binary(pdf_bytes)),
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


@app.post("/auth/register", response_model=RegisterResponse)
def auth_register(req: RegisterRequest):
    # GÜVENLİK: Kayıt, varsayılan olarak KAPALI -- CostBot canlıya
    # alındıktan sonra, URL'yi bilen HERKESİN hesap açıp SabancıDx'in
    # gerçek Azure maliyet verilerine erişmesini önlemek için. Yeniden
    # açmak gerekirse, .env'de ALLOW_REGISTRATION=true eklenir.
    if os.getenv("ALLOW_REGISTRATION", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="Yeni kayıt şu anda kapalı. Erişim için lütfen sistem yöneticisiyle iletişime geçin.",
        )
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


_REC_COLUMNS_SQL = (
    'RecommendationId AS "RecommendationId", CreatedDate AS "CreatedDate", '
    'TargetService AS "TargetService", TargetResourceName AS "TargetResourceName", '
    'RecommendationText AS "RecommendationText", PotentialSavings AS "PotentialSavings", '
    'Currency AS "Currency", Status AS "Status", ActionDate AS "ActionDate", '
    'SkuChange AS "SkuChange", EstimatedDowntime AS "EstimatedDowntime", '
    'ImpactSummary AS "ImpactSummary"'
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

@app.get("/reports/history/{report_id}/download")
def download_report_history_item(report_id: int, user_id: int):
    """Geçmişteki bir raporu, O GÜNKÜ BİREBİR AYNI PDF ile indirir --
    günün verisiyle YENİDEN ÜRETMEZ. PdfData bu özellik eklenmeden
    önce oluşturulmuş eski kayıtlarda NULL olabilir; bu durumda
    kullanıcıya anlaşılır bir hata döndürülür."""
    conn = get_connection()
    row = conn.execute(
        'SELECT PdfData AS "PdfData", GeneratedDate AS "GeneratedDate" '
        'FROM ReportHistory WHERE ReportId = ? AND UserId = ?',
        (report_id, user_id),
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Rapor kaydı bulunamadı")
    if row["PdfData"] is None:
        raise HTTPException(
            status_code=410,
            detail="Bu rapor, dosya saklama özelliği eklenmeden önce oluşturulduğu için artık indirilemiyor.",
        )

    filename = f"costbot-rapor-{report_id}.pdf"
    return Response(
        content=bytes(row["PdfData"]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


@app.delete("/reports/history/{report_id}")
def delete_report_history_item(report_id: int, user_id: int):
    conn = get_connection()
    existing = conn.execute(
        "SELECT ReportId FROM ReportHistory WHERE ReportId = ? AND UserId = ?",
        (report_id, user_id),
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Rapor kaydı bulunamadı")

    conn.execute("DELETE FROM ReportHistory WHERE ReportId = ?", (report_id,))
    conn.commit()
    conn.close()
    return {"deleted": report_id}


@app.delete("/reports/history")
def clear_report_history(user_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM ReportHistory WHERE UserId = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"cleared": True}


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
    conn.execute("INSERT INTO SyncLog (RowsInserted) VALUES (?)", (stats["inserted"],))
    conn.commit()
    conn.close()

    return {"source": "azure_live", "days": days, **stats}


@app.post("/admin/sync-real-azure-data-range")
def sync_real_azure_data_range(start_date: str, end_date: str):
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
    conn.execute("INSERT INTO SyncLog (RowsInserted) VALUES (?)", (stats["inserted"],))
    conn.commit()
    conn.close()

    return {"source": "azure_live", "start_date": start_date, "end_date": end_date, **stats}


@app.get("/finops-score")
def finops_score(language: str = "tr", user_id: int | None = None):
    return dashboard.get_finops_score(language=language, user_id=user_id)


@app.get("/settings/budget-threshold")
def get_budget_threshold(user_id: int):
    conn = get_connection()
    row = conn.execute(
        'SELECT BudgetThreshold AS "BudgetThreshold" FROM Users WHERE UserId = ?', (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"threshold": row["BudgetThreshold"]}


@app.put("/settings/budget-threshold")
def update_budget_threshold(user_id: int, body: BudgetThresholdUpdate):
    if body.threshold is not None and body.threshold < 0:
        raise HTTPException(status_code=400, detail="Eşik negatif olamaz.")
    conn = get_connection()
    existing = conn.execute("SELECT UserId FROM Users WHERE UserId = ?", (user_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    conn.execute(
        "UPDATE Users SET BudgetThreshold = ? WHERE UserId = ?",
        (body.threshold, user_id),
    )
    conn.commit()
    conn.close()
    return {"threshold": body.threshold}


@app.get("/settings/teams-webhook")
def get_teams_webhook(user_id: int):
    conn = get_connection()
    row = conn.execute(
        'SELECT TeamsWebhookUrl AS "TeamsWebhookUrl" FROM Users WHERE UserId = ?', (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"webhook_url": row["TeamsWebhookUrl"]}


@app.put("/settings/teams-webhook")
def update_teams_webhook(user_id: int, body: TeamsWebhookUpdate):
    if body.webhook_url and not body.webhook_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Webhook adresi https:// ile başlamalı.")
    conn = get_connection()
    existing = conn.execute("SELECT UserId FROM Users WHERE UserId = ?", (user_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    conn.execute(
        "UPDATE Users SET TeamsWebhookUrl = ? WHERE UserId = ?",
        (body.webhook_url, user_id),
    )
    conn.commit()
    conn.close()
    return {"webhook_url": body.webhook_url}


# ============================================================
# Zamanlanmış Raporlar (Scheduled Reports) -- kullanıcı başına
# en fazla _MAX_SCHEDULED_REPORTS_PER_USER kayıt (ör. hem
# haftalık hem aylık, her biri kendi alıcı listesiyle).
# ============================================================
_MAX_SCHEDULED_REPORTS_PER_USER = 5


@app.get("/reports/schedules")
def list_scheduled_reports(user_id: int):
    conn = get_connection()
    rows = conn.execute(
        'SELECT ScheduleId AS "ScheduleId", Name AS "Name", Enabled AS "Enabled", Granularity AS "Granularity", '
        'DayOfWeek AS "DayOfWeek", DayOfMonth AS "DayOfMonth", TimeOfDay AS "TimeOfDay", '
        'Recipients AS "Recipients", Language AS "Language" '
        'FROM ScheduledReports WHERE UserId = ? ORDER BY ScheduleId ASC',
        (user_id,),
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        item = dict(row)
        item["recipients"] = item["Recipients"].split(",") if item["Recipients"] else []
        result.append(item)
    return result


def _validate_schedule_body(body: ScheduledReportUpdate):
    if body.granularity == "week" and body.day_of_week is None:
        raise HTTPException(status_code=400, detail="Haftalık rapor için gün seçilmeli.")
    if body.granularity in ("month", "this_month") and body.day_of_month is None:
        raise HTTPException(status_code=400, detail="Aylık rapor için ayın günü seçilmeli.")
    if not body.recipients:
        raise HTTPException(status_code=400, detail="En az bir alıcı e-posta adresi girilmeli.")


@app.post("/reports/schedules")
def create_scheduled_report(user_id: int, body: ScheduledReportUpdate):
    _validate_schedule_body(body)

    conn = get_connection()
    count_row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM ScheduledReports WHERE UserId = ?", (user_id,)
    ).fetchone()
    if count_row["cnt"] >= _MAX_SCHEDULED_REPORTS_PER_USER:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"En fazla {_MAX_SCHEDULED_REPORTS_PER_USER} zamanlanmış rapor oluşturabilirsiniz.",
        )

    recipients_str = ",".join(r.strip() for r in body.recipients if r.strip())
    conn.execute(
        "INSERT INTO ScheduledReports (UserId, Name, Enabled, Granularity, DayOfWeek, DayOfMonth, TimeOfDay, Recipients, Language) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, body.name, int(body.enabled), body.granularity, body.day_of_week, body.day_of_month,
         body.time_of_day, recipients_str, body.language),
    )
    conn.commit()
    conn.close()

    # NOT: Kullanıcı bir zamanlama kaydettiğinde, "1 saatlik otomatik
    # döngünün gelmesini beklemeden" -- eğer o an için (bugün + saat
    # geçmiş) koşullar zaten sağlanıyorsa, ANINDA gönderilsin diye
    # burada bir kez kontrol tetikleniyor. Koşullar sağlanmıyorsa
    # (ör. saat henüz gelmedi) hiçbir şey olmaz, sessizce geçer --
    # normal saatlik döngü daha sonra zaten kontrol edecek.
    from .scheduler import _send_scheduled_reports
    try:
        _send_scheduled_reports()
    except Exception as e:
        logger.error("Zamanlama sonrası anlık kontrol başarısız: %s", e)

    return {"created": True}


@app.put("/reports/schedules/{schedule_id}")
def update_scheduled_report(schedule_id: int, user_id: int, body: ScheduledReportUpdate):
    _validate_schedule_body(body)

    conn = get_connection()
    existing = conn.execute(
        "SELECT ScheduleId FROM ScheduledReports WHERE ScheduleId = ? AND UserId = ?",
        (schedule_id, user_id),
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Zamanlanmış rapor bulunamadı")

    recipients_str = ",".join(r.strip() for r in body.recipients if r.strip())
    # NOT: Kullanıcı bir zamanlamayı DÜZENLEDİĞİNDE (gün/saat/alıcı
    # farketmeksizin), LastSentDate BİLİNÇLİ OLARAK sıfırlanıyor.
    # Aksi hâlde, kullanıcı yeni bir saat/gün ayarlasa bile, eski
    # LastSentDate ("bugün zaten gönderildi") o yeni zamanın da
    # engellenmesine yol açıyordu -- kullanıcı testinde tam olarak
    # yaşanan sorun buydu. Düzenleme = "bu ayarları yeniden
    # değerlendir" demek, dolayısıyla önceki gönderim kaydı geçersiz
    # sayılır.
    conn.execute(
        "UPDATE ScheduledReports SET Name = ?, Enabled = ?, Granularity = ?, DayOfWeek = ?, DayOfMonth = ?, "
        "TimeOfDay = ?, Recipients = ?, Language = ?, LastSentDate = NULL WHERE ScheduleId = ?",
        (body.name, int(body.enabled), body.granularity, body.day_of_week, body.day_of_month,
         body.time_of_day, recipients_str, body.language, schedule_id),
    )
    conn.commit()
    conn.close()

    from .scheduler import _send_scheduled_reports
    try:
        _send_scheduled_reports()
    except Exception as e:
        logger.error("Zamanlama güncellemesi sonrası anlık kontrol başarısız: %s", e)

    return {"updated": True}


@app.delete("/reports/schedules/{schedule_id}")
def delete_scheduled_report(schedule_id: int, user_id: int):
    conn = get_connection()
    existing = conn.execute(
        "SELECT ScheduleId FROM ScheduledReports WHERE ScheduleId = ? AND UserId = ?",
        (schedule_id, user_id),
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Zamanlanmış rapor bulunamadı")
    conn.execute("DELETE FROM ScheduledReports WHERE ScheduleId = ?", (schedule_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


@app.post("/reports/schedule/check-now")
def scheduled_reports_check_now():
    """Test/manuel tetikleme -- normalde saatte bir çalışan zamanlanmış
    rapor kontrolünü hemen çalıştırır. NOT: Bu, day_of_week/day_of_month
    ve saat kontrolünü ATLAMAZ -- sadece "1 saat bekleme" süresini
    atlar. Yani gerçek bir gönderim görmek için, zamanladığın gün/saat
    hâlâ doğru olmalı (ör. bugünün günü + saat geçmiş olmalı)."""
    from .scheduler import _send_scheduled_reports
    _send_scheduled_reports()
    return {"status": "checked"}