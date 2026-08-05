"""
report.py
DoD Bolum 6: PDF rapor -- tek sayfali, yogun, modern dashboard tarzi
tasarim. Donut grafik, aylik karsilastirma paneli ve otomatik
icgoruler dashboard.py'de hesaplanan GERCEK verilerden besleniyor.

NOT: Referans mockup'ta sag ustte Microsoft Azure logosu var -- bu
tescilli bir marka oldugu icin BIREBIR KOPYALANMADI. Onun yerine kendi
marka renklerimizde soyut bir "bulut + grafik" illustrasyonu cizildi.

DIL DESTEGI: generate_pdf_report(language="tr"|"en") -- tum sabit
etiketler LABELS sozlugunden geliyor, dashboard.py'nin kendisi de
(kategori isimleri, otomatik icgoru cumleleri) ayni language parametresini
alip kendi ceviri mantigini uyguluyor.
"""
import io
from datetime import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Circle, String, Rect, Line

from .dashboard import get_dashboard_summary
from .database import get_connection

# -- Unicode/Turkce destekli font kaydi --
import os
_MPL_FONT_DIR = os.path.join(matplotlib.get_data_path(), "fonts", "ttf")
pdfmetrics.registerFont(TTFont("DejaVuSans", os.path.join(_MPL_FONT_DIR, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", os.path.join(_MPL_FONT_DIR, "DejaVuSans-Bold.ttf")))
FONT = "DejaVuSans"
FONT_BOLD = "DejaVuSans-Bold"

ACCENT = colors.HexColor("#2563eb")
ACCENT_LIGHT = colors.HexColor("#93c5fd")
NAVY = colors.HexColor("#0f172a")
GREEN = colors.HexColor("#16a34a")
GREEN_LIGHT = colors.HexColor("#f0fdf4")
GREEN_BORDER = colors.HexColor("#bbf7d0")
AMBER = colors.HexColor("#d97706")
GRAY_LIGHT = colors.HexColor("#f1f5f9")
MUTED = colors.HexColor("#64748b")
TEXT = colors.HexColor("#1e293b")
BORDER = colors.HexColor("#e2e8f0")
RED = colors.HexColor("#dc2626")
PURPLE = colors.HexColor("#8b5cf6")
TEAL = colors.HexColor("#0d9488")

DONUT_COLORS = [ACCENT, colors.HexColor("#60a5fa"), TEAL, PURPLE, colors.HexColor("#cbd5e1")]

MPL_BLUE = "#2563eb"
MPL_GRID = "#e2e8f0"
MPL_TEXT = "#475569"

PAGE_W, PAGE_H = A4
MARGIN = 1.4 * cm

# ============================== DIL SOZLUGU ==============================
LABELS = {
    "tr": {
        "main_title": "Bulut Maliyet Analiz Raporu",
        "exec_summary": "Yönetici Özeti",
        "report_period": "RAPOR DÖNEMİ",
        "report_date": "RAPOR TARİHİ",
        "footer_sub": "Report",
        "page_label": "Sayfa",
        "cost_axis": "Maliyet (USD)",
        "top_services_title": "En Yüksek Maliyetli Hizmetler",
        "top_services_sub": "Toplam maliyete göre sıralanmıştır",
        "trend_title": "Maliyet Trendi",
        "trend_sub": "Toplam maliyet (USD)",
        "distribution_title": "Maliyet Dağılımı",
        "monthly_change_title": "Aylık Değişim",
        "monthly_change_title": "Aylık Değişim",
        "weekly_change_title": "Haftalık Değişim",
        "last_week_label": "Geçen Hafta",
        "this_week_label": "Bu Hafta",
        "daily_change_title": "Günlük Değişim",
        "yesterday_label": "Dün",
        "today_label": "Bugün",
        "insights_title": "Öne Çıkan İçgörüler",
        "total_cost_card": "Toplam Maliyet",
        "vs_last_month": "vs geçen ay",
        "potential_savings_card": "Potansiyel Tasarruf",
        "potential_from_recs": "Potansiyel (Önerilerden)",
        "pending_recs_card": "Beklemedeki Öneriler",
        "action_pending": "Aksiyon bekliyor",
        "resources_card": "İzlenen Kaynaklar",
        "total_resources": "Toplam kaynak",
        "last_month_label": "Geçen Ay",
        "this_month_label": "Bu Ay",
        "change_label": "Değişim",
        "no_comparison_data": "Karşılaştırma için yeterli veri yok.",
        "savings_line": "Tüm öneriler uygulandığında potansiyel toplam tasarruf:",
        "recommendations_title": "Öneriler",
        "recommendations_sub": "AI analizleri sonucunda tespit edilen tasarruf fırsatları",
        "no_recs_yet": "Henüz üretilmiş bir öneri bulunmuyor. AI Asistan'a maliyet azaltma sorusu sorulduğunda öneriler burada listelenecektir.",
        "col_resource": "KAYNAK", "col_service": "HİZMET", "col_recommendation": "ÖNERİ",
        "col_est_savings": "TAHMİNİ\nTASARRUF (USD)", "col_status": "DURUM",
        "all_recs_applied_1": "Tüm Öneriler Uygulandığında",
        "all_recs_applied_2": "Potansiyel Toplam Tasarruf",
        "notes_title": "Notlar",
        "note1": "Tahmini tasarruflar, mevcut kullanım verileri ve Azure fiyatlandırmasına göre hesaplanmıştır.",
        "note2": "Gerçekleşecek tasarruflar, uygulama sonrası kullanıma bağlı olarak değişiklik gösterebilir.",
        "note3": "Detaylı analiz için kaynak bazlı raporlar bölümünü inceleyebilirsiniz.",
        "disclaimer": "Bu rapor, karar destek aracı olarak sunulmaktadır. CostBot herhangi bir kaynağa otomatik değişiklik yapmaz.<br/>Tüm öneriler, AI tarafından tahmini olarak üretilmiştir; gerçekleşen tasarruflar farklılık gösterebilir.",
        "status_map": {"Beklemede": "Beklemede", "Uygulandı": "Uygulandı", "Reddedildi": "Reddedildi"},
        "period_fallback": "bu dönem", "increase": "artış", "decrease": "azalış",
    },
    "en": {
        "main_title": "Cloud Cost Analysis Report",
        "exec_summary": "Executive Summary",
        "report_period": "REPORT PERIOD",
        "report_date": "REPORT DATE",
        "footer_sub": "Report",
        "page_label": "Page",
        "cost_axis": "Cost (USD)",
        "top_services_title": "Highest-Cost Services",
        "top_services_sub": "Ranked by total cost",
        "trend_title": "Cost Trend",
        "trend_sub": "Total cost (USD)",
        "distribution_title": "Cost Distribution",
        "monthly_change_title": "Monthly Change",
        "monthly_change_title": "Monthly Change",
        "weekly_change_title": "Weekly Change",
        "last_week_label": "Last Week",
        "this_week_label": "This Week",
        "daily_change_title": "Daily Change",
        "yesterday_label": "Yesterday",
        "today_label": "Today",
        "insights_title": "Key Insights",
        "total_cost_card": "Total Cost",
        "vs_last_month": "vs last month",
        "potential_savings_card": "Potential Savings",
        "potential_from_recs": "Potential (from recommendations)",
        "pending_recs_card": "Pending Recommendations",
        "action_pending": "Awaiting action",
        "resources_card": "Tracked Resources",
        "total_resources": "Total resources",
        "last_month_label": "Last Month",
        "this_month_label": "This Month",
        "change_label": "Change",
        "no_comparison_data": "Not enough data for comparison.",
        "savings_line": "Total potential savings if all recommendations are applied:",
        "recommendations_title": "Recommendations",
        "recommendations_sub": "Savings opportunities identified by AI analysis",
        "no_recs_yet": "No recommendations have been generated yet. Ask the AI Assistant a cost-reduction question to generate some.",
        "col_resource": "RESOURCE", "col_service": "SERVICE", "col_recommendation": "RECOMMENDATION",
        "col_est_savings": "ESTIMATED\nSAVINGS (USD)", "col_status": "STATUS",
        "all_recs_applied_1": "If All Recommendations Applied",
        "all_recs_applied_2": "Total Potential Savings",
        "notes_title": "Notes",
        "note1": "Estimated savings are calculated based on current usage data and Azure pricing.",
        "note2": "Actual savings may vary depending on post-implementation usage.",
        "note3": "See the resource-level reports section for a detailed analysis.",
        "disclaimer": "This report is provided as a decision-support tool. CostBot does not make automatic changes to any resource.<br/>All recommendations are AI-generated estimates; actual savings may differ.",
        "status_map": {"Beklemede": "Pending", "Uygulandı": "Applied", "Reddedildi": "Rejected"},
        "period_fallback": "this period", "increase": "increase", "decrease": "decrease",
    },
}


def _upper(s, language):
    """Turkce modda noktali/noktasiz I duzeltmesi uygular (Python'un
    yerlesik .upper()'i bunu bilmiyor); Ingilizce modda duz .upper()."""
    if language == "tr":
        return s.replace("i", "İ").replace("ı", "I").upper()
    return s.upper()


def _fmt_money(n):
    return f"${n:,.2f}"


# ============================== GRAFIKLER ==============================

def _style_axes(ax):
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(MPL_GRID)
    ax.tick_params(colors=MPL_TEXT, labelsize=7.5)


def _make_bar_chart(service_breakdown, L):
    items = list(reversed(service_breakdown))
    names = [s["name"] for s in items]
    values = [s["total"] for s in items]
    fig, ax = plt.subplots(figsize=(6.2, 3.6), dpi=170)
    fig.patch.set_facecolor("white")
    bars = ax.barh(names, values, color=MPL_BLUE, height=0.55, zorder=3)
    ax.grid(axis="x", color=MPL_GRID, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    _style_axes(ax)
    ax.set_xlabel(L["cost_axis"], fontsize=7.5, color=MPL_TEXT)
    for b, v in zip(bars, values):
        ax.text(v, b.get_y() + b.get_height() / 2, f"  ${v:,.2f}", va="center", ha="left",
                 fontsize=7, color="#0f172a", fontweight="bold")
    ax.set_xlim(0, max(values) * 1.32 if values else 1)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=170)
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_trend_chart(trend):
    months = [t["month"] for t in trend]
    totals = [t["total"] for t in trend]
    fig, ax = plt.subplots(figsize=(6.2, 3.6), dpi=170)
    fig.patch.set_facecolor("white")
    ax.plot(months, totals, marker="o", color=MPL_BLUE, linewidth=2.2, markersize=4.5,
            markerfacecolor="white", markeredgecolor=MPL_BLUE, markeredgewidth=1.8, zorder=3)
    ax.fill_between(months, totals, color=MPL_BLUE, alpha=0.08, zorder=2)
    ax.grid(axis="y", color=MPL_GRID, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    _style_axes(ax)
    for x, y in zip(months, totals):
        ax.annotate(f"{y:,.0f}", (x, y), textcoords="offset points", xytext=(0, 7),
                    ha="center", fontsize=6.6, color=MPL_TEXT, fontweight="bold")
    plt.xticks(fontsize=7)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=170)
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_donut_chart(service_breakdown, total_cost, L):
    labels = [s["name"] for s in service_breakdown]
    values = [s["total"] for s in service_breakdown]
    colors_mpl = [DONUT_COLORS[i % len(DONUT_COLORS)].hexval() if hasattr(DONUT_COLORS[i % len(DONUT_COLORS)], "hexval")
                  else "#2563eb" for i in range(len(labels))]
    colors_mpl = ["#" + c[-6:] for c in colors_mpl]

    fig, ax = plt.subplots(figsize=(3.6, 3.6), dpi=170)
    fig.patch.set_facecolor("white")
    ax.pie(values, colors=colors_mpl, startangle=90, counterclock=False,
           wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2))
    total_label = "Toplam" if L is LABELS["tr"] else "Total"
    ax.text(0, 0.12, total_label, ha="center", va="center", fontsize=9, color=MPL_TEXT)
    ax.text(0, -0.08, f"${total_cost:,.0f}", ha="center", va="center", fontsize=13, color="#0f172a", fontweight="bold")
    ax.set_aspect("equal")
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=170, bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf


# ============================== IKON/GORSEL YARDIMCILARI ==============================

def _icon_badge(label, bg_color, fg_color=colors.white, size=1.05 * cm, font_size=9):
    d = Drawing(size, size)
    d.add(Circle(size / 2, size / 2, size / 2, fillColor=bg_color, strokeColor=None))
    d.add(String(size / 2, size / 2 - font_size * 0.35, label, fontSize=font_size,
                 fillColor=fg_color, fontName=FONT_BOLD, textAnchor="middle"))
    return d


def _small_icon(label, color_, size=0.5 * cm, font_size=7):
    d = Drawing(size, size)
    d.add(String(0, 0, label, fontSize=font_size, fillColor=color_, fontName=FONT_BOLD))
    return d


def _cloud_illustration(w=3.6 * cm, h=2.6 * cm):
    """Azure logosu YERINE kendi soyut bulut+grafik illustrasyonumuz (marka ihlali olmasin diye)."""
    d = Drawing(w, h)
    d.add(Circle(w * 0.75, h * 0.65, h * 0.42, fillColor=colors.HexColor("#dbeafe"), strokeColor=None))
    d.add(Circle(w * 0.30, h * 0.35, h * 0.30, fillColor=colors.HexColor("#eff6ff"), strokeColor=None))
    cloud_color = colors.HexColor("#bfdbfe")
    d.add(Circle(w * 0.42, h * 0.55, h * 0.22, fillColor=cloud_color, strokeColor=None))
    d.add(Circle(w * 0.58, h * 0.60, h * 0.26, fillColor=cloud_color, strokeColor=None))
    d.add(Circle(w * 0.72, h * 0.52, h * 0.18, fillColor=cloud_color, strokeColor=None))
    d.add(Rect(w * 0.36, h * 0.30, w * 0.42, h * 0.24, fillColor=cloud_color, strokeColor=None))
    bar_color = ACCENT
    bar_w = w * 0.06
    bars = [(w * 0.40, h * 0.10), (w * 0.50, h * 0.16), (w * 0.60, h * 0.22), (w * 0.70, h * 0.28)]
    for bx, bh in bars:
        d.add(Rect(bx, h * 0.06, bar_w, bh, fillColor=bar_color, strokeColor=None))
    return d


# ============================== SAYFA CERCEVESI ==============================

def _draw_page_frame(c, doc, data, L):
    c.saveState()

    top_y = PAGE_H - MARGIN

    logo_path = Path(__file__).parent.parent.parent / "frontend" / "public" / "logo-sabancidx.png"
    if logo_path.exists():
        c.drawImage(str(logo_path), MARGIN - 0.5 * cm, top_y - 0.65 * cm, width=3.4 * cm, height=1.35 * cm,
                    preserveAspectRatio=True, mask='auto')
        c.setFillColor(NAVY)
        c.setFont(FONT_BOLD, 11)
        c.drawString(MARGIN, top_y - 1.0 * cm, "CostBot")
    else:
        c.setFillColor(ACCENT)
        c.roundRect(MARGIN, top_y - 0.05 * cm, 0.85 * cm, 0.85 * cm, 4, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 11)
        c.drawCentredString(MARGIN + 0.425 * cm, top_y + 0.2 * cm, "C")
        c.setFillColor(NAVY)
        c.setFont(FONT_BOLD, 15)
        c.drawString(MARGIN + 1.15 * cm, top_y + 0.18 * cm, "CostBot")

    period = data.get("current_month") or datetime.now().strftime("%Y-%m")
    tarih = datetime.now().strftime("%d.%m.%Y")
    right_text = f"{L['report_period']}: {period}     |     {L['report_date']}: {tarih}"
    c.setFont(FONT_BOLD, 8.5)
    c.setFillColor(colors.HexColor("#334155"))
    c.drawRightString(PAGE_W - MARGIN, top_y + 0.2 * cm, right_text)
    cal_w = c.stringWidth(right_text, FONT_BOLD, 8.5)
    date_x = PAGE_W - MARGIN - c.stringWidth(f"{L['report_date']}: " + tarih, FONT_BOLD, 8.5)
    period_x = PAGE_W - MARGIN - cal_w
    for x in (period_x, date_x):
        c.setFillColor(ACCENT)
        c.roundRect(x - 0.55 * cm, top_y + 0.12 * cm, 0.4 * cm, 0.4 * cm, 2, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 6)
        c.drawCentredString(x - 0.35 * cm, top_y + 0.24 * cm, "31")

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.75)
    c.line(MARGIN, top_y - 0.55 * cm, PAGE_W - MARGIN, top_y - 0.55 * cm)

    bottom_y = MARGIN * 0.9
    c.setLineWidth(0.75)
    c.line(MARGIN, bottom_y + 0.5 * cm, PAGE_W - MARGIN, bottom_y + 0.5 * cm)
    c.setFont(FONT_BOLD, 8.5)
    c.setFillColor(ACCENT)
    c.drawString(MARGIN, bottom_y, "CostBot")
    costbot_width = c.stringWidth("CostBot", FONT_BOLD, 8.5)
    c.setFont(FONT, 8.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + costbot_width + 0.35 * cm, bottom_y, L["footer_sub"])
    c.drawRightString(PAGE_W - MARGIN, bottom_y, f"{L['page_label']} {doc.page}")

    c.restoreState()


# ============================== YAPI PARCALARI ==============================

def _panel_title(icon_char, icon_color, text, styles, language, text_w=7.0 * cm):
    icon = _small_icon(icon_char, icon_color, font_size=10)
    row = Table([[icon, Paragraph(_upper(text, language), styles["PanelTitle"])]], colWidths=[0.5 * cm, text_w])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return row


def _metric_card(icon_label, icon_bg, label, value, sub, sub_color, language):
    icon = _icon_badge(icon_label, icon_bg, size=0.95 * cm, font_size=8.5)
    icon_cell = Table([[icon]], colWidths=[0.95 * cm], rowHeights=[0.95 * cm])
    icon_cell.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    CARD_TEXT_W = 3.7 * cm
    stack = Table([
        [icon_cell],
        [Paragraph(_upper(label, language), ParagraphStyle(name="ml", fontSize=7, textColor=MUTED, fontName=FONT_BOLD, leading=8.6))],
        [Paragraph(value, ParagraphStyle(name="mv", fontSize=14.5, textColor=NAVY, fontName=FONT_BOLD, leading=17, spaceBefore=3))],
        [Paragraph(sub, ParagraphStyle(name="ms", fontSize=7, textColor=sub_color, fontName=FONT_BOLD, leading=8.6, spaceBefore=2))],
    ], colWidths=[CARD_TEXT_W])
    stack.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    wrapper = Table([[stack]], colWidths=[CARD_TEXT_W + 0.7 * cm])
    wrapper.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return wrapper


def _clock_icon(color, size=0.28 * cm):
    d = Drawing(size, size)
    d.add(Circle(size / 2, size / 2, size / 2 - 0.5, fillColor=None, strokeColor=color, strokeWidth=1))
    d.add(Line(size / 2, size / 2, size / 2, size * 0.72, strokeColor=color, strokeWidth=1))
    d.add(Line(size / 2, size / 2, size * 0.68, size / 2, strokeColor=color, strokeWidth=1))
    return d


def _savings_illustration(w=2.3 * cm, h=1.6 * cm):
    d = Drawing(w, h)
    bar_color = colors.HexColor("#86efac")
    for bx, bh in [(0.08 * w, 0.28 * h), (0.32 * w, 0.48 * h), (0.56 * w, 0.72 * h)]:
        d.add(Rect(bx, 0, w * 0.16, bh, fillColor=bar_color, strokeColor=None))
    d.add(Line(0.12 * w, 0.35 * h, 0.72 * w, 0.85 * h, strokeColor=GREEN, strokeWidth=1.4))
    d.add(Circle(w * 0.8, h * 0.78, h * 0.20, fillColor=GREEN, strokeColor=None))
    d.add(String(w * 0.8, h * 0.78 - 2.8, "$", fontSize=7.5, fillColor=colors.white, fontName=FONT_BOLD, textAnchor="middle"))
    return d


def _notes_illustration(w=2.6 * cm, h=1.9 * cm):
    d = Drawing(w, h)
    doc_color = colors.HexColor("#e0e7ff")
    line_color = colors.HexColor("#a5b4fc")
    d.add(Rect(0.06 * w, 0.10 * h, 0.5 * w, 0.75 * h, fillColor=doc_color, strokeColor=None))
    for ly in (0.62, 0.50, 0.38, 0.26):
        d.add(Line(0.14 * w, ly * h, 0.48 * w, ly * h, strokeColor=line_color, strokeWidth=1.1))
    d.add(Circle(0.74 * w, 0.32 * h, 0.24 * h, fillColor=colors.HexColor("#c7d2fe"), strokeColor=None))
    d.add(Circle(0.74 * w, 0.32 * h, 0.11 * h, fillColor=colors.white, strokeColor=None))
    return d


def _status_pill(status, L):
    pal = {
        "Beklemede": (colors.HexColor("#fef3c7"), colors.HexColor("#92400e")),
        "Uygulandı": (GREEN_LIGHT, colors.HexColor("#166534")),
        "Reddedildi": (GRAY_LIGHT, MUTED),
    }
    bg, fg = pal.get(status, (GRAY_LIGHT, MUTED))
    display_text = L["status_map"].get(status, status)
    if status == "Beklemede":
        text_p = Paragraph(display_text, ParagraphStyle(name="pill", fontSize=6.3, textColor=fg, fontName=FONT_BOLD))
        inner = Table([[_clock_icon(fg, size=0.22 * cm), text_p]], colWidths=[0.3 * cm, 1.75 * cm])
        inner.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        content, w = inner, 2.15 * cm
    else:
        content = Paragraph(display_text, ParagraphStyle(name="pill", fontSize=6.3, textColor=fg, fontName=FONT_BOLD))
        w = 1.8 * cm
    t = Table([[content]], colWidths=[w])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    return t


def _get_recommendations(user_id=None, limit=8):
    conn = get_connection()
    columns_sql = (
        'RecommendationId AS "RecommendationId", CreatedDate AS "CreatedDate", '
        'TargetService AS "TargetService", TargetResourceName AS "TargetResourceName", '
        'RecommendationText AS "RecommendationText", PotentialSavings AS "PotentialSavings", '
        'Currency AS "Currency", Status AS "Status", ActionDate AS "ActionDate"'
    )
    rows = conn.execute(
        f"SELECT {columns_sql} FROM CostRecommendations WHERE UserId = ? ORDER BY PotentialSavings DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================== ANA URETIM ==============================

# NOT: get_period_summary()'nin parametre adı "granularity" iken
# Dashboard'daki zaman aralığı özelliği eklenirken "timeframe" olarak
# değiştirildi (dashboard.py). Reports sayfasındaki granularity
# değerleri ("day"/"week"/"month" gibi), yeni "daily"/"30d"/"3m" vb.
# timeframe sözlüğüyle BİREBİR uyuşmuyor -- bu yüzden burada bir
# eşleme (mapping) yapıyoruz.
_GRANULARITY_TO_TIMEFRAME = {
    "day": "daily",
    "week": "7d",    # yeni bir "son 7 gün" timeframe'i eklememiz gerekir
    "month": "30d",
}


def generate_pdf_report(language: str = "tr", user_id: int = None, granularity: str = None) -> bytes:
    L = LABELS.get(language, LABELS["tr"])
    show_period_comparison = True
    if granularity:
        from .dashboard import get_period_summary
        timeframe = _GRANULARITY_TO_TIMEFRAME.get(granularity, "30d")
        data = get_period_summary(timeframe=timeframe, language=language, user_id=user_id)
        if granularity == "day":
            # "Maliyet Trendi" grafiği, günlük raporda TEK NOKTAYLA
            # (tek gün) anlamsız kalacağı için ayrıca son 7 günün
            # trendini çekip data["trend"]'i onunla değiştiriyoruz.
            weekly_data = get_period_summary(timeframe="7d", language=language, user_id=user_id)
            data["trend"] = weekly_data["trend"]
    else:
        data = get_dashboard_summary(language=language, user_id=user_id)
    recs = _get_recommendations(user_id=user_id)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="MainTitle", fontSize=22, textColor=NAVY, fontName=FONT_BOLD, spaceAfter=14))
    styles.add(ParagraphStyle(name="SectionLabel", fontSize=10.5, textColor=ACCENT, fontName=FONT_BOLD, spaceAfter=7))
    styles.add(ParagraphStyle(name="PanelTitle", fontSize=10, textColor=NAVY, fontName=FONT_BOLD))
    styles.add(ParagraphStyle(name="PanelSub", fontSize=7.3, textColor=MUTED, fontName=FONT, spaceAfter=6, spaceBefore=2))
    styles.add(ParagraphStyle(name="Body", fontSize=9.2, leading=14, textColor=TEXT, fontName=FONT))
    styles.add(ParagraphStyle(name="Small", fontSize=7.6, textColor=MUTED, fontName=FONT_BOLD))
    styles.add(ParagraphStyle(name="TableCell", fontSize=8, textColor=TEXT, fontName=FONT, leading=10.5))
    styles.add(ParagraphStyle(name="TableCellBold", fontSize=8.3, textColor=NAVY, fontName=FONT_BOLD, leading=10.5))
    styles.add(ParagraphStyle(name="Disclaimer", fontSize=7.6, textColor=MUTED, fontName=FONT, alignment=1, leading=11.5))
    styles.add(ParagraphStyle(name="LegendItem", fontSize=7.6, textColor=TEXT, fontName=FONT))
    styles.add(ParagraphStyle(name="InsightText", fontSize=8, textColor=TEXT, fontName=FONT, leading=11.5))
    styles.add(ParagraphStyle(name="CompareLabel", fontSize=8, textColor=MUTED, fontName=FONT))
    styles.add(ParagraphStyle(name="CompareValue", fontSize=10, textColor=NAVY, fontName=FONT_BOLD, alignment=2))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=MARGIN + 0.95 * cm, bottomMargin=MARGIN + 0.8 * cm,
        leftMargin=MARGIN, rightMargin=MARGIN,
    )

    def _on_page(c, d):
        _draw_page_frame(c, d, data, L)

    story = []

    # ---- Baslik + sag ust illustrasyon ----
    title_row = Table([[
        Paragraph(L["main_title"], styles["MainTitle"]),
        _cloud_illustration(),
    ]], colWidths=[14.2 * cm, 4.0 * cm])
    title_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(title_row)

    # ---- Yonetici Ozeti (rozet) ----
    ozet_badge = Table([[Paragraph(_upper(L["exec_summary"], language), styles["SectionLabel"])]], colWidths=[4.2 * cm])
    ozet_badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(ozet_badge)
    story.append(Spacer(1, 6))

    period = data.get("current_month") or L["period_fallback"]
    if language == "en":
        change_line = ""
        if data["cost_change_pct"] is not None:
            direction = L["increase"] if data["cost_change_pct"] >= 0 else L["decrease"]
            change_line = f"a %{abs(data['cost_change_pct']):.1f} {direction} compared to the previous month."
        summary_text = (
            f"This report summarizes your Azure cloud spending for {period}. "
            f"Your total cost was <b>{_fmt_money(data['total_cost'])}</b>, reflecting {change_line} "
            f"Analysis identified <b>{_fmt_money(data['potential_savings'])}</b> in potential savings "
            f"opportunities, with <b>{data['pending_recommendations']}</b> recommendations pending review."
        )
    else:
        change_line = ""
        if data["cost_change_pct"] is not None:
            direction = "artış" if data["cost_change_pct"] >= 0 else "azalış"
            change_line = f"bir önceki aya göre %{abs(data['cost_change_pct']):.1f} {direction} göstermiştir."
        summary_text = (
            f"Bu rapor, {period} dönemindeki Azure bulut harcamalarınızı özetlemektedir. "
            f"Toplam maliyetiniz <b>{_fmt_money(data['total_cost'])}</b> olarak gerçekleşmiş olup, {change_line} "
            f"Yapılan analizler sonucunda <b>{_fmt_money(data['potential_savings'])}</b> tutarında potansiyel tasarruf "
            f"fırsatı belirlenmiş ve <b>{data['pending_recommendations']}</b> öneri beklemede bulunmaktadır."
        )
    story.append(Paragraph(summary_text, styles["Body"]))
    story.append(Spacer(1, 10))

    # ---- Metrik kartlari ----
    change_str = f"↑ %{abs(data['cost_change_pct']):.1f} {L['vs_last_month']}" if data["cost_change_pct"] is not None else "-"
    change_color = RED if (data["cost_change_pct"] or 0) >= 0 else GREEN
    cards = [
        _metric_card("$", ACCENT, L["total_cost_card"], _fmt_money(data["total_cost"]), change_str, change_color, language),
        _metric_card("$", GREEN, L["potential_savings_card"], _fmt_money(data["potential_savings"]), L["potential_from_recs"], GREEN, language),
        _metric_card("!", AMBER, L["pending_recs_card"], str(data["pending_recommendations"]), L["action_pending"], AMBER, language),
        _metric_card("#", ACCENT, L["resources_card"], str(data["resource_count"]), L["total_resources"], MUTED, language),
    ]
    card_row = Table([cards], colWidths=[4.55 * cm] * 4)
    card_row.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(card_row)
    story.append(Spacer(1, 10))

    # ---- Bar + Trend paneli (yan yana) ----
    left_panel = [_panel_title("▤", ACCENT, L["top_services_title"], styles, language, text_w=7.6 * cm),
                  Paragraph(L["top_services_sub"], styles["PanelSub"])]
    if data["service_breakdown"]:
        left_panel.append(Image(_make_bar_chart(data["service_breakdown"], L), width=8.15 * cm, height=4.25 * cm))

    right_panel = [_panel_title("↗", GREEN, L["trend_title"], styles, language, text_w=7.6 * cm),
                   Paragraph(L["trend_sub"], styles["PanelSub"])]
    if len(data["trend"]) >= 2:
        right_panel.append(Image(_make_trend_chart(data["trend"]), width=8.15 * cm, height=4.25 * cm))

    panels = Table([[left_panel, right_panel]], colWidths=[9.1 * cm, 9.1 * cm])
    panels.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (0, 0), 1, BORDER), ("BOX", (1, 0), (1, 0), 1, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11),
    ]))
    story.append(panels)
    story.append(Spacer(1, 8))

    # ---- Donut + Aylik Degisim + Icgoruler (3 sutun) ----
    donut_cell = [_panel_title("◔", PURPLE, L["distribution_title"], styles, language, text_w=5.5 * cm), Spacer(1, 4)]
    if data["service_breakdown"]:
        donut_img = Image(_make_donut_chart(data["service_breakdown"], data["total_cost"], L), width=2.5 * cm, height=2.5 * cm)
        legend_rows = []
        for i, s in enumerate(data["service_breakdown"]):
            dot_color = DONUT_COLORS[i % len(DONUT_COLORS)]
            dot = Drawing(0.3 * cm, 0.3 * cm)
            dot.add(Circle(0.15 * cm, 0.15 * cm, 0.15 * cm, fillColor=dot_color, strokeColor=None))
            legend_rows.append([dot, Paragraph(s["name"], styles["LegendItem"]),
                                 Paragraph(f"%{s['pct']:.0f}", ParagraphStyle(name="pct", fontSize=7.6, fontName=FONT_BOLD, textColor=NAVY, alignment=2))])
        legend_table = Table(legend_rows, colWidths=[0.35 * cm, 2.15 * cm, 1.0 * cm])
        legend_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        donut_row = Table([[donut_img, legend_table]], colWidths=[2.5 * cm, 3.5 * cm])
        donut_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
        donut_cell.append(donut_row)

    # Panel başlığı ve etiketleri, seçilen granülariteye göre değişir --
    # "Haftalık" raporda "Aylık Değişim / Geçen Ay / Bu Ay" gibi yanlış/
    # sabit etiketler göstermek yerine, gerçek dönemi (hafta) yansıtan
    # etiketler kullanılır.
    if granularity == "day":
        change_panel_title = L["daily_change_title"]
        prev_period_label = L["yesterday_label"]
        curr_period_label = L["today_label"]
    elif granularity == "week":
        change_panel_title = L["weekly_change_title"]
        prev_period_label = L["last_week_label"]
        curr_period_label = L["this_week_label"]
    else:
        change_panel_title = L["monthly_change_title"]
        prev_period_label = L["last_month_label"]
        curr_period_label = L["this_month_label"]

    compare_cell = [_panel_title("▦", TEAL, change_panel_title, styles, language, text_w=3.7 * cm), Spacer(1, 8)]
    if show_period_comparison and data["previous_total"] is not None:
        compare_rows = [
            [Paragraph(f"{prev_period_label} ({data['previous_month']})", styles["CompareLabel"]),
             Paragraph(_fmt_money(data["previous_total"]), styles["CompareValue"])],
            [Paragraph(f"{curr_period_label} ({data['current_month']})", styles["CompareLabel"]),
             Paragraph(f"<b>{_fmt_money(data['total_cost'])}</b>", styles["CompareValue"])],
            [Paragraph(L["change_label"], styles["CompareLabel"]),
             Paragraph(f"<font color='#dc2626'>+{_fmt_money(data['delta_amount'])} (%{data['cost_change_pct']:.1f})</font>"
                        if (data["delta_amount"] or 0) >= 0 else
                        f"<font color='#16a34a'>{_fmt_money(data['delta_amount'])} (%{data['cost_change_pct']:.1f})</font>",
                        styles["CompareValue"])],
        ]
        compare_table = Table(compare_rows, colWidths=[1.9 * cm, 2.4 * cm])
        compare_table.setStyle(TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LINEBELOW", (0, 0), (-1, 1), 0.5, BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        compare_cell.append(compare_table)
    elif not show_period_comparison:
        compare_cell = []  # günlük raporda bu panel tamamen boş bırakılır
    else:
        compare_cell.append(Paragraph(L["no_comparison_data"], styles["Body"]))

    insights_cell = [_panel_title("◈", AMBER, L["insights_title"], styles, language, text_w=4.7 * cm), Spacer(1, 6)]
    for insight in data["insights"]:
        row = Table([[Paragraph("✓", ParagraphStyle(name="chk", fontSize=8, textColor=GREEN, fontName=FONT_BOLD)),
                      Paragraph(insight, styles["InsightText"])]], colWidths=[0.3 * cm, 4.7 * cm])
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        insights_cell.append(row)

    triple = Table([[donut_cell, compare_cell, insights_cell]], colWidths=[6.9 * cm, 5.2 * cm, 6.1 * cm])
    triple.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (0, 0), 1, BORDER), ("BOX", (1, 0), (1, 0), 1, BORDER), ("BOX", (2, 0), (2, 0), 1, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11),
    ]))
    story.append(triple)
    story.append(Spacer(1, 8))

    # ---- Yesil tasarruf ozeti cubugu ----
    icon = _icon_badge("$", GREEN, size=0.65 * cm, font_size=6.5)
    label_para = Paragraph(L["savings_line"], ParagraphStyle(name="savlabel", fontSize=7.5, textColor=NAVY, fontName=FONT_BOLD))
    value_para = Paragraph(f"<font size='13' color='#16a34a'><b>{_fmt_money(data['potential_savings'])}</b></font>",
                            ParagraphStyle(name="savvalue", alignment=2, fontName=FONT_BOLD))
    savings_illustration = _savings_illustration(w=1.6 * cm, h=1.1 * cm)
    savings_box = Table([[icon, label_para, value_para, savings_illustration]],
                         colWidths=[0.85 * cm, 8.5 * cm, 5.0 * cm, 1.8 * cm])
    savings_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, GREEN_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(savings_box)

    story.append(PageBreak())

    # ---- Sayfa 2: Oneriler baslik (ikon rozetli) ----
    title_icon = _icon_badge("▤", ACCENT, size=1.1 * cm, font_size=11)
    title_stack = Table([
        [Paragraph(_upper(L["recommendations_title"], language), ParagraphStyle(name="page2title", fontSize=15, textColor=NAVY, fontName=FONT_BOLD))],
        [Paragraph(L["recommendations_sub"], styles["PanelSub"])],
    ], colWidths=[13 * cm])
    title_stack.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 5),
    ]))
    title_row2 = Table([[title_icon, title_stack]], colWidths=[1.4 * cm, 16.8 * cm])
    title_row2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(title_row2)
    story.append(Spacer(1, 14))

    if not recs:
        story.append(Paragraph(L["no_recs_yet"], styles["Body"]))
    else:
        header = [L["col_resource"], L["col_service"], L["col_recommendation"], L["col_est_savings"], L["col_status"]]
        rec_rows = [[Paragraph(h.replace("\n", "<br/>"), styles["Small"]) for h in header]]
        for r in recs:
            name = r["TargetResourceName"] or "-"
            monogram = (name[:2] or "??").upper()
            name_cell = Table([[_icon_badge(monogram, ACCENT, size=0.75 * cm, font_size=7),
                                 Paragraph(name, styles["TableCellBold"])]], colWidths=[0.95 * cm, 2.55 * cm])
            name_cell.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            rec_rows.append([
                name_cell,
                Paragraph(r["TargetService"] or "-", styles["TableCell"]),
                Paragraph((r["RecommendationText"] or "")[:160], styles["TableCell"]),
                Paragraph(f"<b><font color='#16a34a'>{_fmt_money(r['PotentialSavings'] or 0)}</font></b>", styles["TableCellBold"]),
                _status_pill(r["Status"] or "Beklemede", L),
            ])
        rec_table = Table(rec_rows, colWidths=[3.5 * cm, 2.6 * cm, 6.2 * cm, 3.0 * cm, 2.9 * cm], repeatRows=1)
        rec_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f9")),
            ("LINEBELOW", (0, 0), (-1, 0), 1, BORDER),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDER),
            ("BOX", (0, 0), (-1, -1), 1, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(rec_table)

    story.append(Spacer(1, 16))

    # ---- Yesil tasarruf ozeti (ikinci kez, sayfa 2'de de gorunur olsun) ----
    if recs:
        total_potential = sum(r["PotentialSavings"] or 0 for r in recs)
        icon2 = _icon_badge("$", GREEN, size=0.65 * cm, font_size=6.5)
        label2 = Table([
            [Paragraph(_upper(L["all_recs_applied_1"], language), ParagraphStyle(name="sav2a", fontSize=7, textColor=NAVY, fontName=FONT_BOLD))],
            [Paragraph(_upper(L["all_recs_applied_2"], language), ParagraphStyle(name="sav2b", fontSize=7, textColor=NAVY, fontName=FONT_BOLD))],
        ], colWidths=[8.5 * cm])
        label2.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
        value2 = Paragraph(f"<font size='13' color='#16a34a'><b>{_fmt_money(total_potential)}</b></font>",
                            ParagraphStyle(name="sav2v", alignment=2, fontName=FONT_BOLD))
        savings_box2 = Table([[icon2, label2, value2, _savings_illustration(w=1.6 * cm, h=1.1 * cm)]],
                              colWidths=[0.85 * cm, 8.5 * cm, 5.0 * cm, 1.8 * cm])
        savings_box2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), GREEN_LIGHT),
            ("BOX", (0, 0), (-1, -1), 1, GREEN_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(savings_box2)
        story.append(Spacer(1, 14))

    # ---- Notlar kutusu ----
    notes_icon = _icon_badge("i", colors.HexColor("#dbeafe"), fg_color=ACCENT, size=0.65 * cm, font_size=8.5)
    notes_title_row = Table([[notes_icon, Paragraph(_upper(L["notes_title"], language), styles["SectionLabel"])]], colWidths=[0.9 * cm, 4 * cm])
    notes_title_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    notes_left = [notes_title_row, Spacer(1, 8)]
    for note in [L["note1"], L["note2"], L["note3"]]:
        notes_left.append(Paragraph(f"•&nbsp;&nbsp;{note}", styles["Body"]))
        notes_left.append(Spacer(1, 4))

    notes_box = Table([[notes_left, _notes_illustration()]], colWidths=[14.2 * cm, 3.4 * cm])
    notes_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f5f6ff")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e0e3fa")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 14), ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 16), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(notes_box)
    story.append(Spacer(1, 16))

    # ---- Alt uyari (kalkan ikonlu, ortalanmis) ----
    shield = _icon_badge("✓", colors.HexColor("#e0f2fe"), fg_color=ACCENT, size=0.55 * cm, font_size=7)
    disc_text = Paragraph(L["disclaimer"], styles["Disclaimer"])
    disc_row = Table([[shield, disc_text]], colWidths=[0.8 * cm, 17.4 * cm])
    disc_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(disc_row)

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    buf.seek(0)
    return buf.read()
