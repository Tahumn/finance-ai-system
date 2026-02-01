from fastapi import APIRouter

from app.finance import schemas, service

router = APIRouter(prefix="/finance", tags=["finance"])


@router.post("/transactions", response_model=dict)
def create_transaction(payload: schemas.TransactionCreate):
    return service.add_transaction(payload)


@router.get("/transactions", response_model=list[dict])
def list_all():
    return service.list_transactions()


@router.post("/budgets", response_model=dict)
def create_budget(payload: schemas.BudgetCreate):
    return service.add_budget(payload)


@router.get("/budgets/summary", response_model=list[schemas.BudgetSummary])
def budget_summary():
    return service.summarize_budget()

