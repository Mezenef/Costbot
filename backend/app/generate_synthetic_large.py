"""
generate_synthetic_large.py
Mentörden gelen 2020 satırlık tek-günlük mock veriyi, GERÇEKÇİ HACİMLİ
(~1GB) çok-tarihli bir test veri setine genişletir.

Mantık:
  - Orijinal 2020 satır, birer "kaynak şablonu" olarak kullanılır
    (SubscriptionId, ResourceGroup, ResourceId, ServiceName, MeterCategory,
    MeterName, ResourceLocation, ChargeType, UnitOfMeasure, Currency SABİT
    kalır — yalnızca UsageDate, Quantity, PreTaxCost değişir).
  - Varsayılan olarak son 730 gün (≈2 yıl), her gün için şablon havuzundan
    örnekleme yapılır. Gerçek Azure faturalama verisinde bir kaynağın
    günde birden fazla meter satırı olması normaldir (VM + disk + network
    gibi) — bu yüzden günlük satır sayısı, kaynak sayısından fazladır.
  - Uzun vadeli hafif artan bir maliyet trendi + mevsimsel dalgalanma +
    satır bazlı rastgele gürültü uygulanır.
  - Bellek şişmesini önlemek için satırlar TEK TEK diske yazılır (3M+
    satırlık veri tek seferde belleğe alınmaz).

Kullanım:
    python -m app.generate_synthetic_large --target-gb 1.0 --days 730

ÖNEMLİ: Bu SENTETİK bir veridir; dosya adında bilinçli olarak
SENTETIK_BUYUK etiketi var. Gerçek veriye entegrasyon (Azure Cost
Management API / Bulutistan Tüketim API) DoD'nin Final Phase kapsamında.
"""
import argparse
import csv
import math
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

SRC = Path(__file__).parent.parent / "data" / "azure_cost_mock_data.csv"
DST = Path(__file__).parent.parent / "data" / "azure_cost_mock_data_SENTETIK_BUYUK.csv"

BYTES_PER_ROW_ESTIMATE = 320  # orijinal dosyadan ölçüldü (~319.5 byte/satır)


def load_templates() -> list[dict]:
    with open(SRC, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader), reader.fieldnames


def seasonal_multiplier(day_index: int, total_days: int) -> float:
    """Uzun vadeli hafif artan trend + yıllık mevsimsel dalga (sinüs)."""
    long_term = 0.75 + 0.35 * (day_index / total_days)          # 0.75 -> 1.10 kademeli artış
    seasonal = 1.0 + 0.08 * math.sin(2 * math.pi * day_index / 365)  # ±%8 mevsimsel dalga
    return long_term * seasonal


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-gb", type=float, default=1.0, help="Hedef dosya boyutu (GB)")
    parser.add_argument("--days", type=int, default=730, help="Kaç günlük geçmişe yayılsın (varsayılan 2 yıl)")
    parser.add_argument("--end-date", type=str, default="2026-06-30", help="Verinin biteceği tarih (bugüne yakın)")
    args = parser.parse_args()

    templates, fieldnames = load_templates()
    n_templates = len(templates)

    target_bytes = args.target_gb * 1_000_000_000
    target_rows = int(target_bytes / BYTES_PER_ROW_ESTIMATE)
    rows_per_day = max(1, round(target_rows / args.days))

    end = date.fromisoformat(args.end_date)
    start = end - timedelta(days=args.days - 1)

    print(f"Şablon (benzersiz kaynak) sayısı : {n_templates}")
    print(f"Hedef satır sayısı               : {target_rows:,}")
    print(f"Gün sayısı                        : {args.days} ({start} → {end})")
    print(f"Gün başına ortalama satır          : {rows_per_day}")
    print("Yazılıyor...")

    written = 0
    with open(DST, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for day_idx in range(args.days):
            current_date = (start + timedelta(days=day_idx)).isoformat()
            factor = seasonal_multiplier(day_idx, args.days)

            # O gün için rastgele sayıda satır (ortalama etrafında hafif dalgalanan)
            n_rows_today = max(1, int(random.gauss(rows_per_day, rows_per_day * 0.1)))

            for _ in range(n_rows_today):
                tpl = templates[random.randrange(n_templates)]
                noise = random.uniform(0.85, 1.15)
                row = dict(tpl)
                row["UsageDate"] = current_date
                row["Quantity"] = round(float(tpl["Quantity"]) * factor * noise, 4)
                row["PreTaxCost"] = round(float(tpl["PreTaxCost"]) * factor * noise, 4)
                writer.writerow(row)
                written += 1

            if day_idx % 100 == 0:
                print(f"  ... gün {day_idx}/{args.days}, şu ana kadar {written:,} satır")

    size_bytes = DST.stat().st_size
    print(f"\n✅ Bitti: {DST}")
    print(f"   Yazılan satır  : {written:,}")
    print(f"   Dosya boyutu   : {size_bytes/1_000_000_000:.2f} GB ({size_bytes/1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
