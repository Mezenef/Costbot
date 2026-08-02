"""
graph_mail_setup.py
BİR KERELİK kurulum betiği -- Microsoft Graph API üzerinden e-posta
gönderebilmek için, Delegated Mail.Send izniyle bir kere giriş yapıp
(cihaz kodu akışı -- tarayıcıda kod girme), sonrasında SESSİZCE
(kullanıcıyı tekrar rahatsız etmeden) token yenileyebilecek bir
"refresh token" önbelleği oluşturur.

ÇALIŞTIRMA: python -m app.graph_mail_setup
(backend/ klasöründen, venv aktifken)

Bu SADECE BİR KERE çalıştırılır. Sonrasında graph_mail_service.py,
burada oluşturulan önbellek dosyasını (data/graph_token_cache.bin)
kullanarak sessizce token yeniler -- her mail gönderiminde tekrar
giriş yapman gerekmez.
"""
import os
import sys
from pathlib import Path
import msal
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("GRAPH_CLIENT_ID")
TENANT_ID = os.getenv("GRAPH_TENANT_ID")
CACHE_PATH = Path(__file__).parent.parent / "data" / "graph_token_cache.bin"
SCOPES = ["Mail.Send"]


def main():
    if not CLIENT_ID or not TENANT_ID:
        print("HATA: .env dosyasında GRAPH_CLIENT_ID / GRAPH_TENANT_ID tanımlı değil.")
        sys.exit(1)

    cache = msal.SerializableTokenCache()
    if CACHE_PATH.exists():
        cache.deserialize(CACHE_PATH.read_text())

    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        token_cache=cache,
    )

    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        print("HATA: cihaz kodu akışı başlatılamadı:", flow.get("error_description"))
        sys.exit(1)

    print(flow["message"])  # "Şu adrese git, şu kodu gir: XXXXXXX" türünden bir mesaj
    print()
    print("Tarayıcıda yukarıdaki adrese gidip kodu girdikten ve giriş yaptıktan sonra")
    print("buraya otomatik olarak dönecek...")

    result = app.acquire_token_by_device_flow(flow)

    if "access_token" in result:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(cache.serialize())
        print()
        print(f"✅ Başarılı! Token önbelleği kaydedildi: {CACHE_PATH}")
        print("Artık graph_mail_service.py, bu önbelleği kullanarak sessizce mail gönderebilir.")
    else:
        print("HATA:", result.get("error"), "-", result.get("error_description"))
        sys.exit(1)


if __name__ == "__main__":
    main()