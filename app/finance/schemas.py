from datetime import date as DateType, datetime as DateTimeType
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
    ocr_confidence: float | None = None
    notes: str | None = None
    image_path: str | None = None
    tag_ids: list[int] = Field(default_factory=list)


class TransactionUpdate(BaseModel):
    description: constr(strip_whitespace=True, min_length=1) | None = None
    amount: float | None = Field(default=None, gt=0)
    transaction_type: Literal["income", "expense"] | None = None
    category_id: int | None = None
    account_id: int | None = None
    date: DateType | None = None
    ocr_confidence: float | None = None
    notes: str | None = None
    image_path: str | None = None
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
    ocr_confidence: float | None = None
    notes: str | None = None
    image_path: str | None = None
    categoryLabel: str | None = None
    accountName: str | None = None
    tags: list[TagRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PaginatedTransactions(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    limit: int


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)


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


class BudgetCreate(BaseModel):
    category_id: int
    amount: float = Field(..., gt=0)
    period_start: DateType | None = None
    period_end: DateType | None = None


class BudgetUpdate(BaseModel):
    amount: float = Field(..., gt=0)


class BudgetRead(BaseModel):
    id: int
    user_id: int
    category_id: int
    category: str
    amount: float
    period_start: DateType | None = None
    period_end: DateType | None = None
    spent: float = 0.0
    remaining: float = 0.0
    progress: float = 0.0
    status: str = "normal"

    model_config = ConfigDict(from_attributes=True)


class ReportSeriesPoint(BaseModel):
    label: str
    income: float = 0.0
    expense: float = 0.0


class ReportCategoryPoint(BaseModel):
    category: str
    amount: float
    share: float = 0.0


class ReportPaymentPoint(BaseModel):
    source: str
    amount: float
    share: float = 0.0


class ReportHeatmapCell(BaseModel):
    week_index: int
    week_day: int
    total: float


class ReportTopTransaction(BaseModel):
    id: int
    description: str
    category: str
    amount: float
    date: DateType


class ReportGoalProgress(BaseModel):
    name: str
    target_amount: float
    saved_amount: float
    progress: float


class ReportsOverview(BaseModel):
    daily_series: list[ReportSeriesPoint]
    monthly_series: list[ReportSeriesPoint]
    category_spending: list[ReportCategoryPoint]
    payment_breakdown: list[ReportPaymentPoint]
    weekday_heatmap: list[ReportHeatmapCell]
    top_expenses: list[ReportTopTransaction]
    goals: list[ReportGoalProgress]


class SavingsGoalCreate(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    target_amount: float = Field(..., gt=0)
    saved_amount: float = Field(default=0, ge=0)
    monthly_contribution: float = Field(default=0, ge=0)
    start_date: DateType | None = None
    target_date: DateType | None = None
    goal_type: str | None = None
    funding_source: str | None = None
    priority: str | None = None
    note: str | None = None
    image_url: str | None = None
    auto_deposit: bool = False
    auto_transfer: bool = False
    status: str = "active"


class SavingsGoalUpdate(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) | None = None
    target_amount: float | None = Field(default=None, gt=0)
    saved_amount: float | None = Field(default=None, ge=0)
    monthly_contribution: float | None = Field(default=None, ge=0)
    start_date: DateType | None = None
    target_date: DateType | None = None
    goal_type: str | None = None
    funding_source: str | None = None
    priority: str | None = None
    note: str | None = None
    image_url: str | None = None
    auto_deposit: bool | None = None
    auto_transfer: bool | None = None
    status: str | None = None


class SavingsGoalRead(BaseModel):
    id: int
    user_id: int
    name: str
    target_amount: float
    saved_amount: float
    monthly_contribution: float
    start_date: DateType | None
    target_date: DateType | None
    goal_type: str | None
    funding_source: str | None
    priority: str | None
    note: str | None
    image_url: str | None
    auto_deposit: bool
    auto_transfer: bool
    status: str
    progress: float = 0.0

    model_config = ConfigDict(from_attributes=True)


AccountType = Literal["cash", "bank", "wallet", "credit"]


class AccountCreate(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    type: AccountType = "bank"
    provider: str | None = None
    last4: str | None = Field(default=None, max_length=4)
    balance: float = Field(default=0.0)
    credit_limit: float | None = Field(default=None)
    note: str | None = None
    color: str = Field(default="#ec4899")
    currency: str = Field(default="VND")


class AccountUpdate(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) | None = None
    type: AccountType | None = None
    provider: str | None = None
    last4: str | None = Field(default=None, max_length=4)
    balance: float | None = None
    credit_limit: float | None = None
    note: str | None = None
    color: str | None = None
    currency: str | None = None


class AccountRead(BaseModel):
    id: int
    user_id: int
    name: str
    type: AccountType
    provider: str | None
    last4: str | None
    balance: float
    credit_limit: float | None
    note: str | None
    color: str
    currency: str
    created_at: DateTimeType

    model_config = ConfigDict(from_attributes=True)

class BillItem(BaseModel):
    name: str
    amount: float

class BillCreate(BaseModel):
    merchant: str | None = None
    date: DateType | None = None
    category_id: int | None = None
    account_id: int | None = None
    total_amount: float = Field(default=0.0)
    vat_amount: float = Field(default=0.0)
    ocr_confidence: float | None = None
    status: str = "pending"
    bill_number: str | None = None
    image_path: str | None = None
    notes: str | None = None
    items: list[BillItem] | None = None

class BillUpdate(BaseModel):
    merchant: str | None = None
    date: DateType | None = None
    category_id: int | None = None
    account_id: int | None = None
    total_amount: float | None = None
    vat_amount: float | None = None
    ocr_confidence: float | None = None
    status: str | None = None
    bill_number: str | None = None
    image_path: str | None = None
    notes: str | None = None
    items: list[BillItem] | None = None

class BillRead(BaseModel):
    id: int
    user_id: int
    merchant: str | None
    date: DateType | None
    category_id: int | None
    account_id: int | None
    total_amount: float
    vat_amount: float
    ocr_confidence: float | None
    status: str
    bill_number: str | None
    image_path: str | None = None
    notes: str | None = None
    category_name: str | None = None
    account_name: str | None = None
    items: list[BillItem] | None
    created_at: DateTimeType

    model_config = ConfigDict(from_attributes=True)
    
class AccountUpdateHistoryRead(BaseModel):
    id: int
    user_id: int
    account_id: int
    action: str
    item_name: str
    change_amount: float | None
    created_at: DateTimeType
    performer: str

    model_config = ConfigDict(from_attributes=True)

class SavingsContributionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    date: DateType | None = None
    description: str | None = None
    source: str | None = None

class SavingsContributionRead(BaseModel):
    id: int
    user_id: int
    goal_id: int
    amount: float
    date: DateType
    description: str | None
    source: str | None
    created_at: DateTimeType

    model_config = ConfigDict(from_attributes=True)
