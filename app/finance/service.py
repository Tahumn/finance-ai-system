from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload, joinedload

from app.core.auth_context import RequestUser
from app.finance import schemas
from app.finance.models import Account, Bill, Budget, Category, SavingsGoal, Tag, Transaction
from app.realtime import emit_finance_update
from app.core.kafka import producer_manager

DEFAULT_INCOME_CATEGORIES = ["Lương", "Freelance", "Đầu tư", "Thưởng", "Hoàn tiền", "Thu nhập khác"]
DEFAULT_EXPENSE_CATEGORIES = [
    "Ăn uống",
    "Di chuyển",
    "Mua sắm",
    "Hóa đơn",
    "Giải trí",
    "Sức khỏe",
    "Nhà cửa",
    "Giáo dục",
    "Du lịch",
    "Công nghệ",
]
DEFAULT_BUDGET_TARGETS = {
    "Ăn uống": 6_000_000,
    "Di chuyển": 4_000_000,
    "Giải trí": 2_000_000,
    "Nhà cửa": 3_000_000,
    "Mua sắm": 3_500_000,
}
DEFAULT_TAGS = [("Tiền mặt", "#22c55e"), ("Ngân hàng", "#3b82f6"), ("Ví điện tử", "#a855f7")]


def create_category(db: Session, current_user: RequestUser, payload: schemas.CategoryCreate) -> Category:
    category_name = payload.name.strip()
    if not category_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required")

    exists = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.name == category_name)
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists")

    db_category = Category(name=category_name, user_id=current_user.id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    emit_finance_update("categories", current_user.id, db_category.id)
    return db_category


def list_categories(db: Session, current_user: RequestUser) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .order_by(Category.name.asc())
        .all()
    )


