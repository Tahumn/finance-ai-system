# Pydantic schemas giúp: validate dữ liệu, chuẩn hóa request, tự động sinh docs trong Swagger
from datetime import date as DateType
from pydantic import BaseModel, Field
from typing import Literal

class AIProcessRequest(BaseModel):
    text: str = Field(..., min_length=1)
    use_llm: bool = False
    auto_create_category: bool = True

class AIEntities(BaseModel):
    amount: float | None = None
    category: str | None = None
    date: DateType | None = None
    month: int | None = None
    type: Literal["income", "expense"] | None = None

class AIProcessResponse(BaseModel):
    intent: str
    entities: AIEntities
    action: str
    data: dict | None = None
    message: str | None = None
