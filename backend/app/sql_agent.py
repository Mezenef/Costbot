"""
sql_agent.py
CostBot'un çekirdeği: doğal dil → SQL → doğrulama → çalıştırma zinciri.

DoD Bölüm 2 (Error/Edge Cases) burada birebir kod olarak karşılanıyor:
  - Bilinmeyen kolon/servis  -> UNKNOWN_COLUMN yanıtı, mevcut kolonları öner
  - Boş sonuç                -> "bu kriterlere uyan veri bulunamadı"
  - Hatalı/geçersiz SQL       -> yakala, 1 kez LLM'e hata mesajıyla geri gönder (retry)
  - Yalnızca SELECT           -> validate_sql ile zorunlu kılınır

Bu modül, LangChain'in hazır `create_sql_agent` yardımcısını KASITLI
OLARAK kullanmaz; onun yerine SQLDatabase + doğrulama katmanı üstüne
kendi zincirimizi kuruyoruz. Gerekçe: DoD'nin istediği Türkçe, ürüne
özel hata mesajları (ör. "bu veri mevcut değil") generic agent
davranışıyla değil, açık kontrol akışıyla güvenilir şekilde üretilebilir.

PostgreSQL'e geçiş notu: 'except sqlite3.Error' blokları 'except
Exception' yapıldı -- artık psycopg2 kullanıldığı için sqlite3.Error
hiçbir zaman eşleşmiyordu, bu da SQL hata-düzeltme (retry) mekanizmasını
sessizce devre dışı bırakıyordu.
"""
import re
import time
import json
from dataclasses import dataclass, field
from typing import Optional

from .database import get_connection
from .schema import get_schema_prompt, ALLOWED_TABLES
from .prompts import build_prompt, RECOMMENDATION_PROMPT, FINOPS_RESPONSE_PROMPT, SIMPLE_RESPONSE_PROMPT, LANGUAGE_NAMES, RECOMMENDATION_LABELS
from .llm_client import get_llm, LLMNotConfiguredError

FORBIDDEN_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|PRAGMA|REPLACE|TRUNCATE)\b",
    re.IGNORECASE,
)


@dataclass
class AgentResult:
    status: str  # "ok" | "empty" | "unknown_column" | "no_data" | "sql_error" | "llm_error"
    answer: str
    sql: Optional[str] = None
    data: list = field(default_factory=list)
    execution_time: float = 0.0
    raw_llm_output: Optional[str] = None


def _dataset_date_range() -> Optional[tuple[str, str]]:
    """Veri setinin gerçek MIN/MAX UsageDate değerlerini döndürür — hata
    mesajlarında kullanıcıya 'mevcut veri şu aralığı kapsıyor' demek için."""
    try:
        conn = get_connection()
        row = conn.execute("SELECT MIN(UsageDate) AS dmin, MAX(UsageDate) AS dmax FROM CloudCosts").fetchone()
        conn.close()
        if row and row["dmin"] and row["dmax"]:
            return (row["dmin"], row["dmax"])
    except Exception:
        pass
    return None


