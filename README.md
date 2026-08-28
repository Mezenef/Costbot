<div align="center">

# 🤖 CostBot

### Doğal Dille Konuşan, Yapay Zeka Destekli Azure Bulut Maliyet Analiz Asistanı

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Azure](https://img.shields.io/badge/Microsoft_Azure-0089D6?style=for-the-badge&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/)

*"Bu ay en pahalı servisim hangisi?" diye sormak, düzinelerce Azure Portal ekranında dolaşmaktan çok daha kolay.*

</div>

> **Not:** Bu proje, staj süresince SabancıDx'in Azure kaynakları üzerinde canlıya alınmıştı. Staj sonunda kurumsal kaynaklar kapatıldığı için canlı demo artık erişilebilir değil — aşağıdaki ekran görüntüleri, uygulamanın gerçek Azure ortamındaki çalışır hâlini yansıtmaktadır. Proje `docker-compose up` ile yerel ortamda eksiksiz çalıştırılabilir.

---

## 💡 Bu Proje Ne Yapıyor?

Kurumların Azure bulut harcamalarını incelemesi genelde onlarca dashboard ekranında dolaşmayı, filtre üstüne filtre uygulamayı gerektirir. **CostBot**, bu süreci tek bir soruya indiriyor: *"Bu ay en pahalı servisim hangisi?"*

Gerçek Azure Cost Management verisiyle çalışan bu uygulama, kullanıcının doğal dilde sorduğu soruyu bir yapay zekâ ajanı aracılığıyla SQL sorgusuna çevirir, gerçek veritabanında çalıştırır ve **hiçbir sayı uydurmadan**, gerçek sonuçlara dayalı bir cevap üretir.

Bu projeyi, **SabancıDx bünyesinde tamamladığım yazılım mühendisliği stajı** kapsamında, fikir aşamasından canlı bir Azure ortamına taşınmasına kadar **uçtan uca tek başıma geliştirdim.**

---

## 📸 Ekran Görüntüleri

![Web Arayüzü](docs/images/web_arayuz.PNG)

| Dashboard | AI Sohbet Arayüzü |
|---|---|
| ![Dashboard](docs/images/Dashboard.PNG) | ![Sohbet](docs/images/chat.png) |

| PDF Rapor | Cost Analyzer |
|---|---|
| ![Rapor](docs/images/report.png) | ![Analyzer](docs/images/analyzer.PNG) |

---

## ✨ Öne Çıkan Özellikler

| | |
|---|---|
| 💬 **Doğal Dil Sorgulama** | "Geçen aya göre en çok artan servis hangisi?" gibi soruları anlar, gerçek SQL sorgusuna çevirir |
| 📊 **Canlı Dashboard** | Toplam maliyet, trend grafikleri, servis/kategori dağılımı, resource group karşılaştırmaları |
| 🔮 **AI Maliyet Tahmini** | Geçmiş verilere dayanarak ay sonu maliyetini tahmin eder |
| 💡 **Akıllı Öneriler** | Düşük kullanım + yüksek maliyet sezgisiyle tasarruf fırsatlarını tespit eder |
| 🎯 **FinOps Sağlık Puanı** | 5 kural tabanlı kritere göre 0-100 arası deterministik bir skor |
| 🔔 **Otomatik Uyarılar** | Maliyet artışlarını ve bütçe eşiği aşımlarını e-posta + Microsoft Teams ile bildirir |
| 📄 **PDF Raporlama** | Tek tıkla, çok dilli (TR/EN), zamanlanmış dönemsel rapor üretimi |
| 🔐 **Güvenli Kimlik Doğrulama** | E-posta doğrulamalı kayıt, rol tabanlı erişim |
| ⚡ **Gerçek Zamanlı Sohbet** | Yanıtlar, ChatGPT tarzı akan (streaming) bir arayüzle gelir |

---

## 🏗️ Mimari

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│    Next.js 15    │─────▶│     FastAPI       │─────▶│   PostgreSQL     │
│    TypeScript     │◀─────│     Python         │◀─────│                  │
│    (Frontend)      │      │    (Backend)        │      │  (Veritabanı)    │
└─────────────────┘      └────────┬─────────┘      └─────────────────┘
                                    │
                        ┌──────────┴──────────┐
                        ▼                     ▼
              ┌──────────────────┐  ┌─────────────────────┐
              │   Bulutistan LLM   │  │   Azure Cost         │
              │   (SQL Agent)       │  │   Management API       │
              └──────────────────┘  └─────────────────────┘
```

Kullanıcının sorusu LLM tarafından **SQL'e çevrilir** → güvenlik doğrulamasından geçer (yalnızca `SELECT`) → PostgreSQL'de çalıştırılır → gerçek sonuç, ikinci bir LLM çağrısıyla doğal dile dönüştürülür.

---

## 🛠️ Teknoloji Yığını

**Backend:** Python · FastAPI · PostgreSQL · LangChain · Azure Identity SDK · ReportLab · Matplotlib · APScheduler · Pytest

**Frontend:** Next.js 15 · TypeScript · Tailwind CSS · Recharts

**Altyapı & DevOps:** Docker · Azure App Service · Azure Database for PostgreSQL · Azure Container Registry

**Entegrasyonlar:** Azure Cost Management API · SMTP · Microsoft Teams Workflows

---

## 🚀 Geliştirme Süreci

Bu proje kapsamında yalnızca kod yazmakla kalmadım; aynı zamanda:

- Gerçek bir bulut API'sinden (Azure Cost Management) canlı veri çekme entegrasyonu kurdum
- LangChain ile bir SQL ajanı geliştirip halüsinasyon riskini SQL doğrulama katmanıyla azalttım
- Uygulamayı Docker ile container'laştırıp Azure App Service üzerinde canlıya aldım
- HTTPS zorunluluğu, CORS kısıtlaması ve veritabanı erişim kontrolü gibi güvenlik önlemlerini uyguladım
- Proje, `docker-compose up` ile tek komutla yerel ortamda da eksiksiz çalışacak şekilde tasarlandı

---

## ⚙️ Yerel Kurulum

<details>
<summary><b>Backend</b></summary>

```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
cp .env.example .env         # kendi bilgilerinizi girin
uvicorn app.main:app --reload --port 8000
```
</details>

<details>
<summary><b>Frontend</b></summary>

```bash
cd frontend
npm install
npm run dev
```
</details>

Ya da tüm sistemi Docker ile tek komutla ayağa kaldırabilirsiniz:

```bash
docker-compose up -d --build
```

Uygulama `http://localhost:3000` adresinde çalışmaya başlar.

## 🧪 Testler

```bash
cd backend
pytest test/ -v
```

---

## 📬 İletişim

**Aleyna Erdoğan**
[LinkedIn](https://www.linkedin.com/in/aleyna-erdogan) · aleynaaerdd@gmail.com

Bu proje, SabancıDx bünyesinde tamamlanan bir staj kapsamında geliştirilmiştir.
