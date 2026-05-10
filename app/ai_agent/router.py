from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.ai_agent import microservice_service as service
from app.ai_agent import schemas
from app.core.auth_context import RequestUser, get_active_request_user
from app.database import get_db

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse-transaction", response_model=schemas.ParseTransactionResponse)
def parse_transaction(
    payload: schemas.ParseTransactionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    return service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
        authorization=request.headers.get("authorization"),
    )


@router.post("/transactions", status_code=status.HTTP_201_CREATED)
def create_transaction_from_text(
    payload: schemas.ParseTransactionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    result = service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
        authorization=request.headers.get("authorization"),
    )
    if result.get("amount") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to detect amount from text",
        )
    return service.create_transaction_from_parsed(
        result,
        fallback_text=payload.text,
        authorization=request.headers.get("authorization"),
    )


@router.post("/chat", response_model=schemas.ChatResponse)
def chat(
    payload: schemas.ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    return service.answer_chat(
        db,
        current_user,
        payload.text,
        authorization=request.headers.get("authorization"),
    )


@router.get("/chat/history", response_model=schemas.ChatHistoryResponse)
def chat_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    messages = service.get_chat_history(db, current_user, limit=limit)
    return {"messages": messages}



@router.get("/anomalies", response_model=schemas.AnomalyListResponse)
def get_anomalies(
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    return {
        "alerts": service.get_spending_anomalies(
            db,
            current_user,
            authorization=request.headers.get("authorization"),
        )
    }


@router.get("/forecast", response_model=schemas.ForecastResponse)
def get_forecast(
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    return service.get_spending_forecast(
        db,
        current_user,
        authorization=request.headers.get("authorization"),
    )


@router.get("/savings-tips", response_model=schemas.SavingTipsResponse)
def get_savings_tips(
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    return service.get_savings_suggestions(
        db,
        current_user,
        authorization=request.headers.get("authorization"),
    )