def _try_compute_grand_total(sql: str) -> Optional[float]:
    """
    Eğer sorgu bir 'GROUP BY ... LIMIT' (top-N) deseniyse, AYNI
    filtrelerle hesaplanmış GERÇEK genel toplamı ayrıca hesaplar.
    """
    if not re.search(r"SUM\s*\(\s*PreTaxCost\s*\)", sql, re.IGNORECASE):
        return None
    if not re.search(r"\bGROUP\s+BY\b", sql, re.IGNORECASE):
        return None
    if not re.search(r"\bLIMIT\b", sql, re.IGNORECASE):
        return None

    match = re.search(r"\bFROM\s+(.*?)\s+GROUP\s+BY\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    from_where_clause = match.group(1).strip()
    if re.search(r"\b(SELECT|;)\b", from_where_clause, re.IGNORECASE):
        return None

    grand_total_sql = f"SELECT SUM(PreTaxCost) AS GenelToplam FROM {from_where_clause}"
    if validate_sql(grand_total_sql) is not None:
        return None

    try:
        conn = get_connection()
        row = conn.execute(grand_total_sql).fetchone()
        conn.close()
        if row and row["genelToplam" if False else "genel_toplam" if False else list(row.keys())[0]] is not None:
            return float(row[list(row.keys())[0]])
    except Exception:
        pass
    return None


def validate_sql(sql: str) -> Optional[str]:
    """
    SQL'i çalıştırmadan önce doğrular. Sorun varsa hata mesajı, yoksa None döner.
    """
    stripped = sql.strip().rstrip(";")
    if not stripped:
        return "Boş SQL üretildi."
    if not re.match(r"^\s*(SELECT|WITH)\b", stripped, re.IGNORECASE):
        return "Yalnızca SELECT (veya WITH ... SELECT) sorgularına izin veriliyor."
    if FORBIDDEN_KEYWORDS.search(stripped):
        return "Sorgu izin verilmeyen bir anahtar kelime içeriyor (yalnızca okuma yapılabilir)."
    if ";" in stripped:
        return "Birden fazla ifade (çoklu ; ) içeren sorgulara izin verilmiyor."

    cte_names = set(re.findall(r"(?:\bWITH\s+|,\s*)([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(", stripped, re.IGNORECASE))

    used_tables = re.findall(r"\bFROM\s+([A-Za-z_]+)|\bJOIN\s+([A-Za-z_]+)", stripped, re.IGNORECASE)
    flat = {t for pair in used_tables for t in pair if t}
    unknown = flat - set(ALLOWED_TABLES.keys()) - cte_names
    if unknown:
        return f"Bilinmeyen tablo(lar): {', '.join(unknown)}"

    return None


def _closest_matches(name: str, candidates: list[str], n: int = 3) -> list[str]:
    import difflib
    return difflib.get_close_matches(name, candidates, n=n, cutoff=0.3)


def _all_known_columns() -> list[str]:
    """Yakın-eşleşme önerileri için SADECE CloudCosts (kullanıcıya ait
    iş verisi) kolonlarını döndürür."""
    return sorted(set(ALLOWED_TABLES.get("CloudCosts", [])))


def _is_effectively_empty(data: list[dict]) -> bool:
    """
    SQL'de SUM()/AVG() gibi agregasyon fonksiyonları, eşleşen satır
    olmasa bile her zaman 1 satır döndürür.
    """
    if not data:
        return True
    if len(data) == 1 and all(v is None for v in data[0].values()):
        return True
    return False


_BACKEND_DIRECT_PATTERNS = [
    (re.compile(r"^(toplam\s+maliyetim?\s+nedir\??|toplam\s+maliyet\s+nedir\??|what\s+is\s+(my\s+)?total\s+cost\??)$", re.IGNORECASE), "total_cost"),
    (re.compile(r"^(en\s+pahal[ıi]\s+servis\s+(hangisi|ne)\??|en\s+y[uü]ksek\s+maliyetli\s+servis\s+(hangisi|nedir)\??|what\s+is\s+the\s+(most\s+expensive|highest[- ]cost)\s+service\??)$", re.IGNORECASE), "top_service"),
    (re.compile(r"^(ka[cç]\s+kaynağım\s+var\??|kaynak\s+say[ıi]s[ıi]\s+ka[cç]\??|how\s+many\s+resources\s+(do\s+i\s+have)?\??)$", re.IGNORECASE), "resource_count"),
]


def _normalize_question(q: str) -> str:
    q = q.strip().lower()
    q = re.sub(r"\s+", " ", q)
    return q


def _try_backend_direct(question: str, language: str, user_id: Optional[int]) -> Optional[AgentResult]:
    """Bazı ÇOK KESİN/basit sorular için LLM'e hiç gitmeden, doğrudan
    önceden hesaplanmış (dashboard.py) verilerden yanıt üretir --
    NeoBank'in 'Backend-Direct Yanıt' mimarisinden esinlenildi. SADECE
    tam olarak eşleşen, belirsizlik içermeyen kalıplar yakalanır; en
    ufak bir ek kelime (tarih, filtre, servis adı) varsa bu fonksiyon
    devreye GİRMEZ, soru normal LLM akışına düşer."""
    normalized = _normalize_question(question)
    intent = None
    for pattern, name in _BACKEND_DIRECT_PATTERNS:
        if pattern.match(normalized):
            intent = name
            break
    if not intent:
        return None

    from .dashboard import get_dashboard_summary
    try:
        summary = get_dashboard_summary(language=language, user_id=user_id)
    except Exception:
        return None

    period = summary.get("current_month") or "?"

    if intent == "total_cost":
        total = summary["total_cost"]
        if language == "en":
            answer = f"Your total cost for {period} is ${total:,.2f}."
        else:
            answer = f"{period} dönemi için toplam maliyetiniz ${total:,.2f}."
        return AgentResult(status="ok", answer=answer, sql=None, data=[{"Period": period, "TotalCost": total}], execution_time=0.01)

    if intent == "top_service":
        breakdown = summary.get("service_breakdown") or []
        if not breakdown:
            return None
        top = breakdown[0]
        if language == "en":
            answer = f"The highest-cost service is {top['name']}, at ${top['total']:,.2f}."
        else:
            answer = f"En yüksek maliyetli servis {top['name']}, ${top['total']:,.2f}."
        return AgentResult(status="ok", answer=answer, sql=None, data=breakdown[:5], execution_time=0.01)

    if intent == "resource_count":
        count = summary["resource_count"]
        if language == "en":
            answer = f"You have {count} tracked resources."
        else:
            answer = f"Toplam {count} izlenen kaynağınız var."
        return AgentResult(status="ok", answer=answer, sql=None, data=[], execution_time=0.01)

    return None


def _build_context_rows(data: list[dict], limit: int = 15) -> list[dict]:
    """LLM'e bağlam olarak verilecek satırları seçer.

    Kullanıcı testinde bulunan hata: "hangi servisler artmadı" gibi
    FİLTRELENMİŞ liste sorularında, toplam satır sayısı limit'i aşınca
    (ör. 17 > 15) LLM'e SADECE ilk 15 satır gidiyordu -- geri kalanlar
    LLM'in görüş alanına hiç girmiyor, metin özetinde YANLIŞLIKLA eksik
    kalıyordu. Toplam satır sayısı MAKUL bir sınırın (30) altındaysa,
    limit'i tüm veriyi kapsayacak şekilde genişletiyoruz.

    PostgreSQL'e geçiş notu: PostgreSQL tırnaksız kolon adlarını küçük
    harfe çevirir, bu yüzden 'Type' değil 'type' aranır (kullanıcı
    testinde bulunan gerçek hata -- kategori+servis karışık sorularda
    servis satırları LLM'e hiç ulaşmıyordu)."""
    if not data:
        return []

    effective_limit = max(limit, len(data)) if len(data) <= 30 else limit

    if "type" not in data[0]:
        return data[:effective_limit]

    types = []
    for row in data:
        if row.get("type") not in types:
            types.append(row.get("type"))

    per_type = max(1, effective_limit // len(types))
    result = []
    for t in types:
        result.extend([r for r in data if r.get("type") == t][:per_type])
    return result[:effective_limit]


def ask(question: str, session_id: str = "default", max_retries: int = 1, language: str = "tr", user_id: Optional[int] = None, previous_answer: Optional[str] = None) -> AgentResult:
    """Ana giriş noktası: doğal dil soruyu alır, AgentResult döner ve ChatHistory'ye yazar."""
    t0 = time.time()

    direct_result = _try_backend_direct(question, language, user_id)
    if direct_result is not None:
        direct_result.execution_time = time.time() - t0
        _log_chat_history(session_id, question, direct_result.sql, direct_result, user_id=user_id)
        return direct_result

    try:
        llm = get_llm()
    except LLMNotConfiguredError as e:
        return AgentResult(status="llm_error", answer=str(e))

    schema_text = get_schema_prompt()
    messages = build_prompt(schema_text, question, language=language, previous_answer=previous_answer)

    sql = None
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = llm.invoke(messages)
            raw = response.content.strip()
        except Exception as e:
            return AgentResult(status="llm_error", answer=f"LLM çağrısı başarısız: {e}")

        if raw.startswith("UNKNOWN_COLUMN"):
            hint = raw.split(":", 1)[-1].strip() if ":" in raw else ""
            suggestions = _closest_matches(hint, _all_known_columns()) if hint else []
            if language == "en":
                sug_txt = f" Did you mean: {suggestions[0]}?" if suggestions else ""
                answer = f"This data isn't available.{sug_txt}"
            else:
                sug_txt = f" Kastettiğiniz {suggestions[0]} mi?" if suggestions else ""
                answer = f"Bu veri mevcut değil.{sug_txt}"
            return AgentResult(
                status="unknown_column",
                answer=answer,
                raw_llm_output=raw,
                execution_time=time.time() - t0,
            )

        if raw.startswith("NO_DATA"):
            reason = raw.split(":", 1)[-1].strip() if ":" in raw else ("No data matches this request." if language == "en" else "Veri seti bu isteği karşılamıyor.")
            date_range = _dataset_date_range()
            if language == "en":
                range_note = f" Available data range: {date_range[0]} — {date_range[1]}." if date_range else ""
                answer = f"No data matches these criteria. ({reason}){range_note}"
            else:
                range_note = f" Mevcut veri kapsamı: {date_range[0]} — {date_range[1]}." if date_range else ""
                answer = f"Bu kriterlere uyan veri bulunamadı. ({reason}){range_note}"
            return AgentResult(
                status="no_data",
                answer=answer,
                raw_llm_output=raw,
                execution_time=time.time() - t0,
            )

        sql = raw.strip("` \n")
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()

        problem = validate_sql(sql)
        if problem:
            last_error = problem
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"Sorgu geçersiz: {problem}. Lütfen düzelt."})
            continue

        if _is_recommendation_question(question, previous_answer):
            has_sum = re.search(r"\bSUM\s*\(", sql, re.IGNORECASE)
            has_group_by = re.search(r"\bGROUP\s+BY\b", sql, re.IGNORECASE)
            if not (has_sum and has_group_by):
                last_error = "Öneri sorularında ham/satır bazlı veri değil, kaynak/servis bazında TOPLANMIŞ veri gerekiyor."
                messages.append({"role": "assistant", "content": raw})
                messages.append({"role": "user", "content": (
                    "Bu bir MALİYET AZALTMA/ÖNERİ sorusu. Ham/satır bazlı detay SORGULAMA VE "
                    "SADECE MeterName ile gruplama YAPMA -- GROUP BY MUTLAKA ResourceName "
                    "içermeli (istersen ServiceName'i de ekleyebilirsin), SUM(PreTaxCost) ile "
                    "TOPLANMIŞ bir sorgu üret. Aksi hâlde önerideki 'kaynak adı' alanına bir "
                    "ölçüm biriminin adı (ör. 'Standard Fixed Cost') yazılır, gerçek kaynak adı "
                    "kaybolur."
                )})
                continue

        conn = get_connection()
        try:
            rows = conn.execute(sql).fetchall()
            data = [dict(r) for r in rows]
            conn.close()
        except Exception as e:
            conn.close()
            last_error = str(e)
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"SQL çalıştırma hatası: {e}. Lütfen SQL'i düzelt."})
            continue

        elapsed = time.time() - t0
        if _is_effectively_empty(data):
            if _is_recommendation_question(question, previous_answer):
                answer = (
                    "Elimdeki maliyet verisine göre başka yüksek etkili bir optimizasyon fırsatı "
                    "tespit edemedim. Daha ayrıntılı öneriler için kullanım metrikleri (CPU, disk, "
                    "ağ trafiği vb.) gerekebilir."
                ) if language != "en" else (
                    "Based on the current cost data, I couldn't identify another high-impact "
                    "optimization opportunity. More detailed recommendations would require usage "
                    "metrics (CPU, disk, network, etc.)."
                )
            else:
                answer = "No data matches these criteria." if language == "en" else "Bu kriterlere uyan veri bulunamadı."
            result = AgentResult(
                status="empty",
                answer=answer,
                sql=sql, data=[], execution_time=elapsed, raw_llm_output=raw,
            )
        elif _is_recommendation_question(question, previous_answer) and len(data) > 0 and len(data[0]) >= 3:
            try:
                recs = generate_recommendation(data[:10], language=language, user_id=user_id)
                answer_text = _format_recommendations(recs, len(data), language=language)
            except Exception as e:
                fail_note = f"\n(Recommendation generation failed: {e})" if language == "en" else f"\n(Öneri üretimi başarısız oldu: {e})"
                answer_text = _summarize(data, language=language) + fail_note
            result = AgentResult(
                status="ok",
                answer=answer_text,
                sql=sql, data=data, execution_time=elapsed, raw_llm_output=raw,
            )
        else:
            grand_total = _try_compute_grand_total(sql)
            try:
                answer_text = _llm_format_response(question, sql, data, grand_total, language=language)
            except Exception:
                answer_text = _summarize(data, grand_total, language=language)
            result = AgentResult(
                status="ok",
                answer=answer_text,
                sql=sql, data=data, execution_time=elapsed, raw_llm_output=raw,
            )
        _log_chat_history(session_id, question, sql, result, user_id=user_id)
        return result

    return AgentResult(
        status="sql_error",
        answer=f"Sorgu {max_retries + 1} denemeden sonra çalıştırılamadı: {last_error}",
        execution_time=time.time() - t0,
    )


