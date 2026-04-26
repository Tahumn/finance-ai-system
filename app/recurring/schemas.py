from datetime import date
from pydantic import BaseModel, ConfigDict, Field

class SubscriptionCreate(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    start_date: date | None = None
    frequency: str = "monthly"
    is_active: bool = True

class SubscriptionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    amount: float | None = Field(default=None, gt=0)
    start_date: date | None = None
    frequency: str | None = None
    is_active: bool | None = None

class SubscriptionRead(BaseModel):
    id: int
    user_id: int
    name: str
    amount: float
    start_date: date | None
    frequency: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class DebtCreate(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    due_date: date | None = None
    frequency: str = "one_time"

class DebtUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    amount: float | None = Field(default=None, gt=0)
    due_date: date | None = None
    frequency: str | None = None

class DebtRead(BaseModel):
    id: int
    user_id: int
    name: str
    amount: float
    due_date: date | None
    frequency: str
    model_config = ConfigDict(from_attributes=True)

class ReminderCreate(BaseModel):
    label: str = Field(..., min_length=1)
    remind_date: date | None = None
    channel: str | None = None

class ReminderUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1)
    remind_date: date | None = None
    channel: str | None = None

class ReminderRead(BaseModel):
    id: int
    user_id: int
    label: str
    remind_date: date | None
    channel: str | None
    model_config = ConfigDict(from_attributes=True)
