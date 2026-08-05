"""
dashboard.py
Dashboard sayfası için LLM GEREKTİRMEYEN, sabit SQL agregasyonları.
PostgreSQL'e geçiş NOTU: PostgreSQL, tırnaksız kolon adlarını (ör.
ServiceName) otomatik olarak küçük harfe çevirip saklıyor (servicename).
Bu yüzden GERÇEK TABLO KOLONLARINA (ServiceName, ResourceName,
ResourceGroup gibi) erişimler küçük harfle yapılıyor. SQL alias'ları
zaten küçük harfle yazıldığı için (AS total, AS cnt gibi) onlara
dokunulmadı.

Zaman aralığı (timeframe) notu: get_period_summary artık dropdown'daki
5 seçeneği (30d, 3m, 6m, 12m, all) destekliyor -- "all" seçeneğinde
karşılaştırma dönemi olmadığı için cost_change_pct/previous_total gibi
alanlar None döner (frontend bunu "karşılaştırma verisi yok" olarak
göstermeli).
"""
from datetime import date, timedelta
from .database import get_connection

_SERVICE_CATEGORY = {
    "Azure SQL Database": "Veritabanı", "Azure SQL Managed Instance": "Veritabanı",
    "Azure Cosmos DB": "Veritabanı",
    "Virtual Machines": "Konteyner & Compute", "Azure Kubernetes Service": "Konteyner & Compute",
    "Azure App Service": "Konteyner & Compute", "Azure Functions": "Konteyner & Compute",
    "Container Registry": "Konteyner & Compute",
    "Azure Databricks": "Analitik", "Event Hubs": "Analitik", "Service Bus": "Analitik",
    "Log Analytics": "İzleme & Güvenlik", "Azure Monitor": "İzleme & Güvenlik",
    "Microsoft Defender for Cloud": "İzleme & Güvenlik", "Azure Backup": "İzleme & Güvenlik",
    "Key Vault": "İzleme & Güvenlik", "Azure Firewall": "İzleme & Güvenlik",
    "Azure DDoS Protection": "İzleme & Güvenlik",
}
_CATEGORY_ORDER = ["Veritabanı", "Konteyner & Compute", "Analitik", "İzleme & Güvenlik", "Diğer"]

_CATEGORY_EN = {
    "Veritabanı": "Database", "Konteyner & Compute": "Container & Compute",
    "Analitik": "Analytics", "İzleme & Güvenlik": "Monitoring & Security", "Diğer": "Other",
}

_MONTH_EXPR = "TO_CHAR(UsageDate::date, 'YYYY-MM')"
_WEEK_EXPR = "TO_CHAR(UsageDate::date, 'IYYY-\"W\"IW')"

# Dropdown'daki her seçeneğin kaç güne karşılık geldiği. "all" özel
# olarak ele alınıyor (window_days'e ihtiyacı yok, veri setinin
# tamamını kapsar).
_TIMEFRAME_DAYS = {
    "daily": 1,
    "30d": 30,
    "3m": 90,
    "6m": 180,
    "12m": 365,
}


def _translate_category(name: str, language: str) -> str:
    return _CATEGORY_EN.get(name, name) if language == "en" else name