_SHORT_AFFIRMATIVE_PATTERN = re.compile(r"^(tamam|evet|olur|tabii|peki|ok|okay|sure|yes|yeah)\.?$", re.IGNORECASE)


def _is_recommendation_question(question: str, previous_answer: Optional[str] = None) -> bool:
    """
    Kolon adlarına güvenmek yerine (LLM her seferinde farklı isim/sıra
    üretebiliyor), doğrudan kullanıcının SORUSUNA bakıyoruz.
    """
    keywords = ["azalt", "tasarruf", "öneri", "optimizasyon", "iyileştir",
                "verimli", "gereksiz", "gereğinden fazla", "atıl", "israf",
                "reduce", "save", "saving", "recommend", "optimi",
                "efficient", "unnecessary", "excessive", "idle", "waste"]
    q_lower = question.lower()
    if any(kw in q_lower for kw in keywords):
        return True
    if previous_answer and _SHORT_AFFIRMATIVE_PATTERN.match(question.strip()):
        if "Sonraki Adım" in previous_answer or "Next Step" in previous_answer:
            return True
    return False


_ANALYTICAL_KEYWORDS = [
    "neden", "niye", "sebep", "artan", "azalan", "artış", "azalış",
    "karşılaştır", "trend", "değişim", "arttı", "azaldı", "kıyasla",
    "why", "reason", "increase", "decrease", "compare", "comparison", "change",
]


