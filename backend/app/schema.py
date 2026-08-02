"""
schema.py
LLM'e gösterilecek şema açıklamasını üretir ve SQL doğrulaması için
izinli tablo/kolon beyaz listesini tutar.

Amaç: LLM'in ürettiği SQL'i körü körüne çalıştırmak yerine,
DoD Bölüm 2 (Error/Edge Cases) gereğince önce doğrulamak.
"""
from .database import get_connection

# ── İzinli şema (whitelist) — yalnızca bunlara SELECT atılabilir ──
ALLOWED_TABLES = {
    "CloudCosts": [
        "id", "UsageDate", "SubscriptionId", "SubscriptionName", "ResourceGroup",
        "ResourceId", "ResourceName", "ServiceName", "MeterCategory", "MeterName",
        "ResourceLocation", "ChargeType", "Quantity", "UnitOfMeasure",
        "PreTaxCost", "Currency",
    ],
    "CostRecommendations": [
        "RecommendationId", "CreatedDate", "TargetService", "TargetResourceName",
        "RecommendationText", "PotentialSavings", "Currency", "Status", "ActionDate",
    ],
    "ChatHistory": [
        "MessageId", "SessionId", "Timestamp", "UserPrompt", "GeneratedSQL",
        "QueryResultJSON", "BotResponseText", "ExecutionTime",
    ],
}

COLUMN_DESCRIPTIONS = {
    "UsageDate": "Tarih (YYYY-MM-DD formatında, örn: '2026-06-15')",
    "SubscriptionId": "Abonelik benzersiz kodu (GUID)",
    "SubscriptionName": "Abonelik adı (örn: 'sub-data-prod')",
    "ResourceGroup": "Kaynak grubu adı (örn: 'rg-shared-test-003')",
    "ResourceId": "Kaynağın tam Azure kaynak yolu",
    "ResourceName": "Kaynağın kısa adı (örn: 'res01995')",
    "ServiceName": "Azure servis türü (örn: 'Virtual Machines', 'Azure SQL Database', 'Storage')",
    "MeterCategory": "Ölçüm kategorisi (örn: 'Compute', 'Networking', 'Security')",
    "MeterName": "Ölçüm alt tipi (örn: 'Standard IO - Disk', 'Execution Time')",
    "ResourceLocation": "Azure bölgesi (örn: 'germanywestcentral', 'northeurope')",
    "ChargeType": "Ödeme türü ('Usage' veya 'Purchase')",
    "Quantity": "Tüketilen miktar (REAL sayı)",
    "UnitOfMeasure": "Ölçüm birimi (örn: '1 Hour', '1 Unit')",
    "PreTaxCost": "Vergi öncesi maliyet — TÜM MALİYET SORULARINDA BU KOLONU KULLAN (REAL, USD)",
    "Currency": "Para birimi (bu veri setinde sabit: 'USD')",
}


def get_schema_prompt() -> str:
    """LLM prompt'una gömülecek, örnek değerlerle zenginleştirilmiş şema metni."""
    conn = get_connection()
    lines = []
    for table, cols in ALLOWED_TABLES.items():
        lines.append(f"### Tablo: {table}")
        for col in cols:
            desc = COLUMN_DESCRIPTIONS.get(col, "")
            lines.append(f"  - {col}{' — ' + desc if desc else ''}")
        lines.append("")

    # Az sayıda örnek değer ekle (LLM'in halüsinasyon üretmesini azaltır)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT ServiceName AS servicename FROM CloudCosts ORDER BY ServiceName LIMIT 30")
    services = [r["servicename"] for r in cur.fetchall()]
    cur.execute("SELECT MIN(UsageDate) AS dmin, MAX(UsageDate) AS dmax FROM CloudCosts")
    row = cur.fetchone()
    dmin, dmax = row["dmin"], row["dmax"]
    conn.close()

    lines.append("### Veri setindeki gerçek ServiceName değerleri (yalnızca bunları kullan):")
    lines.append(", ".join(services))
    lines.append("")
    lines.append(f"### Veri setindeki tarih aralığı: {dmin} — {dmax}")
    lines.append(
        "ÖNEMLİ: Eğer kullanıcının sorduğu tarih aralığı bu aralığın dışındaysa "
        "veya veri setinde birden fazla tarih yokken 'trend' isteniyorsa, "
        "SQL üretme; bunun yerine NO_DATA yanıtı ver."
    )
    return "\n".join(lines)


def get_column_names(table: str) -> list[str]:
    return ALLOWED_TABLES.get(table, [])


if __name__ == "__main__":
    print(get_schema_prompt())