def _fetch_all(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def get_dashboard_summary(language: str = "tr", user_id: int = None) -> dict:
    conn = get_connection()

    months = [r["m"] for r in conn.execute(
        f"SELECT DISTINCT {_MONTH_EXPR} AS m FROM CloudCosts ORDER BY m"
    ).fetchall()]
    current_month = months[-1] if months else None
    previous_month = months[-2] if len(months) >= 2 else None

    def month_total(month):
        if not month:
            return 0.0
        row = conn.execute(
            f"SELECT COALESCE(SUM(PreTaxCost),0) AS t FROM CloudCosts WHERE {_MONTH_EXPR} = ?",
            (month,),
        ).fetchone()
        return row["t"]

    total_cost = month_total(current_month)
    prev_cost = month_total(previous_month)
    cost_change_pct = ((total_cost - prev_cost) / prev_cost * 100) if prev_cost else None

    rec_row = conn.execute(
        "SELECT COUNT(*) AS cnt, COALESCE(SUM(PotentialSavings),0) AS total "
        "FROM CostRecommendations WHERE Status = 'Beklemede' AND UserId = ?",
        (user_id,),
    ).fetchone()
    pending_count = rec_row["cnt"]
    potential_savings = rec_row["total"]

    resource_count = conn.execute(
        "SELECT COUNT(DISTINCT ResourceId) AS cnt FROM CloudCosts"
    ).fetchone()["cnt"]

    trend = _fetch_all(conn, f"""
        SELECT {_MONTH_EXPR} AS month, SUM(PreTaxCost) AS total
        FROM CloudCosts GROUP BY month ORDER BY month
    """)

    service_rows = _fetch_all(conn, f"""
        SELECT ServiceName, SUM(PreTaxCost) AS total
        FROM CloudCosts WHERE {_MONTH_EXPR} = ?
        GROUP BY ServiceName ORDER BY total DESC
    """, (current_month,)) if current_month else []

    top_services = service_rows[:5]
    other_total = sum(r["servicename"] and r["total"] for r in top_services) if False else sum(r["total"] for r in service_rows[5:])
    service_breakdown = [
        {"name": r["servicename"], "total": r["total"], "pct": round(r["total"] / total_cost * 100, 1) if total_cost else 0}
        for r in top_services
    ]
    if other_total > 0:
        service_breakdown.append({
            "name": _translate_category("Diğer", language), "total": other_total,
            "pct": round(other_total / total_cost * 100, 1) if total_cost else 0,
        })

    def group_totals(month):
        rows = _fetch_all(conn, f"""
            SELECT ResourceGroup, SUM(PreTaxCost) AS total, COUNT(DISTINCT ResourceId) AS resource_count
            FROM CloudCosts WHERE {_MONTH_EXPR} = ?
            GROUP BY ResourceGroup
        """, (month,))
        return {r["resourcegroup"]: r for r in rows}

    current_groups = group_totals(current_month) if current_month else {}
    previous_groups = group_totals(previous_month) if previous_month else {}

    top_resource_groups = []
    for name, cur in sorted(current_groups.items(), key=lambda kv: kv[1]["total"], reverse=True)[:5]:
        prev = previous_groups.get(name)
        change_pct = ((cur["total"] - prev["total"]) / prev["total"] * 100) if prev and prev["total"] else None
        top_resource_groups.append({
            "resource_group": name,
            "total": cur["total"],
            "resource_count": cur["resource_count"],
            "change_pct": round(change_pct, 1) if change_pct is not None else None,
        })

    prev_service_rows = _fetch_all(conn, f"""
        SELECT ServiceName, SUM(PreTaxCost) AS total
        FROM CloudCosts WHERE {_MONTH_EXPR} = ?
        GROUP BY ServiceName
    """, (previous_month,)) if previous_month else []
    prev_by_service = {r["servicename"]: r["total"] for r in prev_service_rows}

    spikes = []
    for r in service_rows:
        prev_val = prev_by_service.get(r["servicename"])
        if prev_val and prev_val > 0:
            change_pct = (r["total"] - prev_val) / prev_val * 100
            if change_pct > 5:
                spikes.append({
                    "service_name": r["servicename"],
                    "change_pct": round(change_pct, 1),
                    "current_total": r["total"],
                    "delta": round(r["total"] - prev_val, 2),
                })
    spikes.sort(key=lambda s: s["change_pct"], reverse=True)

    cat_totals = {}
    for r in service_rows:
        cat = _SERVICE_CATEGORY.get(r["servicename"], "Diğer")
        cat_totals[cat] = cat_totals.get(cat, 0) + r["total"]
    category_breakdown = [
        {"category": _translate_category(c, language), "total": round(cat_totals[c], 2),
         "pct": round(cat_totals[c] / total_cost * 100, 1) if total_cost else 0}
        for c in _CATEGORY_ORDER if c in cat_totals
    ]
    category_breakdown.sort(key=lambda c: c["total"], reverse=True)

    delta_amount = round(total_cost - prev_cost, 2) if previous_month else None

    insights = []
    if language == "en":
        if category_breakdown:
            top_cat = category_breakdown[0]
            insights.append(f"{top_cat['category']} services make up %{top_cat['pct']:.0f} of total cost.")
        if cost_change_pct is not None:
            if cost_change_pct > 0:
                insights.append(f"Costs increased by %{cost_change_pct:.1f} compared to last month — worth monitoring closely.")
            elif cost_change_pct < 0:
                insights.append(f"Costs decreased by %{abs(cost_change_pct):.1f} compared to last month — a positive trend.")
            else:
                insights.append("Costs did not change compared to last month.")
        if pending_count > 0:
            insights.append(f"There is a %{_fmt_short_money(potential_savings)} savings potential across {pending_count} pending recommendations.")
        else:
            insights.append("There are currently no recommendations awaiting review.")
    else:
        if category_breakdown:
            top_cat = category_breakdown[0]
            insights.append(f"{top_cat['category']} hizmetleri toplam maliyetin %{top_cat['pct']:.0f}'ini oluşturuyor.")
        if cost_change_pct is not None:
            if cost_change_pct > 0:
                insights.append(f"Bu ay maliyetler bir önceki aya göre %{cost_change_pct:.1f} arttı, yakından takip edilmesi önerilir.")
            elif cost_change_pct < 0:
                insights.append(f"Bu ay maliyetler bir önceki aya göre %{abs(cost_change_pct):.1f} azaldı, olumlu bir trend.")
            else:
                insights.append("Bu ay maliyetler bir önceki aya göre değişmedi.")
        if pending_count > 0:
            insights.append(f"Uygulanması bekleyen {pending_count} öneri ile {_fmt_short_money(potential_savings)} tasarruf potansiyeli mevcut.")
        else:
            insights.append("Şu an değerlendirme bekleyen bir öneri bulunmuyor.")

    conn.close()

    return {
        "current_month": current_month,
        "previous_month": previous_month,
        "total_cost": round(total_cost, 2),
        "previous_total": round(prev_cost, 2) if previous_month else None,
        "delta_amount": delta_amount,
        "cost_change_pct": round(cost_change_pct, 1) if cost_change_pct is not None else None,
        "potential_savings": round(potential_savings, 2),
        "pending_recommendations": pending_count,
        "resource_count": resource_count,
        "trend": [{"month": t["month"], "total": round(t["total"], 2)} for t in trend],
        "service_breakdown": service_breakdown,
        "category_breakdown": category_breakdown,
        "top_resource_groups": top_resource_groups,
        "cost_spikes": spikes[:3],
        "insights": insights,
    }


def _fmt_short_money(n: float) -> str:
    return f"${n:,.2f}"


def get_resource_group_detail(resource_group: str, language: str = "tr") -> dict:
    conn = get_connection()

    months = [r["m"] for r in conn.execute(
        f"SELECT DISTINCT {_MONTH_EXPR} AS m FROM CloudCosts ORDER BY m"
    ).fetchall()]
    current_month = months[-1] if months else None
    previous_month = months[-2] if len(months) >= 2 else None

    def resource_totals(month):
        if not month:
            return {}
        rows = conn.execute(
            f"SELECT ResourceName, ServiceName, SUM(PreTaxCost) AS total FROM CloudCosts "
            f"WHERE ResourceGroup = ? AND {_MONTH_EXPR} = ? "
            f"GROUP BY ResourceName, ServiceName",
            (resource_group, month),
        ).fetchall()
        return {r["resourcename"]: {"service": r["servicename"], "total": r["total"]} for r in rows}

    current = resource_totals(current_month)
    previous = resource_totals(previous_month)
    conn.close()

    resources = []
    for name, info in current.items():
        prev_total = previous.get(name, {}).get("total")
        change_pct = ((info["total"] - prev_total) / prev_total * 100) if prev_total else None
        resources.append({
            "resource_name": name,
            "service_name": info["service"],
            "total": round(info["total"], 2),
            "change_pct": round(change_pct, 1) if change_pct is not None else None,
        })
    resources.sort(key=lambda r: r["total"], reverse=True)

    group_total = sum(r["total"] for r in resources)

    return {
        "resource_group": resource_group,
        "current_month": current_month,
        "previous_month": previous_month,
        "total": round(group_total, 2),
        "resources": resources,
    }


def get_service_breakdown_by_period(granularity: str = "month", language: str = "tr") -> dict:
    conn = get_connection()
    date_expr = _MONTH_EXPR if granularity == "month" else _WEEK_EXPR

    periods = [r["p"] for r in conn.execute(
        f"SELECT DISTINCT {date_expr} AS p FROM CloudCosts ORDER BY p"
    ).fetchall()]

    top_services_rows = conn.execute(
        "SELECT ServiceName, SUM(PreTaxCost) AS total FROM CloudCosts "
        "GROUP BY ServiceName ORDER BY total DESC LIMIT 5"
    ).fetchall()
    top_services = [r["servicename"] for r in top_services_rows]
    other_label = "Diğer" if language == "tr" else "Other"

    result = []
    for period in periods:
        row_data = {"period": period}
        period_rows = conn.execute(
            f"SELECT ServiceName, SUM(PreTaxCost) AS total FROM CloudCosts "
            f"WHERE {date_expr} = ? GROUP BY ServiceName",
            (period,),
        ).fetchall()
        service_totals = {r["servicename"]: r["total"] for r in period_rows}

        other_total = 0.0
        for svc, total in service_totals.items():
            if svc in top_services:
                row_data[svc] = round(total, 2)
            else:
                other_total += total
        for svc in top_services:
            row_data.setdefault(svc, 0.0)
        row_data[other_label] = round(other_total, 2)
        result.append(row_data)

    conn.close()
    return {"services": top_services + [other_label], "data": result}


def get_resources(search: str = "", limit: int = 50, offset: int = 0) -> dict:
    conn = get_connection()

    current_month_row = conn.execute(
        f"SELECT MAX({_MONTH_EXPR}) AS m FROM CloudCosts"
    ).fetchone()
    current_month = current_month_row["m"]

    where_clause = ""
    search_params = []
    if search:
        where_clause = "WHERE ResourceName LIKE ? OR ServiceName LIKE ? OR ResourceGroup LIKE ?"
        like = f"%{search}%"
        search_params = [like, like, like]

    count_row = conn.execute(
        f"SELECT COUNT(DISTINCT ResourceName) AS cnt FROM CloudCosts {where_clause}",
        search_params,
    ).fetchone()
    total_count = count_row["cnt"]

    rows = conn.execute(
        f"""
        SELECT ResourceName, ServiceName, ResourceGroup,
               SUM(PreTaxCost) AS total_cost,
               SUM(CASE WHEN {_MONTH_EXPR} = ? THEN PreTaxCost ELSE 0 END) AS current_month_cost
        FROM CloudCosts
        {where_clause}
        GROUP BY ResourceName, ServiceName, ResourceGroup
        ORDER BY total_cost DESC
        LIMIT ? OFFSET ?
        """,
        [current_month] + search_params + [limit, offset],
    ).fetchall()

    conn.close()
    return {
        "total_count": total_count,
        "resources": [
            {
                "resource_name": r["resourcename"],
                "service_name": r["servicename"],
                "resource_group": r["resourcegroup"],
                "total_cost": round(r["total_cost"], 2),
                "current_month_cost": round(r["current_month_cost"], 2),
            }
            for r in rows
        ],
    }


def get_period_summary(timeframe: str = "30d", language: str = "tr", user_id: int = None) -> dict:
    """Dashboard'daki zaman aralığı dropdown'ı için ANA fonksiyon.

    timeframe değerleri:
      "30d" -> son 30 gün (dropdown: "Son 30 gün")
      "3m"  -> son 90 gün (dropdown: "Son 3 Ay")
      "6m"  -> son 180 gün (dropdown: "Son 6 Ay")
      "12m" -> son 365 gün (dropdown: "Son 12 Ay")
      "all" -> veri setindeki İLK gün ile SON gün arası (dropdown: "Tüm Zamanlar")

    "all" seçeneğinde önceki bir dönemle karşılaştırma YAPILAMAZ (zaten
    tüm veri gösteriliyor) -- bu durumda previous_total, delta_amount,
    cost_change_pct alanları None döner; frontend bu None durumunu
    "karşılaştırma verisi yok" olarak göstermelidir.

    Ayrıca dönemden BAĞIMSIZ olarak, veri setinin en son GÜNÜNÜN
    (today_date) toplam maliyetini (today_cost) her zaman döndürür --
    Dashboard'daki sabit "Bugünkü Maliyet" kartı için.
    """
    conn = get_connection()

    last_date_row = conn.execute("SELECT MAX(UsageDate) AS d FROM CloudCosts").fetchone()
    last_date_str = last_date_row["d"]
    first_date_row = conn.execute("SELECT MIN(UsageDate) AS d FROM CloudCosts").fetchone()
    first_date_str = first_date_row["d"]

    if not last_date_str or not first_date_str:
        conn.close()
        return {
            "current_month": None, "previous_month": None, "total_cost": 0, "previous_total": None,
            "delta_amount": None, "cost_change_pct": None, "potential_savings": 0,
            "pending_recommendations": 0, "resource_count": 0, "today_cost": 0, "today_date": None,
            "trend": [],
            "service_breakdown": [], "category_breakdown": [], "top_resource_groups": [],
            "cost_spikes": [], "insights": [],
        }

    last_date = date.fromisoformat(last_date_str)
    first_date = date.fromisoformat(first_date_str)

    if timeframe == "all":
        current_start = first_date.isoformat()
        current_end = last_date.isoformat()
        previous_start = None
        previous_end = None
    else:
        window_days = _TIMEFRAME_DAYS.get(timeframe, 30)
        current_start_date = max(first_date, last_date - timedelta(days=window_days - 1))
        current_start = current_start_date.isoformat()
        current_end = last_date.isoformat()

        previous_end_date = current_start_date - timedelta(days=1)
        previous_start_date = max(first_date, previous_end_date - timedelta(days=window_days - 1))
        if previous_start_date <= previous_end_date and previous_end_date >= first_date:
            previous_start = previous_start_date.isoformat()
            previous_end = previous_end_date.isoformat()
        else:
            # Veri seti, karşılaştırma için gereken önceki pencereyi
            # kapsamıyor (ör. "12 Ay" seçilmiş ama elimizde sadece 12 ay var)
            previous_start = None
            previous_end = None

    period_label = f"{current_start} — {current_end}"
    previous_label = f"{previous_start} — {previous_end}" if previous_start else None

    def range_total(start, end):
        if not start:
            return None
        row = conn.execute(
            "SELECT COALESCE(SUM(PreTaxCost),0) AS t FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?",
            (start, end),
        ).fetchone()
        return row["t"]

    total_cost = range_total(current_start, current_end) or 0.0
    prev_cost = range_total(previous_start, previous_end)
    cost_change_pct = ((total_cost - prev_cost) / prev_cost * 100) if prev_cost else None
    delta_amount = round(total_cost - prev_cost, 2) if prev_cost is not None else None

    rec_row = conn.execute(
        "SELECT COUNT(*) AS cnt, COALESCE(SUM(PotentialSavings),0) AS total "
        "FROM CostRecommendations WHERE Status = 'Beklemede' AND UserId = ?",
        (user_id,),
    ).fetchone()
    pending_count = rec_row["cnt"]
    potential_savings = rec_row["total"]

    resource_count = conn.execute("SELECT COUNT(DISTINCT ResourceId) AS cnt FROM CloudCosts").fetchone()["cnt"]

    # Dönemden BAĞIMSIZ: veri setinin en son GÜNÜNÜN toplam maliyeti --
    # Dashboard'daki sabit "Bugünkü Maliyet" kartı için, dropdown'daki
    # seçime bakılmaksızın her zaman aynı (en güncel) tek günü gösterir.
    today_row = conn.execute(
        "SELECT COALESCE(SUM(PreTaxCost), 0) AS t FROM CloudCosts WHERE UsageDate = ?",
        (last_date_str,),
    ).fetchone()
    today_cost = today_row["t"]

    # Trend grafiği: aralık 60 günden uzunsa GÜNLÜK yerine AYLIK
    # gruplama yapılıyor -- aksi hâlde "Tüm Zamanlar" (365+ gün) trend
    # grafiğinde yüzlerce nokta olur, okunmaz hâle gelir.
    span_days = (date.fromisoformat(current_end) - date.fromisoformat(current_start)).days
    if span_days > 60:
        trend = _fetch_all(conn, f"""
            SELECT {_MONTH_EXPR} AS month, SUM(PreTaxCost) AS total
            FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?
            GROUP BY month ORDER BY month
        """, (current_start, current_end))
    else:
        trend = _fetch_all(conn, """
            SELECT UsageDate AS month, SUM(PreTaxCost) AS total
            FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?
            GROUP BY UsageDate ORDER BY UsageDate
        """, (current_start, current_end))

    service_rows = _fetch_all(conn, """
        SELECT ServiceName, SUM(PreTaxCost) AS total
        FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?
        GROUP BY ServiceName ORDER BY total DESC
    """, (current_start, current_end))

    top_services = service_rows[:5]
    other_total = sum(r["total"] for r in service_rows[5:])
    service_breakdown = [
        {"name": r["servicename"], "total": r["total"], "pct": round(r["total"] / total_cost * 100, 1) if total_cost else 0}
        for r in top_services
    ]
    if other_total > 0:
        service_breakdown.append({
            "name": _translate_category("Diğer", language), "total": other_total,
            "pct": round(other_total / total_cost * 100, 1) if total_cost else 0,
        })

    prev_service_rows = _fetch_all(conn, """
        SELECT ServiceName, SUM(PreTaxCost) AS total
        FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?
        GROUP BY ServiceName
    """, (previous_start, previous_end)) if previous_start else []
    prev_by_service = {r["servicename"]: r["total"] for r in prev_service_rows}

    spikes = []
    for r in service_rows:
        prev_val = prev_by_service.get(r["servicename"])
        if prev_val and prev_val > 0:
            change_pct = (r["total"] - prev_val) / prev_val * 100
            if change_pct > 5:
                spikes.append({
                    "service_name": r["servicename"], "change_pct": round(change_pct, 1),
                    "current_total": r["total"], "delta": round(r["total"] - prev_val, 2),
                })
    spikes.sort(key=lambda s: s["change_pct"], reverse=True)

    cat_totals = {}
    for r in service_rows:
        cat = _SERVICE_CATEGORY.get(r["servicename"], "Diğer")
        cat_totals[cat] = cat_totals.get(cat, 0) + r["total"]
    category_breakdown = [
        {"category": _translate_category(c, language), "total": round(cat_totals[c], 2),
         "pct": round(cat_totals[c] / total_cost * 100, 1) if total_cost else 0}
        for c in _CATEGORY_ORDER if c in cat_totals
    ]
    category_breakdown.sort(key=lambda c: c["total"], reverse=True)

    def group_totals(start, end):
        if not start:
            return {}
        rows = _fetch_all(conn, """
            SELECT ResourceGroup, SUM(PreTaxCost) AS total, COUNT(DISTINCT ResourceId) AS resource_count
            FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?
            GROUP BY ResourceGroup
        """, (start, end))
        return {r["resourcegroup"]: r for r in rows}

    current_groups = group_totals(current_start, current_end)
    previous_groups = group_totals(previous_start, previous_end)
    top_resource_groups = []
    for name, cur in sorted(current_groups.items(), key=lambda kv: kv[1]["total"], reverse=True)[:5]:
        prev = previous_groups.get(name)
        change_pct = ((cur["total"] - prev["total"]) / prev["total"] * 100) if prev and prev["total"] else None
        top_resource_groups.append({
            "resource_group": name, "total": cur["total"], "resource_count": cur["resource_count"],
            "change_pct": round(change_pct, 1) if change_pct is not None else None,
        })

    insights = []
    if language == "en":
        if category_breakdown:
            top_cat = category_breakdown[0]
            insights.append(f"{top_cat['category']} services make up %{top_cat['pct']:.0f} of total cost.")
        if cost_change_pct is not None:
            direction = "increased" if cost_change_pct > 0 else "decreased"
            insights.append(f"Costs {direction} by %{abs(cost_change_pct):.1f} compared to the previous period.")
    else:
        if category_breakdown:
            top_cat = category_breakdown[0]
            insights.append(f"{top_cat['category']} hizmetleri toplam maliyetin %{top_cat['pct']:.0f}'ini oluşturuyor.")
        if cost_change_pct is not None:
            direction = "arttı" if cost_change_pct > 0 else "azaldı"
            insights.append(f"Maliyetler bir önceki döneme göre %{abs(cost_change_pct):.1f} {direction}.")

    conn.close()

    return {
        "current_month": period_label,
        "previous_month": previous_label,
        "total_cost": round(total_cost, 2),
        "previous_total": round(prev_cost, 2) if prev_cost is not None else None,
        "delta_amount": delta_amount,
        "cost_change_pct": round(cost_change_pct, 1) if cost_change_pct is not None else None,
        "potential_savings": round(potential_savings, 2),
        "pending_recommendations": pending_count,
        "resource_count": resource_count,
        "today_cost": round(today_cost, 2),
        "today_date": last_date_str,
        "trend": [{"month": t["month"], "total": round(t["total"], 2)} for t in trend],
        "service_breakdown": service_breakdown,
        "category_breakdown": category_breakdown,
        "top_resource_groups": top_resource_groups,
        "cost_spikes": spikes[:3],
        "insights": insights,
    }


def get_finops_score(language: str = "tr", user_id: int = None) -> dict:
    conn = get_connection()
    checks = []
    score = 0
    max_score = 0

    total_row = conn.execute("SELECT SUM(PreTaxCost) AS t FROM CloudCosts").fetchone()
    total_cost = total_row["t"] or 0

    # NOT: "Rezervasyon kullanımı" kontrolü kaldırıldı -- bu veri setinde
    # ServiceName/MeterCategory hiçbir zaman "Reservations" olarak
    # ETİKETLENMİYOR (kullanıcı testinde doğrulandı, eşleşme sıfır
    # çıktı), bu yüzden bu kontrol HER ZAMAN aynı sonucu verip anlamsız
    # bir madde hâline geliyordu. Yerine, veri setinde GERÇEKTEN test
    # edilmiş, hem "iyi" hem "kötü" çıkabilen bir kontrol konuldu:
    # kaç kaynağın HİÇ maliyet üretmediği (bugünkü test: %16.54).
    zero_cost_resource_rows = conn.execute("""
        SELECT ResourceName FROM CloudCosts
        GROUP BY ResourceName HAVING SUM(PreTaxCost) = 0
        ORDER BY ResourceName
    """).fetchall()
    zero_cost_details = [{"name": r["resourcename"], "cost": 0.0} for r in zero_cost_resource_rows]
    zero_cost_count = len(zero_cost_details)

    total_resource_row = conn.execute("SELECT COUNT(DISTINCT ResourceName) AS cnt FROM CloudCosts").fetchone()
    total_resource_count = total_resource_row["cnt"] or 1
    zero_cost_pct = (zero_cost_count / total_resource_count * 100) if total_resource_count else 0

    max_score += 20
    if zero_cost_pct <= 10:
        score += 20
        checks.append({
            "ok": True,
            "label_tr": f"Kullanılmayan kaynak oranı düşük (%{zero_cost_pct:.0f})",
            "label_en": f"Unused resource ratio is low (%{zero_cost_pct:.0f})",
            "details": zero_cost_details,
        })
    else:
        checks.append({
            "ok": False,
            "label_tr": f"Kaynakların %{zero_cost_pct:.0f}'i hiç maliyet üretmiyor, gözden geçirilmeli",
            "label_en": f"%{zero_cost_pct:.0f} of resources produce no cost, worth reviewing",
            "details": zero_cost_details,
        })

    idle_rows = conn.execute("""
        SELECT ResourceName, SUM(PreTaxCost) AS total_cost
        FROM CloudCosts
        GROUP BY ResourceName
        HAVING AVG(Quantity) < 5 AND SUM(PreTaxCost) > 50
        ORDER BY total_cost DESC
    """).fetchall()
    idle_count = len(idle_rows)
    idle_details = [{"name": r["resourcename"], "cost": round(r["total_cost"], 2)} for r in idle_rows]

    max_score += 20
    if idle_count == 0:
        score += 20
        checks.append({"ok": True, "label_tr": "Atıl kaynak tespit edilmedi", "label_en": "No idle resources detected", "details": []})
    else:
        checks.append({
            "ok": False,
            "label_tr": f"{idle_count} olası atıl kaynak tespit edildi",
            "label_en": f"{idle_count} possibly idle resources detected",
            "details": idle_details,
        })

    pending_row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM CostRecommendations WHERE Status = 'Beklemede' AND UserId = ?", (user_id,)
    ).fetchone()
    pending_count = pending_row["cnt"] or 0

    max_score += 20
    if pending_count <= 5:
        score += 20
        checks.append({"ok": True, "label_tr": "Bekleyen öneri sayısı makul", "label_en": "Pending recommendations are manageable", "details": []})
    else:
        checks.append({"ok": False, "label_tr": f"{pending_count} öneri beklemede, gözden geçirilmeli", "label_en": f"{pending_count} recommendations pending review", "details": []})

    last_date_row = conn.execute("SELECT MAX(UsageDate) AS d FROM CloudCosts").fetchone()
    last_date_str = last_date_row["d"]

    max_score += 20
    trend_pct = None
    if last_date_str:
        last_date_val = date.fromisoformat(last_date_str)
        last_7_start = last_date_val - timedelta(days=6)
        prev_7_start = last_date_val - timedelta(days=13)
        prev_7_end = last_date_val - timedelta(days=7)

        last_7_row = conn.execute(
            "SELECT AVG(daily) AS avg FROM (SELECT SUM(PreTaxCost) AS daily FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ? GROUP BY UsageDate) sub",
            (last_7_start.isoformat(), last_date_val.isoformat()),
        ).fetchone()
        prev_7_row = conn.execute(
            "SELECT AVG(daily) AS avg FROM (SELECT SUM(PreTaxCost) AS daily FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ? GROUP BY UsageDate) sub",
            (prev_7_start.isoformat(), prev_7_end.isoformat()),
        ).fetchone()

        last_7_avg = last_7_row["avg"] or 0
        prev_7_avg = prev_7_row["avg"] or 0
        if prev_7_avg:
            trend_pct = (last_7_avg - prev_7_avg) / prev_7_avg * 100

    if trend_pct is None or trend_pct <= 10:
        score += 20
        checks.append({"ok": True, "label_tr": "Maliyet trendi kontrol altında", "label_en": "Cost trend is under control", "details": []})
    else:
        checks.append({"ok": False, "label_tr": f"Maliyet trendi yükseliyor (%{trend_pct:.0f})", "label_en": f"Cost trend is rising (%{trend_pct:.0f})", "details": []})

    top_service_row = conn.execute(
        "SELECT ServiceName, SUM(PreTaxCost) AS t FROM CloudCosts GROUP BY ServiceName ORDER BY t DESC LIMIT 1"
    ).fetchone()
    top_service_pct = (top_service_row["t"] / total_cost * 100) if total_cost and top_service_row else 0

    max_score += 20
    if top_service_pct <= 40:
        score += 20
        checks.append({"ok": True, "label_tr": "Maliyet dağılımı dengeli", "label_en": "Cost distribution is balanced", "details": []})
    else:
        checks.append({"ok": False, "label_tr": f"{top_service_row['servicename']} maliyetin %{top_service_pct:.0f}'ini oluşturuyor", "label_en": f"{top_service_row['servicename']} accounts for %{top_service_pct:.0f} of total cost", "details": []})

    conn.close()

    final_score = round((score / max_score) * 100) if max_score else 0

    return {
        "score": final_score,
        "checks": [
            {"ok": c["ok"], "label": c["label_tr"] if language != "en" else c["label_en"], "details": c.get("details", [])}
            for c in checks
        ],
    }