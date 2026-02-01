from datetime import date

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    description: str = Field(..., example="Coffee")
    amount: float = Field(..., example=3.5)
    date: date | None = None


class BudgetCreate(BaseModel):
    category: str
    limit: float


class BudgetSummary(BaseModel):
    category: str
    limit: float
    spent: float

