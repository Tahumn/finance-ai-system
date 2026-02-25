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
    if "users" not in inspector.get_table_names():
        return

    existing = {col["name"] for col in inspector.get_columns("users")}
    statements: list[str] = []

    if "first_name" not in existing:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR")
    if "last_name" not in existing:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR")
    if "phone" not in existing:
        statements.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR")
    if "email_verified" not in existing:
        statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if "is_active" not in existing:
        statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if "created_at" not in existing:
        statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
