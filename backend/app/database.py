"""
database.py
CostBot — PostgreSQL veritabanı kurulumu.

NOT: Bu dosya, SQLite'tan PostgreSQL'e geçiş için yazıldı. Kod
tabanının GERİ KALANI (sql_agent.py, dashboard.py, main.py, forecast.py,
report.py, scheduler.py), SQLite'ın 'conn.execute(sql, params).fetchall()'
kısayolunu kullanıyordu -- psycopg2 bunu doğrudan desteklemiyor. Bu
yüzden burada bir UYUMLULUK KATMANI (PGConnection/PGCursor) yazıldı:
'?' placeholder'ları otomatik '%s'e çevriliyor, execute() kısayolu
taklit ediliyor -- böylece DİĞER HİÇBİR DOSYAYA DOKUNMADAN geçiş
yapılabiliyor.
"""
import os
import csv
from pathlib import Path
import psycopg2
import psycopg2.extras

CSV_PATH = Path(__file__).parent.parent / "data" / "azure_cost_mock_data.csv"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS CloudCosts (
    id SERIAL PRIMARY KEY,
    UsageDate TEXT,
    SubscriptionId TEXT,
    SubscriptionName TEXT,
    ResourceGroup TEXT,
    ResourceId TEXT,
    ResourceName TEXT,
    ServiceName TEXT,
    MeterCategory TEXT,
    MeterName TEXT,
    ResourceLocation TEXT,
    ChargeType TEXT,
    Quantity REAL,
    UnitOfMeasure TEXT,
    PreTaxCost REAL,
    Currency TEXT
);

CREATE TABLE IF NOT EXISTS ReportHistory (
    ReportId SERIAL PRIMARY KEY,
    UserId INTEGER,
    GeneratedDate TEXT DEFAULT CURRENT_TIMESTAMP::TEXT,
    Period TEXT,
    Language TEXT
);

CREATE TABLE IF NOT EXISTS CostRecommendations (
    RecommendationId SERIAL PRIMARY KEY,
    UserId INTEGER,
    CreatedDate TEXT DEFAULT CURRENT_TIMESTAMP::TEXT,
    TargetService TEXT,
    TargetResourceName TEXT,
    RecommendationText TEXT,
    PotentialSavings REAL,
    Currency TEXT,
    Status TEXT DEFAULT 'Beklemede',
    ActionDate TEXT
);

CREATE TABLE IF NOT EXISTS ChatHistory (
    MessageId SERIAL PRIMARY KEY,
    UserId INTEGER,
    SessionId TEXT,
    Timestamp TEXT DEFAULT CURRENT_TIMESTAMP::TEXT,
    UserPrompt TEXT,
    GeneratedSQL TEXT,
    QueryResultJSON TEXT,
    BotResponseText TEXT,
    ExecutionTime REAL
);

CREATE TABLE IF NOT EXISTS Users (
    UserId SERIAL PRIMARY KEY,
    FullName TEXT NOT NULL,
    Email TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    PasswordSalt TEXT NOT NULL,
    IsVerified INTEGER DEFAULT 0,
    VerificationCode TEXT,
    VerificationExpiry TEXT,
    ResetCode TEXT,
    ResetExpiry TEXT,
    Role TEXT DEFAULT 'Kullanıcı',
    BudgetThreshold REAL,
    TeamsWebhookUrl TEXT,
    CreatedDate TEXT DEFAULT CURRENT_TIMESTAMP::TEXT
);

CREATE TABLE IF NOT EXISTS AlertHistory (
    AlertId SERIAL PRIMARY KEY,
    ServiceName TEXT,
    Period TEXT,
    ChangePct REAL,
    NotifiedDate TEXT DEFAULT CURRENT_TIMESTAMP::TEXT
);
"""

CLOUDCOSTS_COLUMNS = [
    "UsageDate", "SubscriptionId", "SubscriptionName", "ResourceGroup",
    "ResourceId", "ResourceName", "ServiceName", "MeterCategory",
    "MeterName", "ResourceLocation", "ChargeType", "Quantity",
    "UnitOfMeasure", "PreTaxCost", "Currency",
]


def _translate(sql: str) -> str:
    """SQLite'ın '?' placeholder'ını PostgreSQL'in '%s' formatına çevirir."""
    return sql.replace("?", "%s")


