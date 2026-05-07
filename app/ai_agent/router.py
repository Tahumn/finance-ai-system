from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.ai_agent import schemas, service
from app.auth.models import User
from app.auth.service import get_current_active_user
from app.database import get_db
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse-transaction", response_model=schemas.ParseTransactionResponse)
def parse_transaction(
    payload: schemas.ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
    )


@router.post("/transactions", status_code=status.HTTP_201_CREATED)
def create_transaction_from_text(
    payload: schemas.ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
    )
    if result.get("amount") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to detect amount from text",
        )

    tx_payload = finance_schemas.TransactionCreate(
        description=result["description"],
        amount=result["amount"],
        transaction_type=result["transaction_type"],
        category_id=result.get("category_id"),
        account_id=result.get("account_id"),
        date=result.get("date"),
        tag_ids=result.get("tag_ids") or [],
    )
    return finance_service.create_transaction(db, current_user, tx_payload)


@router.post("/chat", response_model=schemas.ChatResponse)
def chat(
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.answer_chat(db, current_user, payload.text)


@router.get("/chat/history", response_model=schemas.ChatHistoryResponse)
def chat_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    messages = service.get_chat_history(db, current_user, limit=limit)
    return {"messages": messages}


@router.post("/ocr", response_model=schemas.OcrResponse)
async def ocr_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    payload = await file.read()
    return service.extract_ocr(db, current_user, payload)


@router.get("/anomalies", response_model=schemas.AnomalyListResponse)
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return {"alerts": service.get_spending_anomalies(db, current_user)}


@router.get("/forecast", response_model=schemas.ForecastResponse)
def get_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.get_spending_forecast(db, current_user)


@router.get("/savings-tips", response_model=schemas.SavingTipsResponse)
def get_savings_tips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.get_savings_suggestions(db, current_user)

