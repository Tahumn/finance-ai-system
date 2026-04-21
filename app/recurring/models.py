from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String, UniqueConstraint
from app.database import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    start_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_subscription_name"),)


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    due_date = Column(Date, nullable=True)


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    label = Column(String, nullable=False)
    remind_date = Column(Date, nullable=True)
    channel = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
