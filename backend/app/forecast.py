"""
forecast.py
AI Cost Forecast -- geçmiş günlük maliyet verilerinden, iyileştirilmiş
bir yöntemle ay sonu maliyet tahmini üretir.

DÜRÜSTLÜK NOTU: Bu, gerçek bir zaman serisi modeli (ARIMA, Prophet vb.)
DEĞİL -- kasıtlı olarak basit ama SAĞLAM (robust) bir yöntem kullanılıyor:
"son N günün TEMİZLENMİŞ (eksik/aykırı günler çıkarılmış) ortalamasını,
varsa trend'e göre AĞIRLIKLANDIRIP kalan günlere yay". İki sebebi var:
  1. Veri seti sentetik/mock olduğu için gerçek mevsimsellik/trend
     paternleri taşımıyor -- karmaşık bir model burada yanlış bir
     kesinlik hissi verir.
  2. "Confidence Score", istatistiksel bir p-değeri DEĞİL -- günlük
     maliyetin ne kadar DEĞİŞKEN (volatile) olduğunu yansıtan basit
     bir sezgisel (heuristic) puan. Bu açıkça böyle belgeleniyor ki
     yanlış bir güven hissi yaratılmasın.

v2 -- 3 İYİLEŞTİRME EKLENDİ (kullanıcı testinde bulunan gerçek sorun
üzerine):
  1. BUGÜNÜN EKSİK VERİSİ SORUNU: Azure Cost Management API'si "bugünün"
     verisini anında tam raporlamaz (bkz. scheduler.py/dashboard.py'deki
     SyncLog mekanizması). Eskiden bu eksik gün, ortalama hesaplamasına
     dahil ediliyordu ve tahmini OLDUĞUNDAN DÜŞÜK gösteriyordu (kanıt:
     bir günde normalde ~$47 iken, henüz tamamlanmamış bir günde $0.77
     görülmüştü). Artık SyncLog'a bakılıp, bugünün verisi henüz yeterli
     sayıda senkronizasyon turu görmediyse, o gün ORTALAMA hesaplamasından
     ÇIKARILIYOR (month_to_date_total'dan DEĞİL -- o hâlâ gerçek harcamayı
     yansıtmalı, sadece "kalan günler için günlük oran" hesabından).
  2. AYKIRI DEĞER (OUTLIER) TESPİTİ: Bir günde tek seferlik büyük bir
     harcama (ör. bir rezervasyon satın alımı) varsa, IQR (çeyrekler
     arası açıklık) yöntemiyle tespit edilip günlük ortalamadan
     ÇIKARILIYOR -- aksi hâlde tek bir anormal gün, tüm ay sonu
     tahminini çarpıtabilir.
  3. TREND-AĞIRLIKLI ORTALAMA: Son 14 günün İLK YARISI ile İKİNCİ
     YARISI karşılaştırılıp güçlü bir artış/azalış eğilimi (%15+)
     varsa, düz ortalama yerine bu eğilimi yansıtan bir günlük oran
     kullanılıyor -- aksi hâlde sürekli artan/azalan bir maliyet
     paterni, düz ortalamayla "düzleştirilip" yanlış tahmine yol açar.
"""
import os
import statistics
from datetime import date, timedelta, datetime
from calendar import monthrange
from .database import get_connection


def _daily_totals(conn, start_date: str, end_date: str) -> dict[str, float]:
    rows = conn.execute(
        "SELECT UsageDate, SUM(PreTaxCost) AS total FROM CloudCosts "
        "WHERE UsageDate BETWEEN ? AND ? GROUP BY UsageDate ORDER BY UsageDate",
        (start_date, end_date),
    ).fetchall()
    return {r["usagedate"]: r["total"] for r in rows}

def _daily_charge_type_breakdown(conn, target_date: str) -> dict:
    """Belirli bir günün toplam maliyetinin ne kadarının 'Purchase'
    (tek seferlik satın alma, ör. rezervasyon) ve ne kadarının 'Usage'
    (sürekli/tekrar eden kullanım) kaynaklı olduğunu döndürür. Bu,
    aykırı bir günün NEDENİNİ ayırt etmek için kullanılır."""
    rows = conn.execute(
        "SELECT ChargeType, SUM(PreTaxCost) AS total FROM CloudCosts "
        "WHERE UsageDate = ? GROUP BY ChargeType",
        (target_date,),
    ).fetchall()
    breakdown = {r["chargetype"]: r["total"] for r in rows}
    total = sum(breakdown.values()) or 1.0
    purchase_total = breakdown.get("Purchase", 0.0)
    return {
        "purchase_total": purchase_total,
        "purchase_pct": round(purchase_total / total * 100, 1),
    }

