from datetime import datetime

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


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, nullable=False, index=True)
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
    user_id = Column(Integer, nullable=False, index=True)
    transactions = relationship("Transaction", secondary=transaction_tags, back_populates="tags")
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_tag_name"),)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
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
    user_id = Column(Integer, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    ocr_confidence = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    tags = relationship("Tag", secondary=transaction_tags, back_populates="transactions")
    category = relationship("Category")
    account = relationship("Account")

    @property
    def categoryLabel(self):
        return self.category.name if self.category else "Khác"

    @property
    def accountName(self):
        return self.account.name if self.account else "Tiền mặt"


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    from_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    note = Column(String, nullable=True)

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    start_date = Column(Date, nullable=True)
    frequency = Column(String, nullable=False, default="monthly")
    is_active = Column(Boolean, nullable=False, default=True)
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_subscription_name"),)


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    category_id = Column(Integer, nullable=True, index=True)
    category_ids = Column(String, nullable=True)
    name = Column(String, nullable=True)
    amount = Column(Float, nullable=False, default=0.0)
    cycle = Column(String, nullable=True, default="monthly")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    threshold = Column(Float, nullable=True, default=80.0)
    status = Column(String, nullable=True, default="active")
    __table_args__ = (UniqueConstraint("user_id", "category_id", name="uq_user_budget_category"),)


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    due_date = Column(Date, nullable=True)
    frequency = Column(String, nullable=False, default="one_time")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False, default=0.0)
    target_date = Column(Date, nullable=True)


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
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
    user_id = Column(Integer, nullable=False, index=True)
    label = Column(String, nullable=False)
    remind_date = Column(Date, nullable=True)
    channel = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    merchant = Column(String, nullable=True)
    date = Column(Date, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    total_amount = Column(Float, nullable=False, default=0.0)
    vat_amount = Column(Float, nullable=True, default=0.0)
    ocr_confidence = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="pending")
    bill_number = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    items = Column(JSON, nullable=True)
    category = relationship("Category")
    account = relationship("Account")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    @property
    def category_name(self):
        return self.category.name if self.category else None

    @property
    def account_name(self):
        return self.account.name if self.account else None
