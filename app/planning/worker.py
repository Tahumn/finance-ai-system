import logging
from typing import Dict, Any
from app.database import SessionLocal
from app.planning.models import Budget

logger = logging.getLogger(__name__)


def _parse_category_ids(value: str | None) -> set[int]:
    if not value:
        return set()
    parsed: set[int] = set()
    for raw in value.split(","):
        token = raw.strip()
        if not token:
            continue
        try:
            parsed.add(int(token))
        except ValueError:
            continue
    return parsed


async def handle_finance_event(message: Dict[str, Any]):
    event_type = message.get("event_type")

    if event_type not in {"transaction.created", "transaction.deleted"}:
        return

    if message.get("transaction_type") != "expense":
        return

    user_id = message.get("user_id")
    category_id = message.get("category_id")
    if user_id is None or category_id is None:
        return

    try:
        user_id = int(user_id)
        category_id = int(category_id)
    except (TypeError, ValueError):
        return

    logger.info(
        "Planning Service received %s for user=%s category=%s",
        event_type,
        user_id,
        category_id,
    )

    with SessionLocal() as db:
        budgets = db.query(Budget).filter(Budget.user_id == user_id).all()
        matched = [budget for budget in budgets if category_id in _parse_category_ids(budget.category_ids)]

        if not matched:
            logger.debug("No budget found for category %s of user %s.", category_id, user_id)
            return

        for budget in matched:
            logger.info(
                "Matched budget %s for user=%s with target amount=%s",
                budget.id,
                user_id,
                budget.amount,
            )