def update_category(
    db: Session, current_user: RequestUser, category_id: int, payload: schemas.CategoryUpdate
) -> Category:
    db_category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not db_category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required")
        exists = (
            db.query(Category)
            .filter(Category.user_id == current_user.id, Category.name == name, Category.id != category_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists")
        db_category.name = name

    db.commit()
    db.refresh(db_category)
    emit_finance_update("categories", current_user.id, db_category.id)
    return db_category


def delete_category(db: Session, current_user: RequestUser, category_id: int) -> None:
    db_category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not db_category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    # Remove dependent budgets first, then detach from transactions to avoid FK violations.
    db.query(Budget).filter(Budget.user_id == current_user.id, Budget.category_id == category_id).delete()
    db.query(Transaction).filter(Transaction.user_id == current_user.id, Transaction.category_id == category_id).update(
        {"category_id": None}, synchronize_session=False
    )
    db.delete(db_category)
    db.commit()
    emit_finance_update("categories", current_user.id, category_id)


def _validate_category_ownership(db: Session, current_user: RequestUser, category_id: int | None) -> None:
    if category_id is None:
        return
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


def _validate_account_ownership(db: Session, current_user: RequestUser, account_id: int | None) -> None:
    if account_id is None:
        return
    account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")


def list_accounts(db: Session, current_user: RequestUser) -> list[Account]:
    return (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.id.desc())
        .all()
    )


def create_account(db: Session, current_user: RequestUser, payload: schemas.AccountCreate) -> Account:
    name = payload.name.strip()
    exists = db.query(Account).filter(Account.user_id == current_user.id, Account.name == name).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account already exists")

    last4 = (payload.last4 or "").strip()
    if last4:
        last4 = last4[-4:]

    item = Account(
        user_id=current_user.id,
        name=name,
        type=payload.type,
        provider=(payload.provider or "").strip() or None,
        last4=last4 or None,
        balance=float(payload.balance or 0.0),
        note=(payload.note or "").strip() or None,
        color=payload.color or "#ec4899",
        currency=payload.currency or "VND",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    emit_finance_update("accounts", current_user.id, item.id)
    return item


def update_account(db: Session, current_user: RequestUser, account_id: int, payload: schemas.AccountUpdate) -> Account:
    item = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account name is required")
        exists = (
            db.query(Account)
            .filter(Account.user_id == current_user.id, Account.name == name, Account.id != account_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account already exists")
        item.name = name

    if "type" in data and data.get("type") is not None:
        item.type = data["type"]
    if "provider" in data:
        item.provider = (data.get("provider") or "").strip() or None
    if "last4" in data:
        last4 = (data.get("last4") or "").strip()
        item.last4 = last4[-4:] if last4 else None
    if "balance" in data and data.get("balance") is not None:
        item.balance = float(data["balance"] or 0.0)
    if "note" in data:
        item.note = (data.get("note") or "").strip() or None
    if "color" in data and data.get("color"):
        item.color = data["color"]
    if "currency" in data and data.get("currency"):
        item.currency = data["currency"]

    db.commit()
    db.refresh(item)
    emit_finance_update("accounts", current_user.id, item.id)
    return item


def delete_account(db: Session, current_user: RequestUser, account_id: int) -> None:
    item = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db.query(Transaction).filter(Transaction.user_id == current_user.id, Transaction.account_id == account_id).update(
        {"account_id": None}, synchronize_session=False
    )
    db.delete(item)
    db.commit()
    emit_finance_update("accounts", current_user.id, account_id)


def _load_tags(db: Session, current_user: RequestUser, tag_ids: list[int] | None) -> list[Tag]:
    if not tag_ids:
        return []

    unique_ids = sorted({int(tag_id) for tag_id in tag_ids})
    tags = (
        db.query(Tag)
        .filter(Tag.user_id == current_user.id, Tag.id.in_(unique_ids))
        .all()
    )
    if len(tags) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return tags


def create_tag(db: Session, current_user: RequestUser, payload: schemas.TagCreate) -> Tag:
    tag_name = payload.name.strip()
    if not tag_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag name is required")

    exists = db.query(Tag).filter(Tag.user_id == current_user.id, Tag.name == tag_name).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag already exists")

    db_tag = Tag(name=tag_name, color=payload.color or "#1565c0", user_id=current_user.id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    emit_finance_update("tags", current_user.id, db_tag.id)
    return db_tag


def list_tags(db: Session, current_user: RequestUser) -> list[Tag]:
    return (
        db.query(Tag)
        .filter(Tag.user_id == current_user.id)
        .order_by(Tag.name.asc())
        .all()
    )


def update_tag(db: Session, current_user: RequestUser, tag_id: int, payload: schemas.TagUpdate) -> Tag:
    db_tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if not db_tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag name is required")
        exists = (
            db.query(Tag)
            .filter(Tag.user_id == current_user.id, Tag.name == name, Tag.id != tag_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag already exists")
        data["name"] = name

    for key, value in data.items():
        setattr(db_tag, key, value)

    db.commit()
    db.refresh(db_tag)
    emit_finance_update("tags", current_user.id, db_tag.id)
    return db_tag


def delete_tag(db: Session, current_user: RequestUser, tag_id: int) -> None:
    db_tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if not db_tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    db.delete(db_tag)
    db.commit()
    emit_finance_update("tags", current_user.id, tag_id)


def _adjust_account_balance(db: Session, account_id: int | None, amount: float, tx_type: str, reverse: bool = False) -> None:
    if account_id is None:
        return
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return

    # If reverse is True, we are undoing a transaction (e.g. deleting or before updating)
    factor = -1 if reverse else 1
    
    if tx_type == "income":
        account.balance += (amount * factor)
    else:
        account.balance -= (amount * factor)
    
    db.add(account)
    db.flush()


def create_transaction(db: Session, current_user: RequestUser, payload: schemas.TransactionCreate) -> Transaction:
    _validate_category_ownership(db, current_user, payload.category_id)
    _validate_account_ownership(db, current_user, payload.account_id)
    tags = _load_tags(db, current_user, payload.tag_ids)

    db_tx = Transaction(
        user_id=current_user.id,
        description=payload.description.strip(),
        amount=payload.amount,
        transaction_type=payload.transaction_type,
        category_id=payload.category_id,
        account_id=payload.account_id,
        date=payload.date or date.today(),
        ocr_confidence=payload.ocr_confidence,
        notes=payload.notes,
        image_path=payload.image_path,
    )
    if tags:
        db_tx.tags = tags

    db.add(db_tx)
    _adjust_account_balance(db, db_tx.account_id, db_tx.amount, db_tx.transaction_type)
    db.commit()
    db.refresh(db_tx)
    emit_finance_update("transactions", current_user.id, db_tx.id)

    producer_manager.sync_send(
        "finance.transactions",
        value={
            "event_type": "transaction.created",
            "transaction_id": db_tx.id,
            "user_id": current_user.id,
            "category_id": db_tx.category_id,
            "amount": float(db_tx.amount),
            "transaction_type": db_tx.transaction_type,
            "date": db_tx.date.isoformat(),
        }
    )

    if db_tx.account_id:
        emit_finance_update("accounts", current_user.id, db_tx.account_id)
    return db_tx


def list_transactions(
    db: Session,
    current_user: RequestUser,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: int | None = None,
    account_id: int | None = None,
    transaction_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[list[Transaction], int]:
    query = (
        db.query(Transaction)
        .options(selectinload(Transaction.tags), joinedload(Transaction.category))
        .filter(Transaction.user_id == current_user.id)
    )

    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)

    total = query.count()
    items = (
        query.order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def update_transaction(
    db: Session,
    current_user: RequestUser,
    transaction_id: int,
    payload: schemas.TransactionUpdate,
) -> Transaction:
    db_tx = (
        db.query(Transaction)
        .options(selectinload(Transaction.tags))
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not db_tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        _validate_category_ownership(db, current_user, data["category_id"])
    if "account_id" in data:
        _validate_account_ownership(db, current_user, data["account_id"])
    if "description" in data and not (data.get("description") or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Description is required")
    if "tag_ids" in data:
        db_tx.tags = _load_tags(db, current_user, data["tag_ids"])
        data.pop("tag_ids", None)

    # Reverse old balance
    _adjust_account_balance(db, db_tx.account_id, db_tx.amount, db_tx.transaction_type, reverse=True)

    for key, value in data.items():
        if key == "description" and isinstance(value, str):
            setattr(db_tx, key, value.strip())
        else:
            setattr(db_tx, key, value)

    db.flush()
    # Apply new balance
    _adjust_account_balance(db, db_tx.account_id, db_tx.amount, db_tx.transaction_type)

    db.commit()
    db.refresh(db_tx)
    emit_finance_update("transactions", current_user.id, db_tx.id)
    if db_tx.account_id:
        emit_finance_update("accounts", current_user.id, db_tx.account_id)
    return db_tx


def delete_transaction(db: Session, current_user: RequestUser, transaction_id: int) -> None:
    db_tx = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id).first()
    if not db_tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    
    # Reverse balance before delete
    _adjust_account_balance(db, db_tx.account_id, db_tx.amount, db_tx.transaction_type, reverse=True)
    account_id = db_tx.account_id

    db.delete(db_tx)
    db.commit()
    emit_finance_update("transactions", current_user.id, transaction_id)

    producer_manager.sync_send(
        "finance.transactions",
        value={
            "event_type": "transaction.deleted",
            "transaction_id": transaction_id,
            "user_id": current_user.id,
            "category_id": db_tx.category_id,
            "amount": float(db_tx.amount),
            "transaction_type": db_tx.transaction_type,
        }
    )

    if account_id:
        emit_finance_update("accounts", current_user.id, account_id)


def _base_query(db: Session, current_user: RequestUser, start_date: date | None, end_date: date | None):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    return query


def get_total_balance(db: Session, user_id: int) -> float:
    account_total = (
        db.query(func.coalesce(func.sum(Account.opening_balance), 0.0))
        .filter(Account.user_id == user_id)
        .scalar()
    )
    # Transactions without account_id do not mutate any account balance.
    # Include them here so summary balance always matches all recorded transactions.
    unassigned_income = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(
            Transaction.user_id == user_id,
            Transaction.account_id.is_(None),
            Transaction.transaction_type == "income",
        )
        .scalar()
    )
    unassigned_expense = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(
            Transaction.user_id == user_id,
            Transaction.account_id.is_(None),
            Transaction.transaction_type == "expense",
        )
        .scalar()
    )

    return float((account_total or 0.0) + (unassigned_income or 0.0) - (unassigned_expense or 0.0))


def get_summary(
    db: Session,
    current_user: RequestUser,
    start_date: date | None = None,
    end_date: date | None = None,
) -> schemas.FinanceSummary:
    base_query = _base_query(db, current_user, start_date, end_date)
    income = (
        base_query.filter(Transaction.transaction_type == "income")
        .with_entities(func.coalesce(func.sum(Transaction.amount), 0.0))
        .scalar()
    )
    expense = (
        base_query.filter(Transaction.transaction_type == "expense")
        .with_entities(func.coalesce(func.sum(Transaction.amount), 0.0))
        .scalar()
    )

    period_income = float(income or 0.0)
    period_expense = float(expense or 0.0)
    period_net = period_income - period_expense
    total_balance = get_total_balance(db, current_user.id)

    return schemas.FinanceSummary(
        total_balance=total_balance,
        period_total_income=period_income,
        period_total_expense=period_expense,
        period_net_flow=period_net,
        total_income=period_income,
        total_expense=period_expense,
        balance=total_balance,
    )


def get_category_breakdown(
    db: Session,
    current_user: RequestUser,
    start_date: date | None = None,
    end_date: date | None = None,
    transaction_type: str = "expense",
) -> list[schemas.CategoryBreakdown]:
    query = _base_query(db, current_user, start_date, end_date).filter(
        Transaction.transaction_type == transaction_type
    )

    rows = (
        query.with_entities(Transaction.category_id, func.sum(Transaction.amount))
        .group_by(Transaction.category_id)
        .all()
    )
    if not rows:
        return []

    category_ids = [row[0] for row in rows if row[0] is not None]
    category_map = {}
    if category_ids:
        category_items = (
            db.query(Category)
            .filter(Category.id.in_(category_ids), Category.user_id == current_user.id)
            .all()
        )
        category_map = {item.id: item.name for item in category_items}

    breakdown = []
    for category_id, spent in rows:
        label = category_map.get(category_id, "Uncategorized")
        breakdown.append(schemas.CategoryBreakdown(category=label, spent=float(spent or 0.0)))
    return breakdown


def get_chart_data(
    db: Session,
    current_user: RequestUser,
    limit_months: int = 6,
) -> schemas.GroupedChartData:
    if limit_months <= 0:
        limit_months = 6

    rows = (
        db.query(
            func.to_char(Transaction.date, "YYYY-MM").label("month"),
            Transaction.transaction_type,
            func.sum(Transaction.amount),
        )
        .filter(Transaction.user_id == current_user.id)
        .group_by("month", Transaction.transaction_type)
        .order_by("month")
        .all()
    )

    buckets: Dict[str, Dict[str, float]] = {}
    for month, t_type, amount in rows:
        if month not in buckets:
            buckets[month] = {"income": 0.0, "expense": 0.0}
        if t_type in ("income", "expense"):
            buckets[month][t_type] = float(amount or 0.0)

    sorted_months = sorted(buckets.keys())[-limit_months:]
    series = [
        schemas.ChartPoint(
            month=month,
            income=buckets[month]["income"],
            expense=buckets[month]["expense"],
        )
        for month in sorted_months
    ]
    return schemas.GroupedChartData(series=series)


def get_reports_overview(
    db: Session,
    current_user: RequestUser,
    start_date: date | None = None,
    end_date: date | None = None,
) -> schemas.ReportsOverview:
    base_query = (
        _base_query(db, current_user, start_date, end_date)
        .options(selectinload(Transaction.tags))
    )
    txs = base_query.order_by(Transaction.date.asc(), Transaction.id.asc()).all()
    if not txs:
        goals = (
            db.query(SavingsGoal)
            .filter(SavingsGoal.user_id == current_user.id)
            .order_by(SavingsGoal.id.asc())
            .all()
        )
        return schemas.ReportsOverview(
            daily_series=[],
            monthly_series=[],
            category_spending=[],
            payment_breakdown=[],
            weekday_heatmap=[],
            top_expenses=[],
            goals=[
                schemas.ReportGoalProgress(
                    name=item.name,
                    target_amount=float(item.target_amount or 0.0),
                    saved_amount=float(item.saved_amount or 0.0),
                    progress=_goal_progress(item.saved_amount, item.target_amount),
                )
                for item in goals
            ],
        )

    category_ids = {item.category_id for item in txs if item.category_id}
    category_map = {}
    if category_ids:
        categories = (
            db.query(Category)
            .filter(Category.user_id == current_user.id, Category.id.in_(category_ids))
            .all()
        )
        category_map = {item.id: item.name for item in categories}

    min_date = txs[0].date
    max_date = txs[-1].date
    daily_start = max(min_date, max_date - timedelta(days=29))
    daily_bucket: Dict[str, Dict[str, float]] = {}
    monthly_bucket: Dict[str, Dict[str, float]] = {}
    category_spending = defaultdict(float)
    payment_spending = defaultdict(float)
    heatmap_spending = defaultdict(float)
    expense_rows = []

    for tx in txs:
        amount = float(tx.amount or 0.0)
        tx_type = tx.transaction_type if tx.transaction_type in ("income", "expense") else "expense"
        if tx.date >= daily_start:
            daily_key = tx.date.isoformat()
            if daily_key not in daily_bucket:
                daily_bucket[daily_key] = {"income": 0.0, "expense": 0.0}
            daily_bucket[daily_key][tx_type] += amount

        month_key = tx.date.strftime("%Y-%m")
        if month_key not in monthly_bucket:
            monthly_bucket[month_key] = {"income": 0.0, "expense": 0.0}
        monthly_bucket[month_key][tx_type] += amount

        if tx_type == "expense":
            cat_label = category_map.get(tx.category_id, "Khác")
            category_spending[cat_label] += amount
            week_index = min(4, (tx.date.day - 1) // 7)
            heatmap_spending[(week_index, tx.date.weekday())] += amount
            expense_rows.append(tx)
            source = "Khác"
            if tx.tags:
                source = tx.tags[0].name
            payment_spending[source] += amount

    daily_keys = []
    cursor = daily_start
    while cursor <= max_date:
        daily_keys.append(cursor.isoformat())
        cursor += timedelta(days=1)

    daily_series = [
        schemas.ReportSeriesPoint(
            label=key[5:],
            income=daily_bucket.get(key, {}).get("income", 0.0),
            expense=daily_bucket.get(key, {}).get("expense", 0.0),
        )
        for key in daily_keys
    ]

    monthly_keys = sorted(monthly_bucket.keys())[-12:]
    monthly_series = [
        schemas.ReportSeriesPoint(
            label=key,
            income=monthly_bucket[key]["income"],
            expense=monthly_bucket[key]["expense"],
        )
        for key in monthly_keys
    ]

    category_total = sum(category_spending.values()) or 1.0
    category_series = [
        schemas.ReportCategoryPoint(
            category=name,
            amount=amount,
            share=amount / category_total,
        )
        for name, amount in sorted(category_spending.items(), key=lambda item: item[1], reverse=True)
    ][:8]

    payment_total = sum(payment_spending.values()) or 1.0
    payment_series = [
        schemas.ReportPaymentPoint(
            source=name,
            amount=amount,
            share=amount / payment_total,
        )
        for name, amount in sorted(payment_spending.items(), key=lambda item: item[1], reverse=True)
    ]

    heatmap_series = [
        schemas.ReportHeatmapCell(week_index=week_index, week_day=week_day, total=total)
        for (week_index, week_day), total in sorted(heatmap_spending.items(), key=lambda item: item[0])
    ]

    top_expenses = sorted(expense_rows, key=lambda row: float(row.amount or 0.0), reverse=True)[:8]
    top_expense_rows = [
        schemas.ReportTopTransaction(
            id=item.id,
            description=item.description,
            category=category_map.get(item.category_id, "Khác"),
            amount=float(item.amount or 0.0),
            date=item.date,
        )
        for item in top_expenses
    ]

    goals = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.id.asc())
        .all()
    )
    goal_progress = []
    for item in goals:
        target = float(item.target_amount or 0.0)
        saved = float(item.saved_amount or 0.0)
        progress = _goal_progress(saved, target)
        goal_progress.append(
            schemas.ReportGoalProgress(
                name=item.name,
                target_amount=target,
                saved_amount=saved,
                progress=progress,
            )
        )

    return schemas.ReportsOverview(
        daily_series=daily_series,
        monthly_series=monthly_series,
        category_spending=category_series,
        payment_breakdown=payment_series,
        weekday_heatmap=heatmap_series,
        top_expenses=top_expense_rows,
        goals=goal_progress,
    )


def _budget_status(progress: float) -> str:
    if progress >= 100:
        return "exceeded"
    if progress >= 80:
        return "warning"
    return "normal"


def list_budgets(
    db: Session,
    current_user: RequestUser,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[schemas.BudgetRead]:
    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .order_by(Budget.id.desc())
        .all()
    )
    if not budgets:
        return []

    category_ids = [item.category_id for item in budgets]
    categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.id.in_(category_ids))
        .all()
    )
    category_map = {item.id: item.name for item in categories}

    tx_query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == "expense",
        Transaction.category_id.in_(category_ids),
    )
    if start_date:
        tx_query = tx_query.filter(Transaction.date >= start_date)
    if end_date:
        tx_query = tx_query.filter(Transaction.date <= end_date)

    spent_rows = (
        tx_query.with_entities(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0.0),
        )
        .group_by(Transaction.category_id)
        .all()
    )
    spent_map = {row[0]: float(row[1] or 0.0) for row in spent_rows}

    result: list[schemas.BudgetRead] = []
    for item in budgets:
        spent = spent_map.get(item.category_id, 0.0)
        amount = float(item.amount or 0.0)
        remaining = amount - spent
        progress = (spent / amount * 100) if amount > 0 else 0.0
        result.append(
            schemas.BudgetRead(
                id=item.id,
                user_id=item.user_id,
                category_id=item.category_id,
                category=category_map.get(item.category_id, "Uncategorized"),
                amount=amount,
                spent=spent,
                remaining=remaining,
                progress=progress,
                status=_budget_status(progress),
            )
        )
    return result


def create_budget(db: Session, current_user: RequestUser, payload: schemas.BudgetCreate) -> schemas.BudgetRead:
    category = (
        db.query(Category)
        .filter(Category.id == payload.category_id, Category.user_id == current_user.id)
        .first()
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    exists = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id, Budget.category_id == payload.category_id)
        .first()
    )
    if exists:
        exists.amount = payload.amount
        db.commit()
        db.refresh(exists)
        emit_finance_update("budgets", current_user.id, exists.id)
        return schemas.BudgetRead(
            id=exists.id,
            user_id=exists.user_id,
            category_id=exists.category_id,
            category=category.name,
            amount=float(exists.amount or 0.0),
            spent=0.0,
            remaining=float(exists.amount or 0.0),
            progress=0.0,
            status="normal",
        )

    budget = Budget(user_id=current_user.id, category_id=payload.category_id, amount=payload.amount)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    emit_finance_update("budgets", current_user.id, budget.id)

    return schemas.BudgetRead(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        category=category.name,
        amount=float(budget.amount or 0.0),
        spent=0.0,
        remaining=float(budget.amount or 0.0),
        progress=0.0,
        status="normal",
    )


def update_budget(
    db: Session,
    current_user: RequestUser,
    budget_id: int,
    payload: schemas.BudgetUpdate,
) -> schemas.BudgetRead:
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    emit_finance_update("budgets", current_user.id, budget.id)

    category = (
        db.query(Category)
        .filter(Category.id == budget.category_id, Category.user_id == current_user.id)
        .first()
    )
    return schemas.BudgetRead(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        category=category.name if category else "Uncategorized",
        amount=float(budget.amount or 0.0),
        spent=0.0,
        remaining=float(budget.amount or 0.0),
        progress=0.0,
        status="normal",
    )


def delete_budget(db: Session, current_user: RequestUser, budget_id: int) -> None:
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    db.delete(budget)
    db.commit()
    emit_finance_update("budgets", current_user.id, budget_id)


def _goal_progress(saved_amount: float, target_amount: float) -> float:
    target = float(target_amount or 0.0)
    if target <= 0:
        return 0.0
    return max(0.0, min(1.0, float(saved_amount or 0.0) / target))


def list_savings_goals(db: Session, current_user: RequestUser) -> list[schemas.SavingsGoalRead]:
    rows = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.id.desc())
        .all()
    )
    return [
        schemas.SavingsGoalRead(
            id=item.id,
            user_id=item.user_id,
            name=item.name,
            target_amount=float(item.target_amount or 0.0),
            saved_amount=float(item.saved_amount or 0.0),
            monthly_contribution=float(item.monthly_contribution or 0.0),
            start_date=item.start_date,
            target_date=item.target_date,
            goal_type=item.goal_type,
            funding_source=item.funding_source,
            priority=item.priority,
            note=item.note,
            image_url=item.image_url,
            auto_deposit=bool(item.auto_deposit),
            auto_transfer=bool(item.auto_transfer),
            status=item.status or "active",
            progress=_goal_progress(item.saved_amount, item.target_amount),
        )
        for item in rows
    ]


