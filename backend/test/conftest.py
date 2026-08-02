"""
conftest.py
Testlerin ortak altyapısı -- gerçek dosya veritabanına HİÇ dokunmadan,
bellek içi (in-memory) bir SQLite bağlantısı sağlar. Şema, database.py'nin
GERÇEK SCHEMA_SQL sabitinden kuruluyor -- yani şema değiştikçe testler
otomatik güncel kalır, elle senkronize etmeye gerek yok.
"""
import sys
from pathlib import Path
import sqlite3
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SCHEMA_SQL


@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    yield conn
    conn.close()