def _is_analytical_question(question: str) -> bool:
    """Basit sorularda gereksiz zengin şablonu tetiklememesi için."""
    q_lower = question.lower()
    return any(kw in q_lower for kw in _ANALYTICAL_KEYWORDS)


def _format_recommendations(recs: list[dict], candidate_count: int, language: str = "tr") -> str:
    """
    LLM'in ürettiği öneri listesini FinOps şablonunda metne çevirir.
    """
    if language == "en":
        if not recs:
            return f"📊 Summary\n{candidate_count} candidate resources were reviewed but no clear savings opportunity was found."
        total_savings = sum(r.get("PotentialSavings", 0) or 0 for r in recs)
        lines = [
            "📊 Summary",
            f"{candidate_count} candidate resources were reviewed, {len(recs)} concrete recommendations were generated. "
            f"Total estimated savings: {total_savings:,.2f} USD.",
            "", "💡 Recommended Actions",
        ]
        for i, r in enumerate(recs, 1):
            lines.append(
                f"{i}. {r.get('TargetResourceName', '?')} ({r.get('TargetService', '?')}): "
                f"{r.get('RecommendationText', '')} (~{r.get('PotentialSavings', 0):,.2f} USD estimated savings)"
            )
        lines += ["", "➡️ Next Step",
                   "These recommendations were automatically saved to the \"Recommendations\" page with "
                   "\"Pending\" status — you can review and mark them Apply/Reject there. "
                   "Would you like recommendations for another resource as well?"]
        return "\n".join(lines)

    if not recs:
        return (
            f"📊 Özet\n{candidate_count} aday kaynak incelendi ancak belirgin bir "
            f"tasarruf fırsatı bulunamadı."
        )
    total_savings = sum(r.get("PotentialSavings", 0) or 0 for r in recs)
    lines = [
        "📊 Özet",
        f"{candidate_count} aday kaynak incelendi, {len(recs)} somut öneri üretildi. "
        f"Toplam tahmini tasarruf: {total_savings:,.2f} USD.",
        "",
        "💡 Önerilen Aksiyonlar",
    ]
    for i, r in enumerate(recs, 1):
        lines.append(
            f"{i}. {r.get('TargetResourceName', '?')} ({r.get('TargetService', '?')}): "
            f"{r.get('RecommendationText', '')} "
            f"(~{r.get('PotentialSavings', 0):,.2f} USD tahmini tasarruf)"
        )
    lines.append("")
    lines.append("➡️ Sonraki Adım")
    lines.append(
        "Bu öneriler otomatik olarak \"Öneriler\" sayfasına \"Beklemede\" durumuyla "
        "kaydedildi — oradan inceleyip Uygula/Reddet olarak işaretleyebilirsiniz. "
        "Başka bir kaynak için de öneri görmek ister misiniz?"
    )
    return "\n".join(lines)


