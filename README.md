cat > README.md << 'EOF'
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

---

## 📌 Nedir Bu?

**CostBot**, kurumların Azure bulut harcamalarını **doğal dilde soru sorarak** analiz edebilmesini sağlayan, uçtan uca geliştirilmiş bir web uygulaması. Gerçek Azure Cost Management verisiyle çalışır, yapay zeka destekli bir SQL agent'ı üzerinden sorularınızı yanıtlar ve size **halüsinasyon içermeyen**, gerçek verilere dayalı cevaplar sunar.

## ✨ Öne Çıkan Özellikler

| | |
|---|---|
| 💬 **Doğal Dil Sorgulama** | "Geçen aya göre en çok artan servis hangisi?" gibi soruları anlar, gerçek SQL sorgusuna çevirir |
| 📊 **Canlı Dashboard** | Toplam maliyet, trend grafikleri, servis/kategori dağılımı, resource group karşılaştırmaları |
| 🔮 **AI Maliyet Tahmini** | Geçmiş verilere dayanarak ay sonu maliyetini tahmin eder |
| 💡 **Akıllı Öneriler** | Düşük kullanım + yüksek maliyet sezgisiyle tasarruf fırsatlarını tespit eder |
| 🎯 **FinOps Sağlık Puanı** | 5 kural tabanlı kritere göre 0-100 arası deterministik bir skor |
| 🔔 **Otomatik Uyarılar** | Maliyet artışlarını ve bütçe eşiği aşımlarını e-posta + Microsoft Teams ile bildirir |
| 📄 **PDF Raporlama** | Tek tıkla, çok dilli (TR/EN), günlük/haftalık/aylık dönemsel rapor üretimi |
| 🔐 **Güvenli Kimlik Doğrulama** | E-posta doğrulamalı kayıt, rol tabanlı erişim (Yönetici/Finans/DevOps/Kullanıcı) |
| ⚡ **Gerçek Zamanlı Sohbet** | Yanıtlar, ChatGPT tarzı akan (streaming) bir arayüzle gelir |

## 🏗️ Mimari

┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Next.js 15 │─────▶│ FastAPI │─────▶│ PostgreSQL │
│ TypeScript │◀─────│ Python │◀─────│ │
│ (Frontend) │ │ (Backend) │ │ (Veritabanı) │
└─────────────────┘ └────────┬─────────┘ └─────────────────┘
│
┌──────────┴──────────┐
▼ ▼
┌──────────────────┐ ┌─────────────────────┐
│ Bulutistan LLM │ │ Azure Cost │
│ (SQL Agent) │ │ Management API │
└──────────────────┘ └─────────────────────┘

Kullanıcının sorusu, LLM tarafından **SQL'e çevrilir** → güvenlik doğrulamasından geçer → PostgreSQL'de çalıştırılır → **gerçek sonuç**, ikinci bir LLM çağrısıyla doğal dile dönüştürülür. Hiçbir sayı uydurulmaz.

## 🛠️ Teknoloji Yığını

**Backend:** Python · FastAPI · PostgreSQL · LangChain · Azure Identity SDK · ReportLab · Matplotlib · Pytest

**Frontend:** Next.js 15 · TypeScript · Tailwind CSS · Recharts

**Entegrasyonlar:** Azure Cost Management API · SMTP · Microsoft Teams Workflows

## 🚀 Kurulum

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

Uygulama, `http://localhost:3000` adresinde çalışmaya başlar.

## 🧪 Testler

```bash
cd backend
pytest test/ -v
```

## 📸 Ekran Görüntüleri

> *(Buraya Dashboard, Chat ve Rapor ekranlarından görseller eklenebilir.)*

## 📄 Lisans

Bu proje, bir staj kapsamında geliştirilmiştir.

---

<div align="center">

**Geliştirici:** Aleyna Erdoğan

</div>
EOF
