"""
generate_working_dataset.py
Projenin VARSAYILAN ÇALIŞMA VERİSİ — mentörün 2020 satırlık tek-günlük
gerçek verisini, hem test edilebilir hem "demo edilebilir" 6 aylık bir
veri setine dönüştürür.

v1'den (generate_synthetic_dates.py) farkları:
  1. Tek bir global trend çarpanı yerine HER SERVİS kendi yönünde
     hareket eder (bazıları büyüyor, bazıları küçülüyor) — "top-5 servis"
     sıralaması aylar arasında değişir, trend grafiği daha ilgi çekici olur.
  2. ChargeType='Usage' olan birkaç kaynak BİLİNÇLİ OLARAK "atıl" profiline
     sokulur (Quantity düşük tutulur, PreTaxCost aynı kalır) — böylece
     "maliyetleri nasıl azaltabilirim" sorusu demo'da boş dönmez.
  3. Reservations/Refund (ChargeType != 'Usage') satırlarına trend/atıl
     mantığı UYGULANMAZ — bunlar gerçek dünyada olduğu gibi sabit/nadir
     kalır (bkz. prompts.py'deki ChargeType='Usage' düzeltmesi).

Çıktı: data/azure_cost_mock_data_WORKING.csv — proje boyunca backend'in
varsayılan olarak yükleyeceği dosya budur.
"""
import csv
import random
from calendar import monthrange
from pathlib import Path

random.seed(7)

SRC = Path(__file__).parent.parent / "data" / "azure_cost_mock_data.csv"
DST = Path(__file__).parent.parent / "data" / "azure_cost_mock_data_WORKING.csv"

MONTHS = [1, 2, 3, 4, 5, 6]  # 2026-01 .. 2026-06
YEAR = 2026

# Her benzersiz kaynak için, ay başına küçük rastgele bir "yürüyüş" uygulanır.
# Bazı kaynaklar zamanla büyür (ör. yeni ürün büyümesi), bazıları küçülür
# (ör. optimize edilmiş / terk edilmiş kaynaklar).
IDLE_RATIO = 0.04  # kaynakların ~%4'ü bilinçli olarak "atıl" yapılır


def random_day(year: int, month: int) -> str:
    last_day = monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-{random.randint(1, last_day):02d}"


def main():
    with open(SRC, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    # Her benzersiz kaynak (ResourceId) için bir "kişilik" ata:
    # - growth_rate: her ay maliyetin ne kadar değişeceği (-%15 .. +%15)
    # - is_idle: bu kaynak demo amaçlı atıl mı yapılsın
    resource_ids = sorted({r["ResourceId"] for r in rows})
    personality = {}
    idle_pool = set(random.sample(resource_ids, k=max(1, int(len(resource_ids) * IDLE_RATIO))))
    for rid in resource_ids:
        personality[rid] = {
            "growth_rate": random.uniform(-0.15, 0.15),
            "is_idle": rid in idle_pool,
        }

    out_rows = []
    for month in MONTHS:
        months_from_start = month - MONTHS[0]
        for row in rows:
            new_row = dict(row)
            rid = row["ResourceId"]
            p = personality[rid]
            new_row["UsageDate"] = random_day(YEAR, month)

            if row["ChargeType"] != "Usage":
                # Reservations / Refund -> trend/atıl mantığı uygulanmaz,
                # yalnızca tarihi rastgele bir aya yayılır.
                out_rows.append(new_row)
                continue

            noise = random.uniform(0.92, 1.08)
            growth_factor = (1 + p["growth_rate"]) ** months_from_start

            if p["is_idle"]:
                # Atıl profil: kullanım (Quantity) çok düşük ama maliyet
                # neredeyse aynı kalıyor (ör. durdurulmamış ama boşta duran VM).
                new_row["Quantity"] = round(float(row["Quantity"]) * 0.03, 4)
                new_row["PreTaxCost"] = round(float(row["PreTaxCost"]) * noise, 4)
            else:
                new_row["Quantity"] = round(float(row["Quantity"]) * growth_factor * noise, 4)
                new_row["PreTaxCost"] = round(float(row["PreTaxCost"]) * growth_factor * noise, 4)

            out_rows.append(new_row)

    with open(DST, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    total_cost = sum(float(r["PreTaxCost"]) for r in out_rows)
    n_idle = sum(1 for rid, p in personality.items() if p["is_idle"])
    print(f"✅ Çalışma veri seti üretildi: {DST}")
    print(f"   Toplam satır        : {len(out_rows)}")
    print(f"   Tarih aralığı        : 2026-01-01 .. 2026-06-30")
    print(f"   Toplam maliyet        : ${total_cost:,.2f}")
    print(f"   Bilinçli 'atıl' kaynak: {n_idle} / {len(resource_ids)}")


if __name__ == "__main__":
    main()