def _summarize(data: list[dict], grand_total: Optional[float] = None, language: str = "tr") -> str:
    """
    Şablon tabanlı özet — ikinci LLM çağrısı başarısız olursa devreye giren FALLBACK.
    """
    n = len(data)
    keys = list(data[0].keys())
    en = language == "en"

    def fmt(v):
        if isinstance(v, (int, float)):
            return f"{v:,.2f}"
        return str(v)

    if n == 1:
        row = data[0]
        if len(keys) == 1:
            return f"{keys[0]}: {fmt(row[keys[0]])}"
        parts = [f"{k}: {fmt(v)}" for k, v in row.items()]
        return " · ".join(parts)

    is_timeseries = any(
        kw in keys[0].lower() for kw in ("ay", "tarih", "date", "month")
    )
    numeric_key = next((k for k in keys if isinstance(data[0].get(k), (int, float))), None)

    if is_timeseries and numeric_key and n >= 2:
        first, last = data[0][numeric_key], data[-1][numeric_key]
        if first and first != 0:
            change_pct = (last - first) / first * 100
            if en:
                direction = "increased" if change_pct > 0 else ("decreased" if change_pct < 0 else "stayed the same")
                return (
                    f"{numeric_key} was {fmt(first)} in {data[0][keys[0]]} and became {fmt(last)} "
                    f"in {data[-1][keys[0]]} — a %{abs(change_pct):.1f} {direction}."
                )
            direction = "arttı" if change_pct > 0 else ("azaldı" if change_pct < 0 else "değişmedi")
            return (
                f"{data[0][keys[0]]} döneminde {fmt(first)} olan {numeric_key}, "
                f"{data[-1][keys[0]]} döneminde {fmt(last)} oldu — "
                f"%{abs(change_pct):.1f} {direction}."
            )
        if en:
            return f"{n} periods of data found; change rate could not be calculated because the first period's value is zero."
        return f"{n} dönemlik veri bulundu, ilk dönemde değer sıfır olduğu için değişim oranı hesaplanamadı."

    if len(keys) <= 2 and numeric_key:
        subset_total = sum(r[numeric_key] for r in data if isinstance(r.get(numeric_key), (int, float)))
        top = data[0]
        examples = "; ".join(f"{r[keys[0]]} ({fmt(r[numeric_key])})" for r in data[:3])
        if en:
            more = f" and {n - 3} more" if n > 3 else ""
            if grand_total:
                share_of_grand = (subset_total / grand_total * 100) if grand_total else 0
                top_share = (top[numeric_key] / grand_total * 100) if grand_total else 0
                return (
                    f"{n} results found. Sum of shown {n} records: {fmt(subset_total)} "
                    f"(%{share_of_grand:.0f} of grand total) — grand total: {fmt(grand_total)}. "
                    f"Highest: {top[keys[0]]} ({fmt(top[numeric_key])}, %{top_share:.0f} of grand total). "
                    f"Details: {examples}{more}."
                )
            share = (top[numeric_key] / subset_total * 100) if subset_total else 0
            return (
                f"{n} results found — sum of shown {n} records: {fmt(subset_total)} "
                f"(this may NOT be the dataset's grand total, only the sum of these {n} records). "
                f"Highest: {top[keys[0]]} (%{share:.0f} among shown). Details: {examples}{more}."
            )
        more = f" ve {n - 3} sonuç daha" if n > 3 else ""
        if grand_total:
            share_of_grand = (subset_total / grand_total * 100) if grand_total else 0
            top_share = (top[numeric_key] / grand_total * 100) if grand_total else 0
            return (
                f"{n} sonuç bulundu. Gösterilen {n} kaydın toplamı: {fmt(subset_total)} "
                f"(genel toplamın %{share_of_grand:.0f}'i) — genel toplam: {fmt(grand_total)}. "
                f"En yüksek: {top[keys[0]]} ({fmt(top[numeric_key])}, genel toplamın %{top_share:.0f}'i). "
                f"Detay: {examples}{more}."
            )
        share = (top[numeric_key] / subset_total * 100) if subset_total else 0
        return (
            f"{n} sonuç bulundu — gösterilen {n} kaydın toplamı: {fmt(subset_total)} "
            f"(bu, veri setinin GENEL toplamı olmayabilir, sadece bu {n} kaydın toplamıdır). "
            f"En yüksek: {top[keys[0]]} (gösterilenler arasında %{share:.0f}). "
            f"Detay: {examples}{more}."
        )

    cost_key = next((k for k in keys if "cost" in k.lower() or "maliyet" in k.lower()), None)
    if cost_key:
        total_cost = sum(r[cost_key] for r in data if isinstance(r.get(cost_key), (int, float)))
        if en:
            return f"{n} records found, total affected cost {fmt(total_cost)}. See the table below for details."
        return f"{n} kayıt bulundu, toplam etkilenen maliyet {fmt(total_cost)}. Detaylar aşağıdaki tabloda."

    if en:
        return f"{n} records found ({', '.join(keys)}). See the table below for details."
    return f"{n} kayıt bulundu ({', '.join(keys)}). Detaylar aşağıdaki tabloda."