def create_savings_goal(
    db: Session,
    current_user: RequestUser,
    payload: schemas.SavingsGoalCreate,
) -> schemas.SavingsGoalRead:
    data = payload.model_dump()
    item = SavingsGoal(user_id=current_user.id, **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    emit_finance_update("goals", current_user.id, item.id)
    return schemas.SavingsGoalRead(
        id=item.id,
        user_id=item.user_id,
        name=item.name,
        target_amount=float(item.target_amount or 0.0),
        saved_amount=float(item.saved_amount or 0.0),
        monthly_contribution=float(item.monthly_contribution or 0.0),
        start_date=item.start_date,
        target_date=item.target_date,
        goal_type=item.goal_type,
        funding_source=item.funding_source,
        priority=item.priority,
        note=item.note,
        image_url=item.image_url,
        auto_deposit=bool(item.auto_deposit),
        auto_transfer=bool(item.auto_transfer),
        status=item.status or "active",
        progress=_goal_progress(item.saved_amount, item.target_amount),
    )


def update_savings_goal(
    db: Session,
    current_user: RequestUser,
    goal_id: int,
    payload: schemas.SavingsGoalUpdate,
) -> schemas.SavingsGoalRead:
    item = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    emit_finance_update("goals", current_user.id, item.id)
    return schemas.SavingsGoalRead(
        id=item.id,
        user_id=item.user_id,
        name=item.name,
        target_amount=float(item.target_amount or 0.0),
        saved_amount=float(item.saved_amount or 0.0),
        monthly_contribution=float(item.monthly_contribution or 0.0),
        start_date=item.start_date,
        target_date=item.target_date,
        goal_type=item.goal_type,
        funding_source=item.funding_source,
        priority=item.priority,
        note=item.note,
        image_url=item.image_url,
        auto_deposit=bool(item.auto_deposit),
        auto_transfer=bool(item.auto_transfer),
        status=item.status or "active",
        progress=_goal_progress(item.saved_amount, item.target_amount),
    )


def delete_savings_goal(db: Session, current_user: RequestUser, goal_id: int) -> None:
    item = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")
    db.delete(item)
    db.commit()
    emit_finance_update("goals", current_user.id, goal_id)


def bootstrap_finance_data(db: Session, current_user: RequestUser) -> dict:
    created_categories = 0
    created_tags = 0
    created_budgets = 0

    wanted_categories = DEFAULT_INCOME_CATEGORIES + DEFAULT_EXPENSE_CATEGORIES
    existing_categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.name.in_(wanted_categories))
        .all()
    )
    category_by_name = {item.name: item for item in existing_categories}

    for name in wanted_categories:
        if name in category_by_name:
            continue
        item = Category(user_id=current_user.id, name=name)
        db.add(item)
        db.flush()
        category_by_name[name] = item
        created_categories += 1

    existing_tags = (
        db.query(Tag)
        .filter(Tag.user_id == current_user.id, Tag.name.in_([name for name, _ in DEFAULT_TAGS]))
        .all()
    )
    tag_names = {item.name for item in existing_tags}
    for name, color in DEFAULT_TAGS:
        if name in tag_names:
            continue
        db.add(Tag(user_id=current_user.id, name=name, color=color))
        created_tags += 1

    for category_name, amount in DEFAULT_BUDGET_TARGETS.items():
        category = category_by_name.get(category_name)
        if not category:
            continue
        exists = (
            db.query(Budget)
            .filter(Budget.user_id == current_user.id, Budget.category_id == category.id)
            .first()
        )
        if exists:
            continue
        db.add(Budget(user_id=current_user.id, category_id=category.id, amount=float(amount)))
        created_budgets += 1

    db.commit()
    if created_categories:
        emit_finance_update("categories", current_user.id, None)
    if created_tags:
        emit_finance_update("tags", current_user.id, None)
    if created_budgets:
        emit_finance_update("budgets", current_user.id, None)
    return {
        "created_categories": created_categories,
        "created_tags": created_tags,
        "created_budgets": created_budgets,
    }


