from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.auth_context import RequestUser
from app.recurring import schemas, models

def create_subscription(db: Session, current_user: RequestUser, payload: schemas.SubscriptionCreate) -> models.Subscription:
    db_item = models.Subscription(
        user_id=current_user.id,
        name=payload.name.strip(),
        amount=payload.amount,
        start_date=payload.start_date,
        is_active=payload.is_active,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_subscriptions(db: Session, current_user: RequestUser) -> list[models.Subscription]:
    return db.query(models.Subscription).filter(models.Subscription.user_id == current_user.id).all()

def update_subscription(db: Session, current_user: RequestUser, item_id: int, payload: schemas.SubscriptionUpdate) -> models.Subscription:
    db_item = db.query(models.Subscription).filter(models.Subscription.id == item_id, models.Subscription.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and isinstance(data["name"], str):
        data["name"] = data["name"].strip()
        
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_subscription(db: Session, current_user: RequestUser, item_id: int) -> None:
    db_item = db.query(models.Subscription).filter(models.Subscription.id == item_id, models.Subscription.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    db.delete(db_item)
    db.commit()

def create_debt(db: Session, current_user: RequestUser, payload: schemas.DebtCreate) -> models.Debt:
    db_item = models.Debt(
        user_id=current_user.id,
        name=payload.name.strip(),
        amount=payload.amount,
        due_date=payload.due_date,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_debts(db: Session, current_user: RequestUser) -> list[models.Debt]:
    return db.query(models.Debt).filter(models.Debt.user_id == current_user.id).all()

def update_debt(db: Session, current_user: RequestUser, item_id: int, payload: schemas.DebtUpdate) -> models.Debt:
    db_item = db.query(models.Debt).filter(models.Debt.id == item_id, models.Debt.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")
    
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and isinstance(data["name"], str):
        data["name"] = data["name"].strip()
        
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_debt(db: Session, current_user: RequestUser, item_id: int) -> None:
    db_item = db.query(models.Debt).filter(models.Debt.id == item_id, models.Debt.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")
    db.delete(db_item)
    db.commit()

def create_reminder(db: Session, current_user: RequestUser, payload: schemas.ReminderCreate) -> models.Reminder:
    db_item = models.Reminder(
        user_id=current_user.id,
        label=payload.label.strip(),
        remind_date=payload.remind_date,
        channel=payload.channel,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_reminders(db: Session, current_user: RequestUser) -> list[models.Reminder]:
    return db.query(models.Reminder).filter(models.Reminder.user_id == current_user.id).all()

def update_reminder(db: Session, current_user: RequestUser, item_id: int, payload: schemas.ReminderUpdate) -> models.Reminder:
    db_item = db.query(models.Reminder).filter(models.Reminder.id == item_id, models.Reminder.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    
    data = payload.model_dump(exclude_unset=True)
    if "label" in data and isinstance(data["label"], str):
        data["label"] = data["label"].strip()
        
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_reminder(db: Session, current_user: RequestUser, item_id: int) -> None:
    db_item = db.query(models.Reminder).filter(models.Reminder.id == item_id, models.Reminder.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    db.delete(db_item)
    db.commit()