def _llm_format_response(question: str, sql: str, data: list[dict], grand_total: Optional[float] = None, language: str = "tr") -> str:
    """
    DoD sonrası kullanıcı test raporunda istenen 'FinOps danışmanı' yanıt formatı.
    """
    llm = get_llm()
    shown_rows = min(5, len(data))
    context_rows = _build_context_rows(data, limit=15)
    date_range = _dataset_date_range()

    def _fmt_date_tr(iso_date: str) -> str:
        try:
            y, m, d = iso_date.split("-")
            return f"{d}-{m}-{y}"
        except Exception:
            return iso_date

    date_range_text = f"{_fmt_date_tr(date_range[0])} — {_fmt_date_tr(date_range[1])}" if date_range else "bilinmiyor"
    grand_total_text = (
        f"{grand_total:,.2f} (bu, sorgudaki LIMIT'ten BAĞIMSIZ, aynı filtrelerle hesaplanmış GERÇEK genel toplamdır)"
        if grand_total is not None else "hesaplanamadı (bu sorgu için genel toplam bağlamı yok — pay/yüzde YAZMA)"
    )
    template = FINOPS_RESPONSE_PROMPT if _is_analytical_question(question) else SIMPLE_RESPONSE_PROMPT
    prompt = template.format(
        question=question,
        sql=sql,
        total_rows=len(data),
        shown_rows=shown_rows,
        data_json=json.dumps(context_rows, ensure_ascii=False, default=str),
        language_name=LANGUAGE_NAMES.get(language, "Türkçe"),
        date_range=date_range_text,
        grand_total=grand_total_text,
    )
    response = llm.invoke([{"role": "user", "content": prompt}])
    text = response.content.strip()
    if not text:
        raise ValueError("LLM boş yanıt döndürdü")
    return text


def _log_chat_history(session_id: str, question: str, sql: str, result: AgentResult, user_id: Optional[int] = None) -> None:
    conn = get_connection()
    conn.execute(
        "INSERT INTO ChatHistory (UserId, SessionId, UserPrompt, GeneratedSQL, QueryResultJSON, "
        "BotResponseText, ExecutionTime) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            user_id, session_id, question, sql,
            json.dumps(result.data, ensure_ascii=False)[:5000],
            result.answer, result.execution_time,
        ),
    )
    conn.commit()
    conn.close()


