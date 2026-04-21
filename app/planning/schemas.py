from datetime import date
from pydantic import BaseModel, ConfigDict, Field

class BudgetCreate(BaseModel):
    name: str | None = None
    category_ids: str | None = None
    amount: float = Field(..., gt=0)
    cycle: str | None = "monthly"
    start_date: date | None = None
    end_date: date | None = None
    threshold: float | None = 80.0

class BudgetUpdate(BaseModel):
    name: str | None = None
    category_ids: str | None = None
    amount: float | None = Field(default=None, gt=0)
    cycle: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    threshold: float | None = None
    status: str | None = None

class BudgetRead(BaseModel):
    id: int
    user_id: int
    category_ids: str | None
    name: str | None
    amount: float
    cycle: str | None
    start_date: date | None
    end_date: date | None
    threshold: float | None
    status: str | None

    model_config = ConfigDict(from_attributes=True)

class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1)
    target_amount: float = Field(..., gt=0)
    target_date: date | None = None

class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    target_amount: float | None = Field(default=None, gt=0)
    target_date: date | None = None

class GoalRead(BaseModel):
    id: int
    user_id: int
    name: str
    target_amount: float
    target_date: date | None

    model_config = ConfigDict(from_attributes=True)
