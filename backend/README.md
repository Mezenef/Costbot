# CostBot — SQL Agent Prototipi (Faz 0: Risk Doğrulama)

DoD raporunda en riskli bileşen olarak işaretlenen **LangChain SQL Agent
prompt tuning** riskini doğrulamak için hazırlanan ilk prototip.

## Neden bu şekilde kuruldu?

`langchain`'in hazır `create_sql_agent()` yardımcısı yerine, `SQLDatabase`
kavramı + kendi doğrulama/orkestrasyon katmanımız tercih edildi. Gerekçe:
DoD Bölüm 2'deki Türkçe, ürüne özel hata mesajları ("bu veri mevcut değil",
"bu kriterlere uyan veri bulunamadı") generic bir agent'ın davranışına
güvenmek yerine, açık kontrol akışıyla (`sql_agent.py::ask`) güvenilir
şekilde üretiliyor. Ayrıca yalnızca SELECT'e izin veren whitelist tabanlı
`validate_sql()` katmanı, LLM'in üretebileceği tehlikeli sorgulara karşı
ek bir güvenlik katmanı sağlıyor.

## Dosya yapısı

```
backend/
  app/
    database.py     # 3 tablolu SQLite şeması + CSV yükleme (CREATE_TABLE_CloudCosts.docx ile birebir)
    schema.py        # LLM'e gösterilecek şema açıklaması + whitelist
    prompts.py        # Sistem prompt + DoD'nin 4 senaryosuna karşılık gelen few-shot örnekler
    llm_client.py      # Bulutistan LLMaaS istemcisi (OpenAI-uyumlu arayüz varsayımıyla)
    sql_agent.py        # Ana orkestrasyon: üret → doğrula → çalıştır → retry → logla
  tests/
    test_scenarios.py    # DoD kabul kriterini (≥90%) ölçen test harness
  data/
    azure_cost_mock_data.csv   # Mentörden gelen gerçek mock veri (2020 satır, TEK tarih: 2026-06-15)
    costbot.db                  # build sonrası oluşur
  requirements.txt
  .env.example
```

## Kurulum

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Bulutistan API bilgilerini doldurun
```

## Veritabanını kur

```bash
python -m app.database
```

## Test — iki mod

**Offline (LLM gerektirmez, şimdi çalışır):**
```bash
python -m tests.test_scenarios --offline
```
Doğrulama + çalıştırma + güvenlik katmanının sağlam olduğunu, DoD'nin
kendi referans SQL sorgularını gerçekten çalıştırarak kanıtlar.
Bu ortamda zaten çalıştırıldı: **9/9 test geçti.**

**Live (Bulutistan kimlik bilgileri gerekir — asıl risk doğrulaması):**
```bash
python -m tests.test_scenarios --live
```
DoD Bölüm 2'deki 4 senaryoyu + 2 edge-case'i gerçek doğal dil sorularıyla
uçtan uca test eder, ≥%90 kabul kriterine göre rapor basar.

## Veri stratejisi: 3 katman

| Dosya | Satır | Ne için |
|---|---|---|
| `azure_cost_mock_data.csv` | 2.020 | Mentörden gelen GERÇEK veri (tek tarih) — asla değiştirilmez, referans |
| `azure_cost_mock_data_WORKING.csv` | 12.120 | **Projenin varsayılan çalışma verisi** — backend/frontend geliştirirken bunu kullan |
| `azure_cost_mock_data_SENTETIK_BUYUK.csv` | ~3,1 milyon | Hacim/performans testi — zip'e dahil değil, ayrı üretilir |

### WORKING veri seti nasıl üretildi ve neden gerçek veriden daha kullanışlı

`app/generate_working_dataset.py`, mentörün 2020 satırlık tek-günlük
verisini 6 aya (2026-01 → 2026-06) yayarken şunları da düzeltti:

1. **Servis bazlı farklı trendler** — tüm servisler aynı oranda artmıyor;
   her servisin kendi büyüme/küçülme eğilimi var. Bu sayede "top-5 servis"
   sıralaması aylar arasında değişiyor, trend grafiği gerçekçi görünüyor.
2. **Bilinçli "atıl" kaynaklar** — 2020 kaynaktan ~80 tanesi kullanımı
   (Quantity) çok düşük ama maliyeti sabit kalacak şekilde işaretlendi
   (durdurulmamış ama boşta duran VM senaryosu). Böylece "maliyetleri
   nasıl azaltabilirim" sorusu demo'da anlamlı, dolu bir liste döndürüyor.
3. **Bug düzeltmesi:** İlk denemede "atıl kaynak" sorgumuz (`Quantity < 5`)
   yanlışlıkla Reservation SATIN ALIMLARINI da (ChargeType='Purchase',
   doğası gereği Quantity=1) israf sanıp öneriyordu — halbuki rezervasyon
   zaten bir tasarruf mekanizmasıdır. `prompts.py`'de `ChargeType='Usage'`
   filtresi eklenerek düzeltildi.

Yeniden üretmek için:
```bash
python -m app.generate_working_dataset
```

### Büyük hacim testi (opsiyonel, ~1GB)

```bash
python -m app.generate_synthetic_large --target-gb 1.0 --days 730
```

**Performans sonucu (3.115.138 satır üzerinde ölçüldü):** top-5 servis
0.25s, tarih filtreleme 0.14s, trend 1.81s — DoD'nin "5 saniye" kabul
kriterinin rahatça altında (yalnızca `PreTaxCost` içeren kapsayıcı
index'ler sayesinde — düz index'lerle 3.8s'ye kadar çıkıyordu, bkz.
`database.py::init_schema` yorumları).

**Kullanım:**
```bash
python -m tests.test_scenarios --offline                # gerçek, tek tarihli veri
python -m tests.test_scenarios --offline --synthetic     # WORKING veri (önerilen)
python -m tests.test_scenarios --offline --large         # 1GB sentetik (önce üretilmeli)
python -m tests.test_scenarios --live --synthetic        # asıl risk testi: LLM + WORKING veri
```

## Sonraki adım

Bu prototip `--live` modda ≥%90 doğrulukla geçtiğinde, risk kapanmış
sayılır ve FastAPI `main.py` + Next.js frontend + Docker iskeletine
geçilebilir (bir sonraki mesajda konuşuruz).
