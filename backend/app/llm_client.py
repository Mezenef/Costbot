"""
llm_client.py
Bulutistan LLMaaS istemcisi.

NOT (KVKK / mimari): Bulutistan, DoD raporunda "yerli LLMaaS altyapısı"
olarak tanımlanıyor. Çoğu yerli LLMaaS sağlayıcısı OpenAI-uyumlu
(chat/completions) bir arayüz sunar; bu yüzden istemci burada
`langchain_openai.ChatOpenAI` üzerinden, yalnızca base_url ve api_key
değiştirilerek kuruldu. Bulutistan'ın gerçek endpoint şeması farklıysa
(ör. özel auth header'ı), yalnızca bu dosya değişir — agent/prompt
katmanına dokunulmaz.

Kullanım:
    export BULUTISTAN_API_KEY=...
    export BULUTISTAN_BASE_URL=https://api.bulutistan.com/v1   # örnek
    export BULUTISTAN_MODEL=bulutistan-llm-1                    # örnek
"""
import os
from langchain_openai import ChatOpenAI


class LLMNotConfiguredError(RuntimeError):
    """Bulutistan API anahtarı/endpoint'i tanımlı değilse fırlatılır."""


def get_llm(temperature: float = 0.0) -> ChatOpenAI:
    api_key = os.getenv("BULUTISTAN_API_KEY")
    base_url = os.getenv("BULUTISTAN_BASE_URL")
    model = os.getenv("BULUTISTAN_MODEL", "bulutistan-llm-1")

    if not api_key or not base_url:
        raise LLMNotConfiguredError(
            "BULUTISTAN_API_KEY / BULUTISTAN_BASE_URL tanımlı değil. "
            ".env dosyasını doldurup tekrar deneyin (.env.example örnek alır)."
        )

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
        max_retries=2,
        timeout=30,
    )