def generate_recommendation(rows: list[dict], language: str = "tr", user_id: Optional[int] = None) -> list[dict]:
    """Atıl kaynak satırlarını LLM'e yorumlatıp CostRecommendations'a yazılacak
    öneri listesini üretir."""
    llm = get_llm()
    labels = RECOMMENDATION_LABELS.get(language, RECOMMENDATION_LABELS["tr"])
    prompt = RECOMMENDATION_PROMPT.format(
        rows=json.dumps(rows, ensure_ascii=False),
        language_name=LANGUAGE_NAMES.get(language, "Türkçe"),
        control_label=labels["control"],
        rec_label=labels["rec"],
        risk_label=labels["risk"],
    )
    response = llm.invoke([{"role": "user", "content": prompt}])
    raw = response.content.strip()

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    recs = json.loads(raw)

    conn = get_connection()
    for r in recs:
        conn.execute(
            "INSERT INTO CostRecommendations "
            "(UserId, TargetService, TargetResourceName, RecommendationText, PotentialSavings, Currency, Status) "
            "VALUES (?, ?, ?, ?, ?, 'USD', 'Beklemede')",
            (user_id, r.get("TargetService"), r.get("TargetResourceName"),
             r.get("RecommendationText"), r.get("PotentialSavings", 0)),
        )
    conn.commit()
    conn.close()
    return recs


def _llm_format_response_stream(question: str, sql: str, data: list[dict], grand_total: Optional[float] = None, language: str = "tr"):
    """_llm_format_response ile AYNI prompt'u kurar, ama cevabı PARÇA
    PARÇA (streaming) üretir."""
    llm = get_llm()
    shown_rows = min(5, len(data))
    context_rows = _build_context_rows(data, limit=15)
    date_range = _dataset_date_range()

    def _fmt_date_tr(iso_date: str) -> str:
        try:
            y, m, d = iso_date.split("-")
            return f"{d}-{m}-{y}"
        except Exception:
            return iso_date

    date_range_text = f"{_fmt_date_tr(date_range[0])} — {_fmt_date_tr(date_range[1])}" if date_range else "bilinmiyor"
    grand_total_text = (
        f"{grand_total:,.2f} (bu, sorgudaki LIMIT'ten BAĞIMSIZ, aynı filtrelerle hesaplanmış GERÇEK genel toplamdır)"
        if grand_total is not None else "hesaplanamadı (bu sorgu için genel toplam bağlamı yok — pay/yüzde YAZMA)"
    )
    template = FINOPS_RESPONSE_PROMPT if _is_analytical_question(question) else SIMPLE_RESPONSE_PROMPT
    prompt = template.format(
        question=question,
        sql=sql,
        total_rows=len(data),
        shown_rows=shown_rows,
        data_json=json.dumps(context_rows, ensure_ascii=False, default=str),
        language_name=LANGUAGE_NAMES.get(language, "Türkçe"),
        date_range=date_range_text,
        grand_total=grand_total_text,
    )
    got_content = False
    for chunk in llm.stream([{"role": "user", "content": prompt}]):
        piece = chunk.content
        if piece:
            got_content = True
            yield piece
    if not got_content:
        raise ValueError("LLM boş yanıt döndürdü (stream)")


