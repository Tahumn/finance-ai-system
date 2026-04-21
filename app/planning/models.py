from sqlalchemy import Column, Date, Float, Integer, String
from app.database import Base

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    # Storing multiple category IDs as a comma-separated string for simplicity
    category_ids = Column(String, nullable=True) 
    name = Column(String, nullable=True)
    amount = Column(Float, nullable=False, default=0.0)
    cycle = Column(String, nullable=True, default="monthly")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    threshold = Column(Float, nullable=True, default=80.0)
    status = Column(String, nullable=True, default="active")

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False, default=0.0)
    target_date = Column(Date, nullable=True)
