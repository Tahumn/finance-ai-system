from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.core.auth_context import RequestUser, get_request_user
from app.database import get_db
from app.planning import schemas, service

router = APIRouter(prefix="/planning", tags=["planning"])

@router.post("/budgets", response_model=schemas.BudgetRead, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.create_budget(db, current_user, payload)

@router.get("/budgets", response_model=list[schemas.BudgetRead])
def list_budgets(
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.list_budgets(db, current_user)

@router.put("/budgets/{budget_id}", response_model=schemas.BudgetRead)
def update_budget(
    budget_id: int,
    payload: schemas.BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.update_budget(db, current_user, budget_id, payload)

@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.delete_budget(db, current_user, budget_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/goals", response_model=schemas.GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.create_goal(db, current_user, payload)

@router.get("/goals", response_model=list[schemas.GoalRead])
def list_goals(
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.list_goals(db, current_user)

@router.put("/goals/{goal_id}", response_model=schemas.GoalRead)
def update_goal(
    goal_id: int,
    payload: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.update_goal(db, current_user, goal_id, payload)

@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.delete_goal(db, current_user, goal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
