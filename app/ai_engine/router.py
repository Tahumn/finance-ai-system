# Mục tiêu: Định nghĩa các endpoint API để xử lý yêu cầu từ người dùng, kết hợp module khác để hành động và trả về phản hồi.
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text as sql_text, func
from sqlalchemy.orm import Session

from app.ai_engine import (
    intent_classifier,
    entity_extractor,
    sql_builder,
    analytics_engine,
    llm_client,
    schemas,
)
from app.auth.models import User
from app.auth.service import get_current_user
from app.database import get_db
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service
from app.finance.models import Category

router = APIRouter(prefix="/ai", tags=["ai"])


def _resolve_category_id(
    db: Session,
    current_user: User,
    category_name: str | None,
    auto_create: bool,
) -> int | None:
    if not category_name:
        return None

    existing = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            func.lower(Category.name) == category_name.lower(),
        )
        .first()
    )
    if existing:
        return existing.id

    if not auto_create:
        return None

    created = finance_service.create_category(
        db,
        current_user,
        finance_schemas.CategoryCreate(name=category_name),
    )
    return created.id


def _safe_generate_text(prompt: str, fallback: str) -> str:
    if not llm_client.is_configured():
        return fallback
    try:
        return llm_client.generate_text(prompt)
    except Exception:
        # Không làm fail request nếu LLM lỗi, trả về fallback rõ ràng
        return f"{fallback} (LLM đang lỗi hoặc API key chưa hợp lệ.)"


@router.post("/process", response_model=schemas.AIProcessResponse)
def process_text(
    payload: schemas.AIProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    intent = intent_classifier.classify_intent(text)
    entities_dict = entity_extractor.extract_entities(text)
    entities = schemas.AIEntities(**entities_dict)

    if intent in ["ADD_EXPENSE", "ADD_INCOME"]:
        tx_type = "expense" if intent == "ADD_EXPENSE" else "income"
        amount = entities.amount
        if not amount:
            raise HTTPException(status_code=400, detail="amount is required")

        category_id = _resolve_category_id(
            db,
            current_user,
            entities.category,
            payload.auto_create_category,
        )

        tx_payload = finance_schemas.TransactionCreate(
            description=text,
            amount=float(amount),
            transaction_type=tx_type,
            category_id=category_id,
            date=entities.date,
        )
        tx = finance_service.create_transaction(db, current_user, tx_payload)

        fallback = f"Đã ghi nhận {tx_type} {tx.amount} cho '{text}'."
        message = (
            _safe_generate_text(
                f"Viết câu trả lời tự nhiên: {fallback}",
                fallback,
            )
            if payload.use_llm
            else fallback
        )

        return schemas.AIProcessResponse(
            intent=intent,
            entities=entities,
            action="ADD_TRANSACTION",
            data={"transaction_id": tx.id},
            message=message,
        )

    if intent == "QUERY":
        tx_type = entities.type or "expense"
        category_id = _resolve_category_id(
            db,
            current_user,
            entities.category,
            auto_create=False,
        )

        query, params = sql_builder.build_total_query(
            user_id=current_user.id,
            transaction_type=tx_type,
            category_id=category_id,
            month=entities.month,
        )
        total = db.execute(sql_text(query), params).scalar() or 0.0

        fallback = f"Tổng {tx_type} là {total}."
        message = (
            _safe_generate_text(
                f"Viết câu trả lời tự nhiên. Tổng {tx_type}: {total}. "
                f"Category: {entities.category}. Month: {entities.month}.",
                fallback,
            )
            if payload.use_llm
            else fallback
        )

        return schemas.AIProcessResponse(
            intent=intent,
            entities=entities,
            action="QUERY_TOTAL",
            data={"total": float(total), "transaction_type": tx_type},
            message=message,
        )

    if intent == "ANALYSIS":
        today = date.today()
        current_month_start = date(today.year, today.month, 1)
        previous_month_end = current_month_start - timedelta(days=1)
        previous_month_start = date(previous_month_end.year, previous_month_end.month, 1)

        current_summary = finance_service.get_summary(
            db, current_user, start_date=current_month_start, end_date=today
        )
        previous_summary = finance_service.get_summary(
            db, current_user, start_date=previous_month_start, end_date=previous_month_end
        )

        savings_rate = analytics_engine.calculate_savings_rate(
            current_summary.total_income,
            current_summary.total_expense,
        )
        growth = analytics_engine.calculate_growth(
            current_summary.total_expense,
            previous_summary.total_expense,
        )

        last_30 = finance_service.list_transactions(
            db,
            current_user,
            start_date=today - timedelta(days=30),
            end_date=today,
            transaction_type="expense",
        )
        anomalies = analytics_engine.detect_anomaly([tx.amount for tx in last_30])

        summary_json = {
            "current_month": {
                "income": current_summary.total_income,
                "expense": current_summary.total_expense,
                "balance": current_summary.balance,
            },
            "previous_month": {
                "expense": previous_summary.total_expense,
            },
            "savings_rate": savings_rate,
            "expense_growth": growth,
            "anomalies": anomalies,
        }

        fallback = "Đã tạo báo cáo phân tích tài chính. Bật LLM để có lời khuyên tự nhiên."
        message = (
            _safe_generate_text(
                f"Phân tích tài chính dựa trên dữ liệu sau và đưa lời khuyên: {summary_json}",
                fallback,
            )
            if payload.use_llm
            else fallback
        )

        return schemas.AIProcessResponse(
            intent=intent,
            entities=entities,
            action="ANALYSIS",
            data=summary_json,
            message=message,
        )

    return schemas.AIProcessResponse(
        intent=intent,
        entities=entities,
        action="UNKNOWN",
        message="Mình chưa hiểu yêu cầu. Bạn thử nói rõ hơn nhé.",
    )
