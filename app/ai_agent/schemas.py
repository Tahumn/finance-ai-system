from __future__ import annotations

from datetime import date as DateType, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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


class OcrLineItem(BaseModel):
    name: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    total: float | None = None


class OcrConfidence(BaseModel):
    merchant: float = 0.0
    transaction_date: float = 0.0
    payment_source: float = 0.0
    category: float = 0.0
    tags: float = 0.0
    suggested_note: float = 0.0
    subtotal_before_tax: float = 0.0
    vat_amount: float = 0.0
    discount_amount: float = 0.0
    final_total: float = 0.0


class OcrData(BaseModel):
    merchant: str | None = None
    transaction_date: DateType | None = None
    transaction_type: Literal["income", "expense"] = "expense"
    payment_source: str | None = None
    category: str | None = None
    tags: list[str] = []
    suggested_note: str | None = None
    raw_ocr_text: str = ""
    subtotal_before_tax: float | None = None
    vat_amount: float | None = None
    discount_amount: float | None = None
    final_total: float | None = None
    currency: str = "VND"
    line_items: list[OcrLineItem] = []
    image_path: str | None = None


class OcrMoneyValidation(BaseModel):
    formula: str = "subtotal_before_tax + vat_amount - discount_amount = final_total"
    is_valid: bool = True
    delta: float = 0.0


class OcrDebug(BaseModel):
    money_validation: OcrMoneyValidation


class OcrResponse(BaseModel):
    data: OcrData
    confidence: OcrConfidence
    warnings: list[str] = []
    debug: OcrDebug | None = None


class AnomalyAlert(BaseModel):
    id: str
    date: DateType
    amount: float
    description: str
    reason: str
    severity: Literal["low", "medium", "high"]


class AnomalyListResponse(BaseModel):
    alerts: list[AnomalyAlert]


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

