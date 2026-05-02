"""bootstrap service tables

Revision ID: 20260430_01
Revises:
Create Date: 2026-04-30
"""

from __future__ import annotations

from alembic import context, op
from sqlalchemy import text

from app.database import DB_SCHEMA
from app.migration_targets import get_tables_for_scope

# revision identifiers, used by Alembic.
revision = "20260430_01"
down_revision = None
branch_labels = None
depends_on = None


def _table_name(name: str) -> str:
    if DB_SCHEMA:
        return f'"{DB_SCHEMA}"."{name}"'
    return name


def _apply_compatibility_alters(scope: str) -> None:
    bind = op.get_bind()
    normalized = (scope or "").strip().lower()

    # Keep budgets compatible across finance/planning historical schemas.
    if normalized in {"finance", "planning", "monolith"}:
        budgets = _table_name("budgets")
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS category_id INTEGER"))
        bind.execute(text(f"ALTER TABLE {budgets} ALTER COLUMN category_id DROP NOT NULL"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS category_ids VARCHAR"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS name VARCHAR"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS cycle VARCHAR DEFAULT 'monthly'"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS start_date DATE"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS end_date DATE"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS threshold FLOAT DEFAULT 80.0"))
        bind.execute(text(f"ALTER TABLE {budgets} ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'"))

    # Keep recurring tables compatible with the canonical model.
    if normalized in {"recurring", "monolith"}:
        subscriptions = _table_name("subscriptions")
        debts = _table_name("debts")
        bind.execute(
            text(
                f"ALTER TABLE {subscriptions} "
                "ADD COLUMN IF NOT EXISTS frequency VARCHAR NOT NULL DEFAULT 'monthly'"
            )
        )
        bind.execute(
            text(
                f"ALTER TABLE {debts} "
                "ADD COLUMN IF NOT EXISTS frequency VARCHAR NOT NULL DEFAULT 'one_time'"
            )
        )


def upgrade() -> None:
    bind = op.get_bind()
    x_args = context.get_x_argument(as_dictionary=True)
    scope = (x_args.get("scope") or "monolith").strip().lower()

    for table in get_tables_for_scope(scope):
        table.create(bind=bind, checkfirst=True)

    _apply_compatibility_alters(scope)


def downgrade() -> None:
    bind = op.get_bind()
    x_args = context.get_x_argument(as_dictionary=True)
    scope = (x_args.get("scope") or "monolith").strip().lower()

    for table in reversed(get_tables_for_scope(scope)):
        table.drop(bind=bind, checkfirst=True)
