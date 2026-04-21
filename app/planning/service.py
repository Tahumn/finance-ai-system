from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.auth_context import RequestUser
from app.planning import schemas, models

def create_budget(db: Session, current_user: RequestUser, payload: schemas.BudgetCreate) -> models.Budget:
    db_item = models.Budget(
        user_id=current_user.id,
        category_ids=payload.category_ids,
        name=payload.name,
        amount=payload.amount,
        cycle=payload.cycle,
        start_date=payload.start_date,
        end_date=payload.end_date,
        threshold=payload.threshold,
        status="active"
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_budgets(db: Session, current_user: RequestUser) -> list[models.Budget]:
    return db.query(models.Budget).filter(models.Budget.user_id == current_user.id).all()

def update_budget(db: Session, current_user: RequestUser, budget_id: int, payload: schemas.BudgetUpdate) -> models.Budget:
    db_item = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_budget(db: Session, current_user: RequestUser, budget_id: int) -> None:
    db_item = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    db.delete(db_item)
    db.commit()

def create_goal(db: Session, current_user: RequestUser, payload: schemas.GoalCreate) -> models.Goal:
    db_item = models.Goal(
        user_id=current_user.id,
        name=payload.name.strip(),
        target_amount=payload.target_amount,
        target_date=payload.target_date,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_goals(db: Session, current_user: RequestUser) -> list[models.Goal]:
    return db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()

def update_goal(db: Session, current_user: RequestUser, goal_id: int, payload: schemas.GoalUpdate) -> models.Goal:
    db_item = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and isinstance(data["name"], str):
        data["name"] = data["name"].strip()
        
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_goal(db: Session, current_user: RequestUser, goal_id: int) -> None:
    db_item = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    db.delete(db_item)
    db.commit()