class PGCursor:
    def __init__(self, real_cursor):
        self._cur = real_cursor
        self.lastrowid = None

    def execute(self, sql, params=()):
        self._cur.execute(_translate(sql), params)
        return self

    def executemany(self, sql, batch):
        self._cur.executemany(_translate(sql), batch)
        return self

    def fetchall(self):
        return self._cur.fetchall()

    def fetchone(self):
        return self._cur.fetchone()


class PGConnection:
    """SQLite Connection'ın 'conn.execute(...)' kısayolunu taklit eder."""
    def __init__(self, real_conn):
        self._conn = real_conn

    def cursor(self):
        return PGCursor(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, sql, params=()):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def executescript(self, script):
        statements = [s.strip() for s in script.split(";") if s.strip()]
        cur = self._conn.cursor()
        for stmt in statements:
            cur.execute(stmt)
        self._conn.commit()

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_connection() -> PGConnection:
    real_conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "costbot"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    return PGConnection(real_conn)


def init_schema(conn: PGConnection) -> None:
    conn.executescript(SCHEMA_SQL)
    conn.executescript("""
        ALTER TABLE Users ADD COLUMN IF NOT EXISTS Role TEXT DEFAULT 'Kullanıcı';
        CREATE INDEX IF NOT EXISTS idx_covering_service_cost
            ON CloudCosts(ServiceName, PreTaxCost);
        CREATE INDEX IF NOT EXISTS idx_covering_date_cost
            ON CloudCosts(UsageDate, PreTaxCost);
        CREATE INDEX IF NOT EXISTS idx_cloudcosts_resourcename
            ON CloudCosts(ResourceName);
        CREATE INDEX IF NOT EXISTS idx_cloudcosts_subscription
            ON CloudCosts(SubscriptionName);
    """)
    conn.commit()


def load_csv(conn: PGConnection, csv_path: Path = CSV_PATH) -> dict:
    cur = conn.cursor()
    cur.execute("DELETE FROM CloudCosts")

    inserted, skipped = 0, []
    placeholders = ",".join(["%s"] * len(CLOUDCOSTS_COLUMNS))
    insert_sql = f"INSERT INTO CloudCosts ({','.join(CLOUDCOSTS_COLUMNS)}) VALUES ({placeholders})"

    BATCH_SIZE = 20_000
    batch = []

    def flush():
        nonlocal batch
        if batch:
            cur.executemany(insert_sql, batch)
            batch = []

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            try:
                values = []
                for col in CLOUDCOSTS_COLUMNS:
                    raw = (row.get(col) or "").strip()
                    if col in ("Quantity", "PreTaxCost"):
                        values.append(float(raw))
                    else:
                        if raw == "":
                            raise ValueError(f"'{col}' boş")
                        values.append(raw)
                batch.append(values)
                inserted += 1
                if len(batch) >= BATCH_SIZE:
                    flush()
            except (ValueError, TypeError) as e:
                skipped.append((i, str(e)))
    flush()

    conn.commit()
    return {"inserted": inserted, "skipped": len(skipped), "skipped_detail": skipped[:20]}


def load_from_azure(conn: PGConnection, rows: list, start_date: str = None, end_date: str = None) -> dict:
    cur = conn.cursor()
    if start_date and end_date:
        cur.execute("DELETE FROM CloudCosts WHERE UsageDate >= ? AND UsageDate <= ?", (start_date, end_date))
    else:
        cur.execute("DELETE FROM CloudCosts")

    placeholders = ",".join(["%s"] * len(CLOUDCOSTS_COLUMNS))
    insert_sql = f"INSERT INTO CloudCosts ({','.join(CLOUDCOSTS_COLUMNS)}) VALUES ({placeholders})"

    batch = [[row.get(col, "") for col in CLOUDCOSTS_COLUMNS] for row in rows]
    if batch:
        cur.executemany(insert_sql, batch)
    conn.commit()
    return {"inserted": len(batch), "skipped": 0, "skipped_detail": []}


def build_database(csv_path: Path = CSV_PATH) -> dict:
    conn = get_connection()
    init_schema(conn)
    stats = load_csv(conn, csv_path)
    conn.close()
    return stats


if __name__ == "__main__":
    stats = build_database()
    print(f"✅ PostgreSQL veritabanı kuruldu")
    print(f"   Yüklenen satır: {stats['inserted']}")
    print(f"   Atlanan (bozuk) satır: {stats['skipped']}")