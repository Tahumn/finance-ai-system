from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.ai_agent import schemas, service
from app.auth.models import User
from app.auth.service import get_current_user
from app.database import get_db
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse-transaction", response_model=schemas.ParseTransactionResponse)
def parse_transaction(
    payload: schemas.ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
    )
    return result


@router.post(
    "/transactions",
    response_model=finance_schemas.TransactionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction_from_text(
    payload: schemas.ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
    )
    if result["amount"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to detect amount from text",
        )

    tx_payload = finance_schemas.TransactionCreate(
        description=result["description"],
        amount=result["amount"],
        transaction_type=result["transaction_type"],
        category_id=result["category_id"],
        date=result["date"],
    )
    return finance_service.create_transaction(db, current_user, tx_payload)


@router.post("/chat", response_model=schemas.ChatResponse)
def chat(
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.answer_chat(db, current_user, payload.text)


@router.post("/ocr", response_model=schemas.OcrResponse)
async def ocr_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    payload = await file.read()
    return service.extract_ocr(payload)