def _is_today_data_incomplete(conn, last_date_str: str) -> bool:
    """dashboard.py'deki AYNI mantık: veri setinin en son günü, gerçek
    bugünün tarihiyle aynıysa VE bugün için beklenen sayıda otomatik
    senkronizasyon turu (24 / AZURE_SYNC_INTERVAL_HOURS) henüz
    tamamlanmadıysa, bu günün verisi muhtemelen EKSİK sayılır."""
    is_today = (last_date_str == datetime.now().strftime("%Y-%m-%d"))
    if not is_today:
        return False
    try:
        sync_interval_hours = int(os.getenv("AZURE_SYNC_INTERVAL_HOURS", "4"))
        expected_daily_syncs = max(1, 24 // sync_interval_hours)
        row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM SyncLog WHERE SyncedAt::date = CURRENT_DATE"
        ).fetchone()
        return row["cnt"] < expected_daily_syncs
    except Exception:
        # SyncLog tablosu henüz yoksa ya da sorgu başarısız olursa,
        # temkinli davranıp "eksik olabilir" varsayımını KORU.
        return True


def _detect_outliers(conn, daily_dict: dict[str, float]) -> dict:
    """IQR (çeyrekler arası açıklık) yöntemiyle aykırı GÜNLERİ tespit
    eder VE her aykırı günün NEDENİNİ (tek seferlik satın alma mı,
    kalıcı kullanım artışı mı) ChargeType dağılımına bakarak ayırt
    eder:
      - Aykırılığın çoğu 'Purchase' kaynaklıysa (>%50) -> tek seferlik
        kabul edilir, ORTALAMADAN ÇIKARILIR (kalıcı bir eğilim değil).
      - Aykırılığın çoğu 'Usage' kaynaklıysa -> KALICI bir kullanım
        artışı/azalışı olabilir, ortalamadan ÇIKARILMAZ (aksi hâlde
        gerçek bir maliyet değişimi görmezden gelinmiş olur)."""
    dates = sorted(daily_dict.keys())
    values = [daily_dict[d] for d in dates]

    if len(values) < 4:
        return {"clean_values": values, "excluded_dates": [], "kept_as_trend_dates": []}

    sorted_vals = sorted(values)
    n = len(sorted_vals)
    q1 = sorted_vals[n // 4]
    q3 = sorted_vals[(3 * n) // 4]
    iqr = q3 - q1
    if iqr == 0:
        return {"clean_values": values, "excluded_dates": [], "kept_as_trend_dates": []}

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr

    clean_values = []
    excluded_dates = []
    kept_as_trend_dates = []
    for d, v in zip(dates, values):
        if lower_bound <= v <= upper_bound:
            clean_values.append(v)
            continue
        # Aykırı bir gün bulundu -- NEDENİNİ araştır.
        breakdown = _daily_charge_type_breakdown(conn, d)
        if breakdown["purchase_pct"] > 50:
            # Tek seferlik satın alma -- kalıcı değil, ortalamadan çıkar.
            excluded_dates.append({"date": d, "value": v, "reason": "one_time_purchase", "purchase_pct": breakdown["purchase_pct"]})
        else:
            # Kullanım kaynaklı -- kalıcı bir değişim olabilir, ortalamada TUT.
            clean_values.append(v)
            kept_as_trend_dates.append({"date": d, "value": v, "reason": "usage_spike", "purchase_pct": breakdown["purchase_pct"]})

    if len(clean_values) < 3:
        return {"clean_values": values, "excluded_dates": [], "kept_as_trend_dates": []}

    return {"clean_values": clean_values, "excluded_dates": excluded_dates, "kept_as_trend_dates": kept_as_trend_dates}


def _compute_daily_rate(conn, daily_dict: dict[str, float], today_incomplete: bool) -> dict:
    """Kalan günler için kullanılacak GÜNLÜK ORAN'ı hesaplar --
    3 iyileştirmeyi (eksik gün hariç tutma, NEDEN-analizli aykırı değer
    temizleme, trend ağırlıklandırma) birlikte uygular. Şeffaflık için
    ara adımların metadata'sını da döndürür."""
    dates_sorted = sorted(daily_dict.keys())
    values_sorted = [daily_dict[d] for d in dates_sorted]

    excluded_today = None
    if today_incomplete and dates_sorted:
        excluded_today = dates_sorted[-1]
        dates_sorted = dates_sorted[:-1]
        values_sorted = values_sorted[:-1]
        remaining_dict = {d: daily_dict[d] for d in dates_sorted}
    else:
        remaining_dict = daily_dict

    if not values_sorted:
        return {
            "daily_rate": 0.0, "excluded_today": excluded_today,
            "outliers_removed": 0, "trend_applied": False,
            "clean_values": [], "outlier_details": [], "usage_spike_details": [],
        }

    outlier_result = _detect_outliers(conn, remaining_dict)
    clean_values = outlier_result["clean_values"]

    trend_applied = False
    if len(clean_values) >= 6:
        mid = len(clean_values) // 2
        first_half_avg = statistics.mean(clean_values[:mid])
        second_half_avg = statistics.mean(clean_values[mid:])
        if first_half_avg > 0:
            trend_change = (second_half_avg - first_half_avg) / first_half_avg
            # Güçlü bir eğilim (%15+) varsa, düz ortalama yerine İKİNCİ
            # YARININ ortalamasını kullan -- bu, "en güncel" davranışı
            # daha iyi yansıtır, düz ortalama gibi eski/yeni günleri
            # eşit ağırlıklandırıp trend'i "düzleştirmez".
            if abs(trend_change) >= 0.15:
                daily_rate = second_half_avg
                trend_applied = True
            else:
                daily_rate = statistics.mean(clean_values)
        else:
            daily_rate = statistics.mean(clean_values)
    else:
        daily_rate = statistics.mean(clean_values)

    return {
        "daily_rate": daily_rate,
        "excluded_today": excluded_today,
        "outliers_removed": len(outlier_result["excluded_dates"]),
        "trend_applied": trend_applied,
        "clean_values": clean_values,
        "outlier_details": outlier_result["excluded_dates"],
        "usage_spike_details": outlier_result["kept_as_trend_dates"],
    }


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
    # NOT: month_to_date_total, "şu ana kadar GERÇEKTEN harcanan" miktarı
    # yansıtır -- bugünün verisi eksik olsa bile burada ÇIKARILMAZ, çünkü
    # bu alan bir tahmin değil, gerçekleşmiş harcamanın kendisidir.
    month_to_date_total = sum(month_daily.values())

    today_incomplete = _is_today_data_incomplete(conn, last_date_str)

    window_start = max(month_start, last_date - timedelta(days=13))
    recent_daily = _daily_totals(conn, window_start.isoformat(), last_date.isoformat())
    rate_info = _compute_daily_rate(conn, recent_daily, today_incomplete)
    avg_daily_cost = rate_info["daily_rate"]
    recent_values = rate_info.get("clean_values", list(recent_daily.values()))

    days_elapsed = (last_date - month_start).days + 1
    days_remaining = days_in_month - days_elapsed
    estimated_month_end = month_to_date_total + avg_daily_cost * days_remaining

    # NOT: Bugünün verisi eksikse (today_incomplete), "son 7 gün"
    # penceresini bugünü İÇERMEYECEK şekilde bir gün GERİYE kaydırıyoruz.
    # Aksi hâlde bugünün eksik/düşük rakamı, TÜM servislerin toplamını
    # aynı oranda yapay olarak düşürüp "En Çok Artan Servisler"
    # listesinde -- aslında hiçbiri artmamışken -- anlamsız, birbirine
    # neredeyse eşit negatif yüzdeler görünmesine yol açıyordu (kullanıcı
    # testinde bulunan gerçek sorun).
    comparison_end_date = (last_date - timedelta(days=1)) if today_incomplete else last_date

    last_7_start = comparison_end_date - timedelta(days=6)
    prev_7_start = comparison_end_date - timedelta(days=13)
    prev_7_end = comparison_end_date - timedelta(days=7)
    last_7_daily = _daily_totals(conn, last_7_start.isoformat(), comparison_end_date.isoformat())
    prev_7_daily = _daily_totals(conn, prev_7_start.isoformat(), prev_7_end.isoformat())
    last_7_avg = statistics.mean(last_7_daily.values()) if last_7_daily else 0.0
    prev_7_avg = statistics.mean(prev_7_daily.values()) if prev_7_daily else 0.0
    trend_pct = ((last_7_avg - prev_7_avg) / prev_7_avg * 100) if prev_7_avg else None

    # Servis bazında değişim (son 7 gün vs önceki 7 gün) -- aynı düzeltilmiş pencere
    service_rows_recent = conn.execute(
        "SELECT ServiceName, SUM(PreTaxCost) AS total FROM CloudCosts "
        "WHERE UsageDate BETWEEN ? AND ? GROUP BY ServiceName",
        (last_7_start.isoformat(), comparison_end_date.isoformat()),
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
        "today_excluded_from_average": rate_info.get("excluded_today"),
        "outliers_removed_count": rate_info.get("outliers_removed", 0),
        "trend_weighting_applied": rate_info.get("trend_applied", False),
        "outlier_details": rate_info.get("outlier_details", []),
        "usage_spike_details": rate_info.get("usage_spike_details", []),
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