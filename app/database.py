from __future__ import annotations

from sqlalchemy import MetaData, create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _normalize_db_url(db_url: str) -> str:
    if not db_url.startswith("postgresql://"):
        return db_url
    if db_url.startswith("postgresql+"):
        return db_url

    try:
        import psycopg2  # noqa: F401

        return db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    except Exception:
        pass

    try:
        import psycopg  # noqa: F401

        return db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    except Exception:
        return db_url


def _engine_connect_args() -> dict:
    schema = (settings.db_schema or "").strip()
    if not schema:
        return {}
    return {"options": f"-csearch_path={schema},public"}


DB_SCHEMA = (settings.db_schema or "").strip() or None

engine = create_engine(
    _normalize_db_url(settings.db_url),
    connect_args=_engine_connect_args(),
    future=True,
)

metadata = MetaData(schema=DB_SCHEMA) if DB_SCHEMA else MetaData()
Base = declarative_base(metadata=metadata)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _table_name(name: str) -> str:
    if DB_SCHEMA:
        return f'"{DB_SCHEMA}"."{name}"'
    return name


def ensure_schema() -> None:
    if DB_SCHEMA:
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))

    inspector = inspect(engine)
    tables = set(inspector.get_table_names(schema=DB_SCHEMA))
    if "users" not in tables:
        return

    statements: list[str] = []
    users = _table_name("users")

    user_columns = {col["name"] for col in inspector.get_columns("users", schema=DB_SCHEMA)}
    if "first_name" not in user_columns:
        statements.append(f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS first_name VARCHAR")
    if "last_name" not in user_columns:
        statements.append(f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS last_name VARCHAR")
    if "username" not in user_columns:
        statements.append(f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS username VARCHAR")
    if "phone" not in user_columns:
        statements.append(f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS phone VARCHAR")
    if "email_verified" not in user_columns:
        statements.append(
            f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if "is_active" not in user_columns:
        statements.append(
            f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if "created_at" not in user_columns:
        statements.append(
            f"ALTER TABLE {users} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        )

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON {users} (username)"))

    if "transactions" in tables:
        tx_existing = {col["name"] for col in inspector.get_columns("transactions", schema=DB_SCHEMA)}
        if "account_id" not in tx_existing:
            tx = _table_name("transactions")
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {tx} ADD COLUMN IF NOT EXISTS account_id INTEGER"))
                conn.execute(
                    text(
                        f"CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON {tx} (account_id)"
                    )
                )

    if "budgets" in tables:
        bg_existing = {col["name"] for col in inspector.get_columns("budgets", schema=DB_SCHEMA)}
        bg = _table_name("budgets")
        with engine.begin() as conn:
            if "name" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS name VARCHAR"))
            if "cycle" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS cycle VARCHAR DEFAULT 'monthly'"))
            if "start_date" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS start_date DATE"))
            if "end_date" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS end_date DATE"))
            if "threshold" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS threshold FLOAT DEFAULT 80.0"))
            if "status" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'"))
            if "category_ids" not in bg_existing:
                conn.execute(text(f"ALTER TABLE {bg} ADD COLUMN IF NOT EXISTS category_ids VARCHAR"))
                # Migrate category_id to category_ids
                if "category_id" in bg_existing:
                    conn.execute(text(f"UPDATE {bg} SET category_ids = CAST(category_id AS VARCHAR) WHERE category_ids IS NULL AND category_id IS NOT NULL"))

    if "accounts" in tables:
        account_cols = {col["name"] for col in inspector.get_columns("accounts", schema=DB_SCHEMA)}
        statements = []
        accounts = _table_name("accounts")
        if "type" not in account_cols:
            statements.append(f"ALTER TABLE {accounts} ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'bank'")
        if "provider" not in account_cols:
            statements.append(f"ALTER TABLE {accounts} ADD COLUMN IF NOT EXISTS provider VARCHAR")
        if "last4" not in account_cols:
            statements.append(f"ALTER TABLE {accounts} ADD COLUMN IF NOT EXISTS last4 VARCHAR")
        if "note" not in account_cols:
            statements.append(f"ALTER TABLE {accounts} ADD COLUMN IF NOT EXISTS note VARCHAR")
        if "color" not in account_cols:
            statements.append(f"ALTER TABLE {accounts} ADD COLUMN IF NOT EXISTS color VARCHAR NOT NULL DEFAULT '#ec4899'")

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
