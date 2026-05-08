from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Response, status, File, UploadFile
from sqlalchemy.orm import Session

from app.finance import schemas, service
from app.auth.models import User
from app.auth.service import get_current_user
from app.database import get_db

router = APIRouter(prefix="/finance", tags=["finance"])


@router.post("/categories", response_model=schemas.CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_category(db, current_user, payload)


@router.get("/categories", response_model=list[schemas.CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_categories(db, current_user)


@router.put("/categories/{category_id}", response_model=schemas.CategoryRead)
def update_category(
    category_id: int,
    payload: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_category(db, current_user, category_id, payload)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_category(db, current_user, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tags", response_model=schemas.TagRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: schemas.TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_tag(db, current_user, payload)


@router.get("/tags", response_model=list[schemas.TagRead])
def list_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_tags(db, current_user)


@router.put("/tags/{tag_id}", response_model=schemas.TagRead)
def update_tag(
    tag_id: int,
    payload: schemas.TagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_tag(db, current_user, tag_id, payload)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_tag(db, current_user, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/transactions", response_model=schemas.TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_transaction(db, current_user, payload)


@router.get("/transactions", response_model=schemas.PaginatedTransactions)
def list_transactions(
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = service.list_transactions(
        db,
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        transaction_type=transaction_type,
        limit=limit,
        offset=offset,
    )
    return {
        "items": items,
        "total": total,
        "page": (offset // limit) + 1,
        "limit": limit
    }


@router.put("/transactions/{transaction_id}", response_model=schemas.TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_transaction(db, current_user, transaction_id, payload)


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_transaction(db, current_user, transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/accounts", response_model=list[schemas.AccountRead])
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_accounts(db, current_user)


@router.post("/accounts", response_model=schemas.AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: schemas.AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_account(db, current_user, payload)


@router.put("/accounts/{account_id}", response_model=schemas.AccountRead)
def update_account(
    account_id: int,
    payload: schemas.AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_account(db, current_user, account_id, payload)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_account(db, current_user, account_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/reports/summary", response_model=schemas.FinanceSummary)
def report_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_summary(db, current_user, start_date=start_date, end_date=end_date)


@router.get("/reports/category-breakdown", response_model=list[schemas.CategoryBreakdown])
def report_category_breakdown(
    start_date: date | None = None,
    end_date: date | None = None,
    transaction_type: str = "expense",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_category_breakdown(
        db, current_user, start_date=start_date, end_date=end_date, transaction_type=transaction_type
    )


@router.get("/reports/chart", response_model=schemas.GroupedChartData)
def report_chart(
    limit_months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_chart_data(db, current_user, limit_months=limit_months)


@router.get("/reports/overview", response_model=schemas.ReportsOverview)
def report_overview(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_reports_overview(
        db,
        current_user,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/budgets", response_model=list[schemas.BudgetRead])
def list_budgets(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_budgets(db, current_user, start_date=start_date, end_date=end_date)


@router.post("/budgets", response_model=schemas.BudgetRead, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_budget(db, current_user, payload)


@router.put("/budgets/{budget_id}", response_model=schemas.BudgetRead)
def update_budget(
    budget_id: int,
    payload: schemas.BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_budget(db, current_user, budget_id, payload)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_budget(db, current_user, budget_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/bootstrap")
def bootstrap_finance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.bootstrap_finance_data(db, current_user)


@router.get("/savings-goals", response_model=list[schemas.SavingsGoalRead])
def list_savings_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_savings_goals(db, current_user)


@router.post("/savings-goals", response_model=schemas.SavingsGoalRead, status_code=status.HTTP_201_CREATED)
def create_savings_goal(
    payload: schemas.SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_savings_goal(db, current_user, payload)


@router.put("/savings-goals/{goal_id}", response_model=schemas.SavingsGoalRead)
def update_savings_goal(
    goal_id: int,
    payload: schemas.SavingsGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_savings_goal(db, current_user, goal_id, payload)


@router.delete("/savings-goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_savings_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_savings_goal(db, current_user, goal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/bills", response_model=list[schemas.BillRead])
def list_bills(
    start_date: date | None = None,
    end_date: date | None = None,
    bill_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_bills(db, current_user, start_date=start_date, end_date=end_date, status=bill_status)


@router.post("/bills/upload-receipt")
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    import os
    import uuid
    
    os.makedirs("uploads/bills", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{current_user.id}_{uuid.uuid4()}{ext}"
    file_path = os.path.join("uploads/bills", filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    return {"image_path": f"/uploads/bills/{filename}"}


@router.post("/bills", response_model=schemas.BillRead, status_code=status.HTTP_201_CREATED)
def create_bill(
    payload: schemas.BillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_bill(db, current_user, payload)


@router.get("/bills/{bill_id}", response_model=schemas.BillRead)
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_bill(db, current_user, bill_id)


@router.put("/bills/{bill_id}", response_model=schemas.BillRead)
def update_bill(
    bill_id: int,
    payload: schemas.BillUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_bill(db, current_user, bill_id, payload)


@router.delete("/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service.delete_bill(db, current_user, bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
