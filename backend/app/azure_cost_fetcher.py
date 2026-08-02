"""
azure_cost_fetcher.py
Gerçek Azure Cost Management "Cost Details Report" API'sinden asenkron
olarak bir CSV raporu talep eder, indirir ve CloudCosts şemamıza uygun
satırlara dönüştürür.

AKIŞ:
  1. POST generateCostDetailsReport -> 202 (Location header) ya da 200
  2. 202 ise: Location URL'ini Retry-After kadar bekleyip tekrar sorgula
  3. 200 gelince: manifest.blobs[0].blobLink -> CSV dosyasını indir
  4. CSV'yi CLOUDCOSTS_COLUMNS'a eşle, satır listesi olarak döndür

NOT: Fatura tipine (EA/MCA/MOSA) göre CSV kolon adları değişebiliyor.
Bu yüzden eşleme, "olası isimler listesi" ile ESNEK yapıldı -- gerçek
kolon adları her çalıştırmada loglanıyor, eşleşme başarısız olursa bu
logdan hangi isimlerin geldiğini görüp COLUMN_ALIASES güncellenebilir.
Sandbox'ta hem MCA hem EA tarzı örnek verilerle test edildi.
"""
import csv as csv_module
import io
import time
import requests
from datetime import date, datetime, timedelta
from azure.identity import ClientSecretCredential

COST_MGMT_API_VERSION = "2025-03-01"
GRAPH_SCOPE = "https://management.azure.com/.default"

COLUMN_ALIASES = {
    "UsageDate": ["Date", "UsageDateTime", "UsageDate"],
    "SubscriptionId": ["SubscriptionId", "SubscriptionGuid"],
    "SubscriptionName": ["SubscriptionName"],
    "ResourceGroup": ["ResourceGroup", "ResourceGroupName"],
    "ResourceId": ["ResourceId", "InstanceId"],
    "ResourceName": ["ResourceName"],  # CSV'nin kendi hazir kolonu -- tahmin etmeye gerek yok
    "ServiceName": ["MeterCategory", "ConsumedService", "ServiceName"],  # MeterCategory daha okunakli (ör. "Azure Cosmos DB" vs "microsoft.documentdb")
    "MeterCategory": ["MeterCategory"],
    "MeterName": ["MeterName", "MeterSubCategory"],
    "ResourceLocation": ["ResourceLocation", "Location"],
    "ChargeType": ["ChargeType"],
    "Quantity": ["Quantity", "UsageQuantity"],
    "UnitOfMeasure": ["UnitOfMeasure"],
    "PreTaxCost": ["CostInBillingCurrency", "PreTaxCost", "Cost"],
    "Currency": ["BillingCurrency", "Currency", "BillingCurrencyCode"],
}


def _get_access_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    credential = ClientSecretCredential(tenant_id, client_id, client_secret)
    token = credential.get_token(GRAPH_SCOPE)
    return token.token


def _request_cost_details_report(access_token: str, subscription_id: str, start_date: str, end_date: str) -> dict:
    """Rapor üretimini başlatır, tamamlanana kadar bekler (poll), rapor
    manifestini (blobLink dahil) döndürür. 429 (rate limit) gelirse
    Retry-After header'ına göre bekleyip otomatik tekrar dener --
    6 aylık bir arka arkaya çekim, Azure'un kendi hız sınırına takılabiliyor."""
    url = f"https://management.azure.com/subscriptions/{subscription_id}/providers/Microsoft.CostManagement/generateCostDetailsReport?api-version={COST_MGMT_API_VERSION}"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    body = {"metric": "ActualCost", "timePeriod": {"start": start_date, "end": end_date}}

    max_429_retries = 5
    for attempt in range(max_429_retries):
        resp = requests.post(url, headers=headers, json=body, timeout=30)

        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", "60"))
            print(f"[azure_cost_fetcher] 429 (hız sınırı) alındı, {wait} saniye bekleniyor... (deneme {attempt + 1}/{max_429_retries})")
            time.sleep(wait)
            continue

        if resp.status_code == 200:
            return resp.json()

        if resp.status_code == 202:
            poll_url = resp.headers.get("Location")
            retry_after = int(resp.headers.get("Retry-After", "10"))
            max_attempts = 30
            for _ in range(max_attempts):
                time.sleep(retry_after)
                poll_resp = requests.get(poll_url, headers=headers, timeout=30)
                if poll_resp.status_code == 200:
                    return poll_resp.json()
                if poll_resp.status_code == 202:
                    retry_after = int(poll_resp.headers.get("Retry-After", "10"))
                    continue
                if poll_resp.status_code == 429:
                    wait = int(poll_resp.headers.get("Retry-After", "60"))
                    print(f"[azure_cost_fetcher] Bekleme sırasında 429 alındı, {wait} saniye bekleniyor...")
                    time.sleep(wait)
                    continue
                poll_resp.raise_for_status()
            raise TimeoutError("Rapor üretimi zaman aşımına uğradı (30 deneme sonunda hâlâ hazır değil).")

        resp.raise_for_status()

    raise RuntimeError("Azure Cost Management API'si tekrarlanan 429 (hız sınırı) hatası verdi -- lütfen birkaç dakika sonra tekrar deneyin.")


def _resolve_column(headers: list, target: str):
    for alias in COLUMN_ALIASES.get(target, []):
        if alias in headers:
            return alias
    return None

