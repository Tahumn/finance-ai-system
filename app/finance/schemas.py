from datetime import date as DateType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, constr


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1)
    color: str = Field(default="#1565c0")


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    color: str | None = None


class TagRead(BaseModel):
    id: int
    name: str
    color: str
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class TransactionCreate(BaseModel):
    description: constr(strip_whitespace=True, min_length=1) = Field(..., example="Coffee")
    amount: float = Field(..., gt=0, example=3.5)
    transaction_type: Literal["income", "expense"]
    category_id: int | None = None
    account_id: int | None = None
    date: DateType | None = None
    tag_ids: list[int] = Field(default_factory=list)


class TransactionUpdate(BaseModel):
    description: constr(strip_whitespace=True, min_length=1) | None = None
    amount: float | None = Field(default=None, gt=0)
    transaction_type: Literal["income", "expense"] | None = None
    category_id: int | None = None
    account_id: int | None = None
    date: DateType | None = None
    tag_ids: list[int] | None = None


class TransactionRead(BaseModel):
    id: int
    user_id: int
    description: str
    amount: float
    transaction_type: str
    category_id: int | None
    account_id: int | None
    date: DateType
    tags: list[TagRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PaginatedTransactions(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    limit: int


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1)


class CategoryRead(BaseModel):
    id: int
    name: str
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class FinanceSummary(BaseModel):
    total_balance: float = Field(..., description="Tổng (Thu - Chi) của toàn bộ lịch sử")
    period_total_income: float = Field(..., description="Thu nhập trong kỳ")
    period_total_expense: float = Field(..., description="Chi tiêu trong kỳ")
    period_net_flow: float = Field(..., description="Thu - Chi trong kỳ")
    total_income: float
    total_expense: float
    balance: float


class CategoryBreakdown(BaseModel):
    category: str
    spent: float


class ChartPoint(BaseModel):
    month: str
    income: float
    expense: float


class GroupedChartData(BaseModel):
    series: list[ChartPoint]


class AnomalyAlert(BaseModel):
    id: str
    date: DateType
    amount: float
    description: str
    reason: str
    severity: Literal["low", "medium", "high"]

