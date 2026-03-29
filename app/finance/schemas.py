from datetime import date as DateType

from pydantic import BaseModel, ConfigDict, Field, constr
from typing import Literal, List, Optional


class TransactionCreate(BaseModel):
    description: constr(strip_whitespace=True, min_length=1) = Field(..., example="Coffee")
    amount: float = Field(..., gt=0, example=3.5)
    transaction_type: Literal["income", "expense"]
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    date: Optional[DateType] = None


class TransactionUpdate(BaseModel):
    description: Optional[constr(strip_whitespace=True, min_length=1)] = Field(default=None)
    amount: Optional[float] = Field(default=None, gt=0)
    transaction_type: Optional[Literal["income", "expense"]] = None
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    date: Optional[DateType] = None


class TransactionRead(BaseModel):
    id: int
    user_id: int
    description: str
    amount: float
    transaction_type: str
    category_id: Optional[int]
    account_id: Optional[int]
    date: DateType
    model_config = ConfigDict(from_attributes=True)


class PaginatedTransactions(BaseModel):
    items: List[TransactionRead]
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
    # Duy trì các trường cũ để tương thích ngược nếu cần
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
    series: List[ChartPoint]


class AnomalyAlert(BaseModel):
    id: str
    date: DateType
    amount: float
    description: str
    reason: str
    severity: Literal["low", "medium", "high"]