def create_bill(db: Session, current_user: RequestUser, payload: schemas.BillCreate) -> Bill:
    _validate_category_ownership(db, current_user, payload.category_id)
    _validate_account_ownership(db, current_user, payload.account_id)
    
    item = Bill(
        user_id=current_user.id,
        merchant=payload.merchant,
        date=payload.date,
        category_id=payload.category_id,
        account_id=payload.account_id,
        total_amount=payload.total_amount,
        vat_amount=payload.vat_amount,
        ocr_confidence=payload.ocr_confidence,
        status=payload.status,
        bill_number=payload.bill_number,
        image_path=payload.image_path,
        notes=payload.notes,
        items=[i.model_dump() for i in payload.items] if payload.items else None
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    emit_finance_update("bills", current_user.id, item.id)
    return item


def list_bills(
    db: Session,
    current_user: RequestUser,
    start_date: date | None = None,
    end_date: date | None = None,
    status: str | None = None,
) -> list[Bill]:
    query = db.query(Bill).filter(Bill.user_id == current_user.id)
    if start_date:
        query = query.filter(Bill.date >= start_date)
    if end_date:
        query = query.filter(Bill.date <= end_date)
    if status:
        query = query.filter(Bill.status == status)
    
    return query.order_by(Bill.date.desc().nulls_last(), Bill.id.desc()).all()


def get_bill(db: Session, current_user: RequestUser, bill_id: int) -> Bill:
    item = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return item


def update_bill(db: Session, current_user: RequestUser, bill_id: int, payload: schemas.BillUpdate) -> Bill:
    item = get_bill(db, current_user, bill_id)
    data = payload.model_dump(exclude_unset=True)
    
    if "category_id" in data:
        _validate_category_ownership(db, current_user, data["category_id"])
    if "account_id" in data:
        _validate_account_ownership(db, current_user, data["account_id"])
        
    for key, value in data.items():
        if key == "items" and value is not None:
            setattr(item, key, [i.model_dump() for i in value])
        elif key != "items":
            setattr(item, key, value)
            
    db.commit()
    db.refresh(item)
    emit_finance_update("bills", current_user.id, item.id)
    return item


def delete_bill(db: Session, current_user: RequestUser, bill_id: int) -> None:
    item = get_bill(db, current_user, bill_id)
    db.delete(item)
    db.commit()
    emit_finance_update("bills", current_user.id, bill_id)
