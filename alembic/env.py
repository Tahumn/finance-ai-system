from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import settings
from app.database import Base, _normalize_db_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _engine_connect_args() -> dict:
    schema = (settings.db_schema or "").strip()
    if not schema:
        return {}
    return {"options": f"-csearch_path={schema},public"}


def _schema_name() -> str | None:
    schema = (settings.db_schema or "").strip()
    return schema or None


def run_migrations_offline() -> None:
    url = _normalize_db_url(settings.db_url)
    schema = _schema_name()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=bool(schema),
        version_table_schema=schema,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        _normalize_db_url(settings.db_url),
        poolclass=pool.NullPool,
        future=True,
        connect_args=_engine_connect_args(),
    )
    schema = _schema_name()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=bool(schema),
            version_table_schema=schema,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

