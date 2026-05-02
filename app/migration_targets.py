from __future__ import annotations

from sqlalchemy import Table

from app.ai_agent.models import ChatMessage
from app.auth.models import EmailOTP, User
from app.finance import models as finance_models


def _unique_tables(tables: list[Table]) -> list[Table]:
    seen: set[str] = set()
    result: list[Table] = []
    for table in tables:
        key = table.key
        if key in seen:
            continue
        seen.add(key)
        result.append(table)
    return result


def get_tables_for_scope(scope: str) -> list[Table]:
    normalized = (scope or "monolith").strip().lower()

    auth_tables = [
        User.__table__,
        EmailOTP.__table__,
    ]
    finance_tables = [
        finance_models.Category.__table__,
        finance_models.Tag.__table__,
        finance_models.Account.__table__,
        finance_models.Transaction.__table__,
        finance_models.Transfer.__table__,
        finance_models.transaction_tags,
        finance_models.Budget.__table__,
        finance_models.SavingsGoal.__table__,
        finance_models.Bill.__table__,
    ]
    planning_tables = [
        finance_models.Budget.__table__,
        finance_models.Goal.__table__,
    ]
    recurring_tables = [
        finance_models.Subscription.__table__,
        finance_models.Debt.__table__,
        finance_models.Reminder.__table__,
    ]
    ai_tables = [
        ChatMessage.__table__,
    ]

    by_scope = {
        "auth": auth_tables,
        "finance": finance_tables,
        "planning": planning_tables,
        "recurring": recurring_tables,
        "ai": ai_tables,
        "notifications": [],
        "monolith": auth_tables + finance_tables + planning_tables + recurring_tables + ai_tables,
    }

    return _unique_tables(by_scope.get(normalized, by_scope["monolith"]))

