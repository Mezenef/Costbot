"""
test_scenarios.py
DoD Bölüm 3 kabul kriteri: "Tanımlanan test senaryolarının en az %90'ında
doğru sonuç elde edilir."

İKİ ÇALIŞTIRMA MODU:

1) OFFLINE (LLM gerektirmez — şimdi, bu ortamda çalışır):
   `python -m tests.test_scenarios --offline`
   validate_sql() ve execute katmanını, DoD'de verilen referans SQL
   sorgularını doğrudan çalıştırarak test eder. Amaç: LLM olmasa da
   agent'ın "doğrulama + çalıştırma + loglama" iskeletinin sağlam
   olduğunu kanıtlamak.

2) LIVE (Bulutistan kimlik bilgileri gerekir):
   `python -m tests.test_scenarios --live`
   Gerçek doğal dil sorularını app.sql_agent.ask() üzerinden LLM'e
   gönderir, üretilen SQL'i ve sonucu DoD'deki beklenen davranışla
   karşılaştırır, %90 kabul kriterine göre rapor basar.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import build_database
from app.sql_agent import validate_sql, get_connection, ask
from app.prompts import FEWSHOT_EXAMPLES


# ── DoD Bölüm 2 tablosundaki 4 senaryo + Error/Edge Cases ──
# expect: "ok" (veri dönmeli), "no_data_ok" (bu veri setinde veri yok, bu DOĞRU davranış),
#         "unknown_column" (edge case), "empty" (edge case)
LIVE_TEST_CASES = [
    {
        "id": "S1-top5-servis",
        "question": "Bana harcaması en yüksek olan 5 servis grubunu bir çubuk grafik olarak listele.",
        "expect": "ok",
    },
    {
        "id": "S2-tarih-filtre",
        "question": "Mart 2026'da hangi kaynak ne kadar harcama yaptı?",
        # Gerçek (tek tarihli) veride veri yok -> no_data_ok DOĞRU davranış.
        # Sentetik (6 aylık) veride Mart 2026 gerçekten var -> ok bekleniyor.
        "expect": "no_data_ok",
        "expect_synthetic": "ok",
    },
    {
        "id": "S3-trend",
        "question": "Son 6 ayın toplam maliyet trendini göster.",
        "expect": "no_data_ok",
        "expect_synthetic": "ok",
    },
    {
        "id": "S4-oneri",
        "question": "Maliyetleri nasıl azaltabilirim?",
        "expect": "ok",
    },
    {
        "id": "E1-bilinmeyen-kolon",
        "question": "En yüksek 'DepartmentBudget' değerine sahip servis hangisi?",
        "expect": "unknown_column",
    },
    {
        "id": "E2-bos-sonuc",
        "question": "ServiceName'i 'Uzay Roketleri' olan kaynakların toplam maliyeti nedir?",
        "expect": "empty_or_unknown",
    },
]


SYNTHETIC_CSV = Path(__file__).parent.parent / "data" / "azure_cost_mock_data_WORKING.csv"
LARGE_CSV = Path(__file__).parent.parent / "data" / "azure_cost_mock_data_SENTETIK_BUYUK.csv"
REAL_CSV = Path(__file__).parent.parent / "data" / "azure_cost_mock_data.csv"


def _pick_csv(use_synthetic: bool, use_large: bool) -> Path:
    if use_large:
        return LARGE_CSV
    if use_synthetic:
        return SYNTHETIC_CSV
    return REAL_CSV


def run_offline(use_synthetic: bool = False, use_large: bool = False) -> bool:
    print("=" * 70)
    print("OFFLINE MOD — LLM'siz doğrulama + çalıştırma katmanı testi")
    if use_large:
        print("(BÜYÜK sentetik veri seti kullanılıyor — ~3.1M satır / ~1GB)")
    elif use_synthetic:
        print("(SENTETİK 6 aylık veri kullanılıyor — tarih/trend senaryoları dahil)")
    print("=" * 70)

    build_database(csv_path=_pick_csv(use_synthetic, use_large))
    conn = get_connection()
    passed, total = 0, 0

    # 1) DoD'nin FEWSHOT örneklerindeki referans SQL'lerin gerçekten çalıştığını doğrula
    for ex in FEWSHOT_EXAMPLES:
        total += 1
        problem = validate_sql(ex["sql"])
        try:
            rows = conn.execute(ex["sql"]).fetchall()
            ok = problem is None
        except Exception as e:
            ok = False
            rows = []
            problem = str(e)
        status = "✅" if ok else "❌"
        print(f"{status} [{ex['question'][:45]:45s}] satır={len(rows):>4}  {problem or ''}")
        if ok:
            passed += 1

    # 2) validate_sql güvenlik testleri (yasak komutlar reddedilmeli)
    security_cases = [
        ("DROP TABLE CloudCosts", False),
        ("DELETE FROM CloudCosts", False),
        ("SELECT * FROM CloudCosts; DROP TABLE CloudCosts", False),
        ("SELECT * FROM NonExistentTable", False),
        ("SELECT ServiceName, SUM(PreTaxCost) FROM CloudCosts GROUP BY ServiceName", True),
    ]
    print("\n-- Güvenlik / doğrulama testleri --")
    for sql, should_pass in security_cases:
        total += 1
        problem = validate_sql(sql)
        ok = (problem is None) == should_pass
        status = "✅" if ok else "❌"
        print(f"{status} validate_sql({sql[:55]!r}) -> {'izinli' if problem is None else problem}")
        if ok:
            passed += 1

    conn.close()
    print(f"\nOFFLINE SONUÇ: {passed}/{total} test geçti ({passed/total:.0%})")
    return passed == total


def run_live(use_synthetic: bool = False, use_large: bool = False) -> bool:
    print("=" * 70)
    print("LIVE MOD — Bulutistan LLM ile uçtan uca test")
    if use_large:
        print("(BÜYÜK sentetik veri seti kullanılıyor — ~3.1M satır / ~1GB)")
    elif use_synthetic:
        print("(SENTETİK 6 aylık veri kullanılıyor — tarih/trend senaryoları dahil)")
    print("=" * 70)
    build_database(csv_path=_pick_csv(use_synthetic, use_large))

    passed, total = 0, len(LIVE_TEST_CASES)
    for case in LIVE_TEST_CASES:
        expect = case.get("expect_synthetic", case["expect"]) if (use_synthetic or use_large) else case["expect"]
        result = ask(case["question"], session_id="test-harness")
        ok = _matches_expectation(result.status, expect)
        status_icon = "✅" if ok else "❌"
        print(f"{status_icon} [{case['id']}] status={result.status:15s} beklenen={expect:15s}")
        print(f"    Soru: {case['question']}")
        print(f"    SQL : {result.sql}")
        print(f"    Cevap: {result.answer[:120]}")
        print()
        if ok:
            passed += 1

    accuracy = passed / total
    print(f"LIVE SONUÇ: {passed}/{total} senaryo doğru ({accuracy:.0%})")
    print(f"DoD kabul kriteri (≥90%): {'✅ GEÇTİ' if accuracy >= 0.9 else '❌ GEÇMEDİ'}")
    return accuracy >= 0.9


def _matches_expectation(status: str, expect: str) -> bool:
    if expect == "ok":
        return status == "ok"
    if expect == "no_data_ok":
        return status in ("no_data", "empty")
    if expect == "unknown_column":
        return status == "unknown_column"
    if expect == "empty_or_unknown":
        return status in ("empty", "unknown_column", "no_data")
    return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="LLM gerektirmeyen plumbing testi")
    parser.add_argument("--live", action="store_true", help="Bulutistan LLM ile uçtan uca test")
    parser.add_argument("--synthetic", action="store_true",
                         help="Sentetik 6 aylık veri kullan (12K satır)")
    parser.add_argument("--large", action="store_true",
                         help="Büyük sentetik veri kullan (~3.1M satır / ~1GB) — "
                              "önce 'python -m app.generate_synthetic_large' ile üretilmeli")
    args = parser.parse_args()

    if not args.offline and not args.live:
        args.offline = True  # varsayılan: kimlik bilgisi gerektirmeyen mod

    ok = True
    if args.offline:
        ok = run_offline(use_synthetic=args.synthetic, use_large=args.large) and ok
    if args.live:
        ok = run_live(use_synthetic=args.synthetic, use_large=args.large) and ok

    sys.exit(0 if ok else 1)
