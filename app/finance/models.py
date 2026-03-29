from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String, Table, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


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


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    tags = relationship("Tag", secondary=transaction_tags, back_populates="transactions")
