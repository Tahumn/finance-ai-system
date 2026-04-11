from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(settings.db_url, future=True)
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

    if not statements:
        # Ensure index for username if column already exists.
        with engine.begin() as conn:
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
            )
    else:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))

    if "transactions" in tables:
        tx_existing = {col["name"] for col in inspector.get_columns("transactions")}
        tx_statements: list[str] = []
        if "account_id" not in tx_existing:
            tx_statements.append("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id INTEGER")
        if tx_statements:
            with engine.begin() as conn:
                for stmt in tx_statements:
                    conn.execute(text(stmt))
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions (account_id)")
                )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