def ask_stream(question: str, session_id: str = "default", max_retries: int = 1, language: str = "tr", user_id: Optional[int] = None, previous_answer: Optional[str] = None):
    """ask() ile AYNI SQL üretim/doğrulama/çalıştırma mantığını kullanır
    -- ama son adımda metni PARÇA PARÇA üretir. Frontend'in tükettiği olaylar:
      {"type": "chunk", "text": "..."}
      {"type": "done", "sql":..., "data":..., "status":..., "execution_time":...}
    """
    t0 = time.time()

    direct_result = _try_backend_direct(question, language, user_id)
    if direct_result is not None:
        direct_result.execution_time = time.time() - t0
        _log_chat_history(session_id, question, direct_result.sql, direct_result, user_id=user_id)
        yield {"type": "chunk", "text": direct_result.answer}
        yield {"type": "done", "sql": direct_result.sql, "data": direct_result.data, "status": "ok", "execution_time": direct_result.execution_time}
        return

    try:
        llm = get_llm()
    except LLMNotConfiguredError as e:
        yield {"type": "chunk", "text": str(e)}
        yield {"type": "done", "sql": None, "data": [], "status": "llm_error", "execution_time": time.time() - t0}
        return

    schema_text = get_schema_prompt()
    messages = build_prompt(schema_text, question, language=language, previous_answer=previous_answer)

    sql = None
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = llm.invoke(messages)
            raw = response.content.strip()
        except Exception as e:
            yield {"type": "chunk", "text": f"LLM çağrısı başarısız: {e}"}
            yield {"type": "done", "sql": None, "data": [], "status": "llm_error", "execution_time": time.time() - t0}
            return

        if raw.startswith("UNKNOWN_COLUMN"):
            hint = raw.split(":", 1)[-1].strip() if ":" in raw else ""
            suggestions = _closest_matches(hint, _all_known_columns()) if hint else []
            if language == "en":
                sug_txt = f" Did you mean: {suggestions[0]}?" if suggestions else ""
                answer = f"This data isn't available.{sug_txt}"
            else:
                sug_txt = f" Kastettiğiniz {suggestions[0]} mi?" if suggestions else ""
                answer = f"Bu veri mevcut değil.{sug_txt}"
            yield {"type": "chunk", "text": answer}
            result = AgentResult(status="unknown_column", answer=answer, raw_llm_output=raw, execution_time=time.time() - t0)
            _log_chat_history(session_id, question, None, result, user_id=user_id)
            yield {"type": "done", "sql": None, "data": [], "status": "unknown_column", "execution_time": time.time() - t0}
            return

        if raw.startswith("NO_DATA"):
            reason = raw.split(":", 1)[-1].strip() if ":" in raw else ("No data matches this request." if language == "en" else "Veri seti bu isteği karşılamıyor.")
            date_range = _dataset_date_range()
            if language == "en":
                range_note = f" Available data range: {date_range[0]} — {date_range[1]}." if date_range else ""
                answer = f"No data matches these criteria. ({reason}){range_note}"
            else:
                range_note = f" Mevcut veri kapsamı: {date_range[0]} — {date_range[1]}." if date_range else ""
                answer = f"Bu kriterlere uyan veri bulunamadı. ({reason}){range_note}"
            yield {"type": "chunk", "text": answer}
            result = AgentResult(status="no_data", answer=answer, raw_llm_output=raw, execution_time=time.time() - t0)
            _log_chat_history(session_id, question, None, result, user_id=user_id)
            yield {"type": "done", "sql": None, "data": [], "status": "no_data", "execution_time": time.time() - t0}
            return

        sql = raw.strip("` \n")
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()

        problem = validate_sql(sql)
        if problem:
            last_error = problem
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"Sorgu geçersiz: {problem}. Lütfen düzelt."})
            continue

        conn = get_connection()
        try:
            rows = conn.execute(sql).fetchall()
            data = [dict(r) for r in rows]
            conn.close()
        except Exception as e:
            conn.close()
            last_error = str(e)
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"SQL çalıştırma hatası: {e}. Lütfen SQL'i düzelt."})
            continue

        elapsed = time.time() - t0

        if _is_effectively_empty(data):
            if _is_recommendation_question(question, previous_answer):
                answer = (
                    "Elimdeki maliyet verisine göre başka yüksek etkili bir optimizasyon fırsatı "
                    "tespit edemedim. Daha ayrıntılı öneriler için kullanım metrikleri (CPU, disk, "
                    "ağ trafiği vb.) gerekebilir."
                ) if language != "en" else (
                    "Based on the current cost data, I couldn't identify another high-impact "
                    "optimization opportunity. More detailed recommendations would require usage "
                    "metrics (CPU, disk, network, etc.)."
                )
            else:
                answer = "No data matches these criteria." if language == "en" else "Bu kriterlere uyan veri bulunamadı."
            yield {"type": "chunk", "text": answer}
            result = AgentResult(status="empty", answer=answer, sql=sql, data=[], execution_time=elapsed, raw_llm_output=raw)
            _log_chat_history(session_id, question, sql, result, user_id=user_id)
            yield {"type": "done", "sql": sql, "data": [], "status": "empty", "execution_time": elapsed}
            return

        if _is_recommendation_question(question, previous_answer) and len(data) > 0 and len(data[0]) >= 3:
            try:
                recs = generate_recommendation(data[:10], language=language, user_id=user_id)
                answer_text = _format_recommendations(recs, len(data), language=language)
            except Exception as e:
                fail_note = f"\n(Recommendation generation failed: {e})" if language == "en" else f"\n(Öneri üretimi başarısız oldu: {e})"
                answer_text = _summarize(data, language=language) + fail_note
            yield {"type": "chunk", "text": answer_text}
            result = AgentResult(status="ok", answer=answer_text, sql=sql, data=data, execution_time=elapsed, raw_llm_output=raw)
            _log_chat_history(session_id, question, sql, result, user_id=user_id)
            yield {"type": "done", "sql": sql, "data": data, "status": "ok", "execution_time": elapsed}
            return

        grand_total = _try_compute_grand_total(sql)
        full_text = ""
        try:
            for chunk_text in _llm_format_response_stream(question, sql, data, grand_total, language=language):
                full_text += chunk_text
                yield {"type": "chunk", "text": chunk_text}
        except Exception:
            full_text = _summarize(data, grand_total, language=language)
            yield {"type": "chunk", "text": full_text}

        result = AgentResult(status="ok", answer=full_text, sql=sql, data=data, execution_time=elapsed, raw_llm_output=raw)
        _log_chat_history(session_id, question, sql, result, user_id=user_id)
        yield {"type": "done", "sql": sql, "data": data, "status": "ok", "execution_time": elapsed}
        return

    answer = f"Sorgu {max_retries + 1} denemeden sonra çalıştırılamadı: {last_error}"
    yield {"type": "chunk", "text": answer}
    yield {"type": "done", "sql": None, "data": [], "status": "sql_error", "execution_time": time.time() - t0}