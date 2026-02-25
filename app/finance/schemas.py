from datetime import date as DateType

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class TransactionCreate(BaseModel):
    description: str = Field(..., min_length=1, example="Coffee")
    amount: float = Field(..., gt=0, example=3.5)
    transaction_type: Literal["income", "expense"]
    category_id: int | None = None
    date: DateType | None = None


class TransactionUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1)
    amount: float | None = Field(default=None, gt=0)
    transaction_type: Literal["income", "expense"] | None = None
    category_id: int | None = None
    date: DateType | None = None


class TransactionRead(BaseModel):
    id: int
    user_id: int
    description: str
    amount: float
    transaction_type: str
    category_id: int | None
    date: DateType
    model_config = ConfigDict(from_attributes=True)


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1)


class CategoryRead(BaseModel):
    id: int
    name: str
    user_id: int
    model_config = ConfigDict(from_attributes=True)


class FinanceSummary(BaseModel):
    total_income: float
    total_expense: float
    balance: float


class CategoryBreakdown(BaseModel):
    category: str
    spent: float

