from __future__ import annotations

from datetime import date as DateType
from typing import Literal

from pydantic import BaseModel, Field


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
