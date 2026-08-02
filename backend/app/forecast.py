"""
forecast.py
AI Cost Forecast -- geçmiş günlük maliyet verilerinden basit bir
DOĞRUSAL TREND ile ay sonu maliyet tahmini üretir. Ayrı bir servis
olarak tutuluyor (dashboard.py'ye karıştırılmadı) -- DoD'nin "modüler
yapı" isteğine uygun.

DÜRÜSTLÜK NOTU: Bu, gerçek bir zaman serisi modeli (ARIMA, Prophet vb.)
DEĞİL -- kasıtlı olarak basit bir "son N günün ortalamasını kalan
günlere yay" yöntemi kullanılıyor. İki sebebi var:
  1. Veri seti sentetik/mock olduğu için gerçek mevsimsellik/trend
     paternleri taşımıyor -- karmaşık bir model burada yanlış bir
     kesinlik hissi verir.
  2. "Confidence Score", istatistiksel bir p-değeri DEĞİL -- günlük
     maliyetin ne kadar DEĞİŞKEN (volatile) olduğunu yansıtan basit
     bir sezgisel (heuristic) puan. Bu açıkça böyle belgeleniyor ki
     yanlış bir güven hissi yaratılmasın.
"""
import statistics
from datetime import date, timedelta
from calendar import monthrange

from .database import get_connection


def _daily_totals(conn, start_date: str, end_date: str) -> dict[str, float]:
    rows = conn.execute(
        "SELECT UsageDate, SUM(PreTaxCost) AS total FROM CloudCosts "
        "WHERE UsageDate BETWEEN ? AND ? GROUP BY UsageDate ORDER BY UsageDate",
        (start_date, end_date),
    ).fetchall()
    return {r["usagedate"]: r["total"] for r in rows}


def _confidence_score(daily_values: list[float]) -> float:
    """Basit bir sezgisel güven puanı -- günlük maliyetin ne kadar
    DEĞİŞKEN olduğunu ve kaç günlük veriye dayandığını yansıtır.
    Gerçek bir istatistiksel anlam TAŞIMAZ."""
    if len(daily_values) < 2:
        return 30.0
    mean = statistics.mean(daily_values)
    if mean == 0:
        return 30.0
    std = statistics.stdev(daily_values)
    coefficient_of_variation = std / mean
    volatility_penalty = min(coefficient_of_variation * 100, 60)
    data_bonus = min(len(daily_values) / 30 * 20, 20)
    score = 100 - volatility_penalty + data_bonus - 20
    return round(max(20.0, min(95.0, score)), 1)


