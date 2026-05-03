from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _normalize_db_url(db_url: str) -> str:
    """
    Ensure a working SQLAlchemy driver is selected.

    - If the URL already specifies a driver (e.g. postgresql+psycopg2://), keep it.
    - If the URL is postgresql://, prefer psycopg2 when available; otherwise fall back to psycopg (v3).
    """

    if not db_url.startswith("postgresql://"):
        return db_url
    if db_url.startswith("postgresql+"):
        return db_url

    # Prefer psycopg2 if it can actually be imported (on Windows it may be installed but missing DLLs).
    try:
        import psycopg2  # noqa: F401

        return db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    except Exception:
        pass

    try:
        import psycopg  # noqa: F401

        return db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    except Exception:
        # Keep original URL so SQLAlchemy can raise a clear error message downstream.
        return db_url


engine = create_engine(_normalize_db_url(settings.db_url), future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema() -> None:
    """
    Minimal dev migration helper.

    This project currently uses `Base.metadata.create_all()` (no Alembic). That won't add new
    columns to existing tables. For local dev/test, we add missing columns with `ALTER TABLE`.
    """

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    statements: list[str] = []

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "first_name" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR")
    if "last_name" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR")
    if "username" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR")
    if "phone" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR")
    if "email_verified" not in user_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if "is_active" not in user_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if "created_at" not in user_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        )

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))

    if "transactions" in tables:
        tx_existing = {col["name"] for col in inspector.get_columns("transactions")}
        if "account_id" not in tx_existing:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id INTEGER"))
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions (account_id)")
                )
        if "ocr_confidence" not in tx_existing:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ocr_confidence FLOAT"))

    if "accounts" in tables:
        account_cols = {col["name"] for col in inspector.get_columns("accounts")}
        statements = []
        if "type" not in account_cols:
            statements.append("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'bank'")
        if "provider" not in account_cols:
            statements.append("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provider VARCHAR")
        if "last4" not in account_cols:
            statements.append("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last4 VARCHAR")
        if "note" not in account_cols:
            statements.append("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS note VARCHAR")
        if "color" not in account_cols:
            statements.append("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color VARCHAR NOT NULL DEFAULT '#ec4899'")

        if statements:
            with engine.begin() as conn:
                for stmt in statements:
                    conn.execute(text(stmt))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
