from __future__ import annotations

from argparse import Namespace
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import settings
from app.database import _normalize_db_url


def run_migrations(scope: str) -> None:
    project_root = Path(__file__).resolve().parents[1]
    alembic_ini = project_root / "alembic.ini"
    alembic_dir = project_root / "alembic"

    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(alembic_dir))
    cfg.set_main_option("sqlalchemy.url", _normalize_db_url(settings.db_url))

    # Pass runtime scope into Alembic env/revisions via context.get_x_argument().
    cfg.cmd_opts = Namespace(x=[f"scope={scope}"], tag=None, raiseerr=True)

    command.upgrade(cfg, "head")

