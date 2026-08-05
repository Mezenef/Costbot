# -*- coding: utf-8 -*-
'''
evaluate_context_agent.py
Bağlamsal (çok adımlı) soru senaryolarını otomatik test eder.
Her senaryo, bir soru ZİNCİRİ (liste) -- her adımda önceki soru+cevap
çiftleri, chat/page.tsx'teki buildConversationContext() ile AYNI
mantıkla (son 3 çift) biriktirilip previous_answer olarak gönderilir.

Kullanım: python evaluate_context_agent.py
Çıktı: context_test_sonuclari.txt
'''
import sys
sys.path.insert(0, ".")
from app import sql_agent

# Her senaryo bir liste -- soruları sırayla, gerçek bir sohbet gibi sorar.
SCENARIOS = [
    {
        "name": "Dolaylı işaret ifadesi (bugün düzeltilen)",
        "questions": ["Kaç vm çalışıyor?", "ürettiği maliyet nedir?"],
    },
    {
        "name": "Net onay ifadesi",
        "questions": ["Maliyetleri nasıl azaltabilirim?", "evet"],
    },
    {
        "name": "Eksik koşullu takip sorusu",
        "questions": ["Hangi kaynaklar hiç kullanılmadı?", "bunlardan Storage ile ilgili olanlar hangileri"],
    },
    {
        "name": "Boş sonuç sonrası takip sorusu",
        "questions": ["Storage ile ilgili sıfır maliyetli VPN Gateway var mı?", "en pahalısı hangisi"],
    },
    {
        "name": "Dolaylı işaret - farklı servis",
        "questions": ["En yüksek maliyetli 3 servis nedir?", "bunların toplamı ne kadar"],
    },
    {
        "name": "Zincir - 3 adımlı dolaylı referans",
        "questions": ["Kaç resource group var?", "en pahalısı hangisi", "onun maliyeti geçen aya göre nasıl değişti"],
    },
    {
        "name": "Kısa onay - farklı formda",
        "questions": ["Azure SQL Database maliyetini nasıl düşürebilirim?", "tabii, göster"],
    },
    {
        "name": "Belirsiz zamir - 'bunu'",
        "questions": ["En çok maliyet artışı gösteren servis hangisi?", "bunu detaylandırır mısın"],
    },
]


def build_context(history, max_pairs=3):
    relevant = [h for h in history if h[1].strip()]
    recent = relevant[-max_pairs * 2:]
    return "\n\n".join(f"{'Kullanıcı' if i % 2 == 0 else 'Asistan'}: {text}" for i, (role, text) in enumerate(recent))


def run_scenario(scenario, language="tr", user_id=1):
    history = []
    results = []
    for i, question in enumerate(scenario["questions"]):
        previous_answer = build_context(history) if history else None
        result = sql_agent.ask(question, session_id="context_test", language=language, user_id=user_id, previous_answer=previous_answer)
        results.append({
            "step": i + 1,
            "question": question,
            "sql": result.sql,
            "answer": result.answer[:300],
            "status": result.status,
        })
        history.append(("user", question))
        history.append(("assistant", result.answer))
    return results


def main():
    with open("context_test_sonuclari.txt", "w", encoding="utf-8") as f:
        for scenario in SCENARIOS:
            f.write(f"{'='*70}\n")
            f.write(f"SENARYO: {scenario['name']}\n")
            f.write(f"{'='*70}\n")
            print(f"Çalıştırılıyor: {scenario['name']}...")
            try:
                results = run_scenario(scenario)
                for r in results:
                    f.write(f"\n[Adım {r['step']}] Soru: {r['question']}\n")
                    f.write(f"  SQL: {r['sql']}\n")
                    f.write(f"  Durum: {r['status']}\n")
                    f.write(f"  Cevap: {r['answer']}\n")
            except Exception as e:
                f.write(f"\nHATA: {e}\n")
            f.write("\n\n")
    print("Bitti. Sonuçlar: context_test_sonuclari.txt")


if __name__ == "__main__":
    main()
