from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.auth.models import User
from app.finance import schemas
from app.finance.models import Category, Transaction


def _get_user_category(db: Session, current_user: User, category_id: int) -> Category:
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


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
    return db_category


def list_categories(db: Session, current_user: User) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .order_by(Category.name.asc())
        .all()
    )


def update_category(
    db: Session,
    current_user: User,
    category_id: int,
    payload: schemas.CategoryUpdate,
) -> Category:
    category = _get_user_category(db, current_user, category_id)
    category_name = payload.name.strip()
    if not category_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required")

    duplicate = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            Category.name == category_name,
            Category.id != category_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists")

    category.name = category_name
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, current_user: User, category_id: int) -> None:
    category = _get_user_category(db, current_user, category_id)
    (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.category_id == category_id)
        .update({Transaction.category_id: None}, synchronize_session=False)
    )
    db.delete(category)
    db.commit()


def _validate_category_ownership(db: Session, current_user: User, category_id: int | None) -> None:
    if category_id is None:
        return
    _get_user_category(db, current_user, category_id)


def create_transaction(
    db: Session,
    current_user: User,
    payload: schemas.TransactionCreate,
) -> Transaction:
    _validate_category_ownership(db, current_user, payload.category_id)

    db_tx = Transaction(
        user_id=current_user.id,
        description=payload.description.strip(),
        amount=payload.amount,
        transaction_type=payload.transaction_type,
        category_id=payload.category_id,
        date=payload.date or date.today(),
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx


def list_transactions(
    db: Session,
    current_user: User,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
) -> list[Transaction]:
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    return query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()


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
    if "description" in data and not data["description"].strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Description is required")

    for key, value in data.items():
        if key == "description" and isinstance(value, str):
            setattr(db_tx, key, value.strip())
        else:
            setattr(db_tx, key, value)

    db.commit()
    db.refresh(db_tx)
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


def _base_query(db: Session, current_user: User, start_date: date | None, end_date: date | None):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    return query


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
    return schemas.FinanceSummary(
        total_income=float(income or 0.0),
        total_expense=float(expense or 0.0),
        balance=float((income or 0.0) - (expense or 0.0)),
    )


def get_category_breakdown(
    db: Session,
    current_user: User,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[schemas.CategoryBreakdown]:
    query = _base_query(db, current_user, start_date, end_date).filter(
        Transaction.transaction_type == "expense"
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


def get_cashflow(
    db: Session,
    current_user: User,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[schemas.CashflowPoint]:
    query = _base_query(db, current_user, start_date, end_date)
    rows = (
        query.with_entities(
            Transaction.date.label("period"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.transaction_type == "income", Transaction.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ).label("income"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.transaction_type == "expense", Transaction.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ).label("expense"),
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date.asc())
        .all()
    )

    return [
        schemas.CashflowPoint(
            period=row.period,
            income=float(row.income or 0.0),
            expense=float(row.expense or 0.0),
            balance=float((row.income or 0.0) - (row.expense or 0.0)),
        )
        for row in rows
    ]

