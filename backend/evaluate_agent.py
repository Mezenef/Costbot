"""
evaluate_agent.py
CSV'den soru listesi okuyup, her birini CostBot'un /query endpoint'ine
gönderen, sonuçları başka bir CSV'ye yazan basit bir test/değerlendirme
aracı. Copilot Studio'nun "Agent Evaluation" özelliğinin küçük ölçekli,
CostBot'a özel bir karşılığı.

Kullanım:
    python evaluate_agent.py sorular.csv
"""
import sys
import csv
import time
import requests

API_URL = "http://localhost:8000"
USER_ID = 1  # Test edilecek kullanıcı ID'si
LANGUAGE = "tr"


def run_evaluation(input_csv: str, output_csv: str = "sonuclar.csv"):
    with open(input_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        questions = [row["soru"] for row in reader if row.get("soru", "").strip()]

    if not questions:
        print("CSV'de hiç soru bulunamadı. Dosyada 'soru' adlı bir kolon olmalı.")
        return

    print(f"{len(questions)} soru bulundu, test başlıyor...\n")

    results = []
    for i, question in enumerate(questions, 1):
        print(f"[{i}/{len(questions)}] Soruluyor: {question}")
        t0 = time.time()
        try:
            resp = requests.post(
                f"{API_URL}/query",
                json={
                    "question": question,
                    "session_id": f"eval-{i}",
                    "language": LANGUAGE,
                    "user_id": USER_ID,
                },
                timeout=60,
            )
            elapsed = round(time.time() - t0, 2)
            if resp.status_code == 200:
                data = resp.json()
                results.append({
                    "soru": question,
                    "durum": data.get("status", "?"),
                    "cevap": data.get("answer", ""),
                    "sql": data.get("sql", "") or "",
                    "sure_saniye": elapsed,
                    "hata": "",
                })
            else:
                results.append({
                    "soru": question, "durum": "http_error", "cevap": "",
                    "sql": "", "sure_saniye": elapsed, "hata": f"HTTP {resp.status_code}: {resp.text[:200]}",
                })
        except Exception as e:
            elapsed = round(time.time() - t0, 2)
            results.append({
                "soru": question, "durum": "exception", "cevap": "",
                "sql": "", "sure_saniye": elapsed, "hata": str(e),
            })

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["soru", "durum", "cevap", "sql", "sure_saniye", "hata"])
        writer.writeheader()
        writer.writerows(results)

    ok_count = sum(1 for r in results if r["durum"] == "ok")
    print(f"\nTamamlandı. {ok_count}/{len(results)} soru başarıyla cevaplandı.")
    print(f"Detaylı sonuçlar: {output_csv}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Kullanım: python evaluate_agent.py <sorular.csv>")
        sys.exit(1)
    input_path = sys.argv[1]
    # Çıktı dosyasını girdiye göre otomatik adlandır:
    # sorular.csv -> sonuclar.csv, sorular2.csv -> sonuclar2.csv
    output_path = input_path.replace("sorular", "sonuclar")
    if output_path == input_path:  # "sorular" kelimesi geçmiyorsa, yine de ayrı bir isim ver
        output_path = "sonuclar_" + input_path
    run_evaluation(input_path, output_path)