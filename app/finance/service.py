from datetime import date
from typing import Dict, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.auth.models import User
from app.finance import schemas
from app.finance.models import Account, Category, Tag, Transaction
from app.realtime import emit_finance_update


def create_category(db: Session, current_user: User, payload: schemas.CategoryCreate) -> Category:
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


def list_categories(db: Session, current_user: User) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .order_by(Category.name.asc())
        .all()
    )


def _validate_category_ownership(db: Session, current_user: User, category_id: int | None) -> None:
    if category_id is None:
        return
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


def _validate_account_ownership(db: Session, current_user: User, account_id: int | None) -> None:
    if account_id is None:
        return
    account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")


def _load_tags(db: Session, current_user: User, tag_ids: list[int] | None) -> list[Tag]:
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


def create_tag(db: Session, current_user: User, payload: schemas.TagCreate) -> Tag:
    tag_name = payload.name.strip()
    if not tag_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag name is required")

    exists = (
        db.query(Tag)
        .filter(Tag.user_id == current_user.id, Tag.name == tag_name)
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag already exists")

    db_tag = Tag(name=tag_name, color=payload.color or "#1565c0", user_id=current_user.id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    emit_finance_update("tags", current_user.id, db_tag.id)
    return db_tag


def list_tags(db: Session, current_user: User) -> list[Tag]:
    return (
        db.query(Tag)
        .filter(Tag.user_id == current_user.id)
        .order_by(Tag.name.asc())
        .all()
    )


def update_tag(db: Session, current_user: User, tag_id: int, payload: schemas.TagUpdate) -> Tag:
    db_tag = (
        db.query(Tag)
        .filter(Tag.id == tag_id, Tag.user_id == current_user.id)
        .first()
    )
    if not db_tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = data["name"].strip()
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


def delete_tag(db: Session, current_user: User, tag_id: int) -> None:
    db_tag = (
        db.query(Tag)
        .filter(Tag.id == tag_id, Tag.user_id == current_user.id)
        .first()
    )
    if not db_tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    db.delete(db_tag)
    db.commit()
    emit_finance_update("tags", current_user.id, tag_id)


def create_transaction(
    db: Session,
    current_user: User,
    payload: schemas.TransactionCreate,
) -> Transaction:
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
    )
    if tags:
        db_tx.tags = tags

    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    emit_finance_update("transactions", current_user.id, db_tx.id)
    return db_tx


def list_transactions(
    db: Session,
    current_user: User,
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
        .options(selectinload(Transaction.tags))
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
    items = query.order_by(Transaction.date.desc(), Transaction.id.desc()).offset(offset).limit(limit).all()
    return items, total


def update_transaction(
    db: Session,
    current_user: User,
    transaction_id: int,
    payload: schemas.TransactionUpdate,
) -> Transaction:
    db_tx = (
        db.query(Transaction)
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
    if "description" in data and not data["description"].strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Description is required")
    if "tag_ids" in data:
        db_tx.tags = _load_tags(db, current_user, data["tag_ids"])
        data.pop("tag_ids", None)

    for key, value in data.items():
        if key == "description" and isinstance(value, str):
            setattr(db_tx, key, value.strip())
        else:
            setattr(db_tx, key, value)

    db.commit()
    db.refresh(db_tx)
    emit_finance_update("transactions", current_user.id, db_tx.id)
    return db_tx


def delete_transaction(db: Session, current_user: User, transaction_id: int) -> None:
    db_tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not db_tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    db.delete(db_tx)
    db.commit()
    emit_finance_update("transactions", current_user.id, transaction_id)


def _base_query(db: Session, current_user: User, start_date: date | None, end_date: date | None):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    return query


def get_total_balance(db: Session, user_id: int) -> float:
    income = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(Transaction.user_id == user_id, Transaction.transaction_type == "income")
        .scalar()
    )
    expense = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(Transaction.user_id == user_id, Transaction.transaction_type == "expense")
        .scalar()
    )
    return float((income or 0.0) - (expense or 0.0))


def get_summary(
    db: Session,
    current_user: User,
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
        balance=period_net,
    )


def get_category_breakdown(
    db: Session,
    current_user: User,
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
    current_user: User,
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