def get_cost_forecast(language: str = "tr") -> dict:
    conn = get_connection()

    max_date_row = conn.execute("SELECT MAX(UsageDate) AS d FROM CloudCosts").fetchone()
    last_date_str = max_date_row["d"]
    if not last_date_str:
        conn.close()
        return {"available": False}

    last_date = date.fromisoformat(last_date_str)
    month_start = last_date.replace(day=1)
    days_in_month = monthrange(last_date.year, last_date.month)[1]

    month_daily = _daily_totals(conn, month_start.isoformat(), last_date.isoformat())
    month_to_date_total = sum(month_daily.values())

    window_start = max(month_start, last_date - timedelta(days=13))
    recent_daily = _daily_totals(conn, window_start.isoformat(), last_date.isoformat())
    recent_values = list(recent_daily.values())
    avg_daily_cost = statistics.mean(recent_values) if recent_values else 0.0

    days_elapsed = (last_date - month_start).days + 1
    days_remaining = days_in_month - days_elapsed
    estimated_month_end = month_to_date_total + avg_daily_cost * days_remaining

    last_7_start = last_date - timedelta(days=6)
    prev_7_start = last_date - timedelta(days=13)
    prev_7_end = last_date - timedelta(days=7)
    last_7_daily = _daily_totals(conn, last_7_start.isoformat(), last_date.isoformat())
    prev_7_daily = _daily_totals(conn, prev_7_start.isoformat(), prev_7_end.isoformat())
    last_7_avg = statistics.mean(last_7_daily.values()) if last_7_daily else 0.0
    prev_7_avg = statistics.mean(prev_7_daily.values()) if prev_7_daily else 0.0
    trend_pct = ((last_7_avg - prev_7_avg) / prev_7_avg * 100) if prev_7_avg else None

    # Servis bazında değişim (son 7 gün vs önceki 7 gün)
    service_rows_recent = conn.execute(
        "SELECT ServiceName, SUM(PreTaxCost) AS total FROM CloudCosts "
        "WHERE UsageDate BETWEEN ? AND ? GROUP BY ServiceName",
        (last_7_start.isoformat(), last_date.isoformat()),
    ).fetchall()
    service_rows_prev = conn.execute(
        "SELECT ServiceName, SUM(PreTaxCost) AS total FROM CloudCosts "
        "WHERE UsageDate BETWEEN ? AND ? GROUP BY ServiceName",
        (prev_7_start.isoformat(), prev_7_end.isoformat()),
    ).fetchall()
    conn.close()

    recent_by_service = {r["servicename"]: r["total"] for r in service_rows_recent}
    prev_by_service = {r["servicename"]: r["total"] for r in service_rows_prev}

    service_changes = []
    for svc, recent_total in recent_by_service.items():
        prev_total = prev_by_service.get(svc)
        if prev_total:
            change_pct = (recent_total - prev_total) / prev_total * 100
            service_changes.append({
                "service_name": svc,
                "recent_total": round(recent_total, 2),
                "previous_total": round(prev_total, 2),
                "change_pct": round(change_pct, 1),
            })

    service_changes.sort(key=lambda s: s["change_pct"], reverse=True)
    top_increasing = service_changes[:5]
    top_decreasing = sorted(service_changes, key=lambda s: s["change_pct"])[:5]

    # Kümülatif grafik: gerçek (actual) + projeksiyon (projected) aynı
    # ölçekte, kesintisiz bir çizgi oluşturacak şekilde
    chart_data = []
    cumulative = 0.0
    for d in sorted(month_daily.keys()):
        cumulative += month_daily[d]
        chart_data.append({"date": d, "actual": round(cumulative, 2), "projected": None})

    if days_remaining > 0:
        last_actual_date = sorted(month_daily.keys())[-1] if month_daily else month_start.isoformat()
        last_actual_cumulative = cumulative
        chart_data.append({"date": last_actual_date, "actual": None, "projected": round(last_actual_cumulative, 2)})
        for i in range(1, days_remaining + 1):
            proj_date = (last_date + timedelta(days=i)).isoformat()
            last_actual_cumulative += avg_daily_cost
            chart_data.append({"date": proj_date, "actual": None, "projected": round(last_actual_cumulative, 2)})

    return {
        "available": True,
        "current_month": last_date.strftime("%Y-%m"),
        "last_data_date": last_date_str,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "days_in_month": days_in_month,
        "month_to_date_total": round(month_to_date_total, 2),
        "avg_daily_cost": round(avg_daily_cost, 2),
        "estimated_month_end": round(estimated_month_end, 2),
        "trend_pct": round(trend_pct, 1) if trend_pct is not None else None,
        "confidence_score": _confidence_score(recent_values),
        "top_increasing_services": top_increasing,
        "top_decreasing_services": top_decreasing,
        "chart_data": chart_data,
    }

def generate_forecast_insight(forecast_data: dict, language: str = "tr") -> str:
    """Tahmin verisini doğal dilde yorumlar (LLM). Forecast hesaplaması
    zaten tamamlanmış GERÇEK sayılar üzerinden -- LLM sadece yorum yazar,
    yeni sayı üretmez (halüsinasyon önleme, projenin geneliyle tutarlı)."""
    import json
    from .llm_client import get_llm
    from .prompts import FORECAST_INSIGHT_PROMPT, LANGUAGE_NAMES

    llm = get_llm()
    prompt = FORECAST_INSIGHT_PROMPT.format(
        language_name=LANGUAGE_NAMES.get(language, "Türkçe"),
        forecast_json=json.dumps(forecast_data, ensure_ascii=False, default=str),
    )
    response = llm.invoke([{"role": "user", "content": prompt}])
    text = response.content.strip()
    if not text:
        raise ValueError("LLM boş yanıt döndürdü")
    return text