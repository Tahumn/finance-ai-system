from datetime import date, datetime, timedelta

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _first_day_of_current_month() -> date:
    today = date.today()
    return date(today.year, today.month, 1)


def _last_day_of_current_month() -> date:
    first_day = _first_day_of_current_month()
    next_month = (first_day.replace(day=28) + timedelta(days=4)).replace(day=1)
    return next_month - timedelta(days=1)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_category_name"),)


transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#1565c0")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    transactions = relationship("Transaction", secondary=transaction_tags, back_populates="tags")
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_tag_name"),)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    account_type = Column("type", String, nullable=False, default="bank")
    provider = Column(String, nullable=True)
    last4 = Column(String, nullable=True)
    note = Column(String, nullable=True)
    color = Column(String, nullable=False, default="#ec4899")
    currency = Column(String, nullable=False, default="VND")
    opening_balance = Column(Float, nullable=False, default=0.0)
    credit_limit = Column(Float, nullable=True, default=0.0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_account_name"),)

    @property
    def type(self) -> str:
        return self.account_type

    @type.setter
    def type(self, value: str) -> None:
        self.account_type = value

    @property
    def balance(self) -> float:
        return float(self.opening_balance or 0.0)

    @balance.setter
    def balance(self, value: float) -> None:
        self.opening_balance = value


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    tags = relationship("Tag", secondary=transaction_tags, back_populates="transactions")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    from_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    note = Column(String, nullable=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    start_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_subscription_name"),)


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False, default=0.0)
    period_start = Column(Date, nullable=False, default=_first_day_of_current_month)
    period_end = Column(Date, nullable=False, default=_last_day_of_current_month)
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category_id",
            "period_start",
            "period_end",
            name="uq_user_budget_category_period",
        ),
    )


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    due_date = Column(Date, nullable=True)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False, default=0.0)
    target_date = Column(Date, nullable=True)


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    goal_type = Column(String, nullable=True)
    funding_source = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    note = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    target_amount = Column(Float, nullable=False, default=0.0)
    saved_amount = Column(Float, nullable=False, default=0.0)
    monthly_contribution = Column(Float, nullable=False, default=0.0)
    start_date = Column(Date, nullable=True)
    target_date = Column(Date, nullable=True)
    auto_deposit = Column(Boolean, nullable=False, default=False)
    auto_transfer = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    label = Column(String, nullable=False)
    remind_date = Column(Date, nullable=True)
    channel = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    merchant = Column(String, nullable=True)
    date = Column(Date, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    total_amount = Column(Float, nullable=False, default=0.0)
    vat_amount = Column(Float, nullable=True, default=0.0)
    ocr_confidence = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="pending")
    bill_number = Column(String, nullable=True)
    items = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class AccountUpdateHistory(Base):
    __tablename__ = "account_update_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    action = Column(String, nullable=False)  # e.g. "create", "update", "delete"
    item_name = Column(String, nullable=False)
    change_amount = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    performer = Column(String, nullable=False, default="Bạn")

class SavingsContribution(Base):
    __tablename__ = "savings_contributions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    goal_id = Column(Integer, ForeignKey("savings_goals.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False, default=date.today)
    description = Column(String, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