def _normalize_date(raw: str) -> str:
    """Azure Cost Details CSV'sindeki tarih formatı fatura tipine göre
    değişebiliyor (bazen YYYY-MM-DD, bazen MM/DD/YYYY gibi). İkisini de
    deneyip her zaman ISO (YYYY-MM-DD) formatında döndürür -- aksi
    hâlde forecast.py/dashboard.py gibi yerler tarihi parse edemeyip
    çöküyordu (gerçek Azure verisiyle test ederken bulundu)."""
    raw = (raw or "").strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return raw[:10]

def _parse_manifest_to_rows(manifest: dict) -> list:
    """Bir rapor manifestinden (blobLink'ler) CSV'leri indirip
    CLOUDCOSTS_COLUMNS şemamıza eşler."""
    blobs = manifest.get("manifest", {}).get("blobs", [])
    if not blobs:
        return []

    all_rows = []
    for blob in blobs:
        blob_link = blob["blobLink"]
        csv_resp = requests.get(blob_link, timeout=60)
        csv_resp.raise_for_status()

        reader = csv_module.DictReader(io.StringIO(csv_resp.text))
        csv_headers = reader.fieldnames or []
        print("[azure_cost_fetcher] CSV'deki gerçek kolonlar:", csv_headers)

        col_map = {target: _resolve_column(csv_headers, target) for target in COLUMN_ALIASES}
        missing = [k for k, v in col_map.items() if v is None and k not in ("SubscriptionName", "ResourceName")]
        if missing:
            raise ValueError(
                f"Beklenen kolonlar CSV'de bulunamadı: {missing}. "
                f"Gerçek CSV kolonları: {csv_headers} -- COLUMN_ALIASES güncellenmesi gerekebilir."
            )

        for row in reader:
            resource_id = row.get(col_map["ResourceId"], "") or ""
            if col_map.get("ResourceName"):
                resource_name = row.get(col_map["ResourceName"], "") or ""
            else:
                resource_name = resource_id.rstrip("/").split("/")[-1] if resource_id else ""
            try:
                all_rows.append({
                    "UsageDate": _normalize_date(row.get(col_map["UsageDate"], "")),
                    "SubscriptionId": row.get(col_map["SubscriptionId"], ""),
                    "SubscriptionName": row.get(col_map["SubscriptionName"], "") if col_map.get("SubscriptionName") else "",
                    "ResourceGroup": row.get(col_map["ResourceGroup"], ""),
                    "ResourceId": resource_id,
                    "ResourceName": resource_name,
                    "ServiceName": row.get(col_map["ServiceName"], ""),
                    "MeterCategory": row.get(col_map["MeterCategory"], ""),
                    "MeterName": row.get(col_map["MeterName"], ""),
                    "ResourceLocation": row.get(col_map["ResourceLocation"], ""),
                    "ChargeType": row.get(col_map["ChargeType"], ""),
                    "Quantity": float(row.get(col_map["Quantity"], 0) or 0),
                    "UnitOfMeasure": row.get(col_map["UnitOfMeasure"], ""),
                    "PreTaxCost": float(row.get(col_map["PreTaxCost"], 0) or 0),
                    "Currency": row.get(col_map["Currency"], "USD"),
                })
            except (ValueError, TypeError):
                continue
    return all_rows


def fetch_azure_cost_rows(tenant_id: str, client_id: str, client_secret: str, subscription_id: str, days: int = 30) -> list:
    """Son `days` günün gerçek Azure maliyet verisini çeker (günlük
    otomatik senkronizasyon için -- kayan pencere)."""
    access_token = _get_access_token(tenant_id, client_id, client_secret)
    end = date.today()
    start = end - timedelta(days=days)
    manifest = _request_cost_details_report(access_token, subscription_id, start.isoformat(), end.isoformat())
    return _parse_manifest_to_rows(manifest)


def fetch_azure_cost_rows_range(tenant_id: str, client_id: str, client_secret: str, subscription_id: str, start_date: str, end_date: str) -> list:
    """Belirli bir BAŞLANGIÇ-BİTİŞ aralığı için veri çeker. Azure'un
    kendi kısıtı ('tek istekte en fazla 1 aylık aralık') yüzünden,
    araliği AY AY bölüp her ay için ayrı bir rapor isteği yapar,
    sonuçları birleştirir. 6 aylık bir geçmiş için bu 6 ayrı (sıralı)
    API çağrısı ve bekleme demektir -- TOPLAMDA UZUN SÜREBİLİR
    (her ay birkaç dakika)."""
    access_token = _get_access_token(tenant_id, client_id, client_secret)

    all_rows = []
    current = date.fromisoformat(start_date).replace(day=1)
    end = date.fromisoformat(end_date)

    while current <= end:
        if current.month == 12:
            next_month = current.replace(year=current.year + 1, month=1, day=1)
        else:
            next_month = current.replace(month=current.month + 1, day=1)
        month_end = min(next_month - timedelta(days=1), end)

        print(f"[azure_cost_fetcher] {current.isoformat()} - {month_end.isoformat()} dönemi için rapor isteniyor...")
        manifest = _request_cost_details_report(access_token, subscription_id, current.isoformat(), month_end.isoformat())
        all_rows.extend(_parse_manifest_to_rows(manifest))

        current = next_month
        if current <= end:
            time.sleep(15)

    return all_rows