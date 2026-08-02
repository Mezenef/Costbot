"""
app paketi — import edildiği an .env dosyasını otomatik yükler.
"""
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)