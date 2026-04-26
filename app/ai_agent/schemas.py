from __future__ import annotations

from datetime import date as DateType, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.finance import schemas as finance_schemas


class ParseTransactionRequest(BaseModel):
    text: str = Field(..., min_length=1, example="hom nay chi 50k an sang")
    default_date: DateType | None = None
    auto_create_category: bool = True


class ParseTransactionResponse(BaseModel):
    description: str
    amount: float | None
    transaction_type: Literal["income", "expense"]
    category_id: int | None
    category_name: str | None
    date: DateType
    warnings: list[str] = []
    confidence: float | None = None


class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1, example="thang 3 toi chi bao nhieu an uong")


class ChatResponse(BaseModel):
    answer: str
    intent: str | None = None
    start_date: DateType | None = None
    end_date: DateType | None = None
    category_name: str | None = None
    total: float | None = None


class ChatMessageRead(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    intent: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageRead] = []


class OcrResponse(BaseModel):
    merchant: str | None = None
    merchant_confidence: float | None = None
    total: float | None = None
    date: DateType | None = None
    vat: float | None = None
    estimated: float | None = None
    note: str | None = None
    computed_total: float | None = None
    total_delta: float | None = None
    is_total_consistent: bool | None = None
    warnings: list[str] = []
    text: str = ""


class AnomalyListResponse(BaseModel):
    alerts: list[finance_schemas.AnomalyAlert]


class ForecastPoint(BaseModel):
    month: str
    predicted_expense: float
    predicted_income: float | None = None
    note: str | None = None


class ForecastResponse(BaseModel):
    summary: str
    points: list[ForecastPoint] = []
    top_growing_categories: list[str] = []
    risk_level: Literal["low", "medium", "high"] = "low"
    tips: list[str] = []


class SavingsTip(BaseModel):
    category: str
    current_spend: float
    suggested_limit: float
    potential_saving: float
    tip: str


class SavingTipsResponse(BaseModel):
    summary: str
    tips: list[SavingsTip] = []
    total_potential_saving: float = 0.0
    general_advice: list[str] = []

