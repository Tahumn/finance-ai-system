from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session
from app.core.auth_context import RequestUser, get_request_user
from app.database import get_db
from app.recurring import schemas, service

router = APIRouter(prefix="/recurring", tags=["recurring"])

@router.post("/subscriptions", response_model=schemas.SubscriptionRead, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: schemas.SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.create_subscription(db, current_user, payload)

@router.get("/subscriptions", response_model=list[schemas.SubscriptionRead])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.list_subscriptions(db, current_user)

@router.put("/subscriptions/{item_id}", response_model=schemas.SubscriptionRead)
def update_subscription(
    item_id: int,
    payload: schemas.SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.update_subscription(db, current_user, item_id, payload)

@router.delete("/subscriptions/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.delete_subscription(db, current_user, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/subscriptions/{item_id}/pay")
def pay_subscription(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.pay_subscription(
        db,
        current_user,
        item_id,
        authorization=request.headers.get("authorization"),
    )
    return {"status": "success"}


@router.post("/debts", response_model=schemas.DebtRead, status_code=status.HTTP_201_CREATED)
def create_debt(
    payload: schemas.DebtCreate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.create_debt(db, current_user, payload)

@router.get("/debts", response_model=list[schemas.DebtRead])
def list_debts(
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.list_debts(db, current_user)

@router.put("/debts/{item_id}", response_model=schemas.DebtRead)
def update_debt(
    item_id: int,
    payload: schemas.DebtUpdate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.update_debt(db, current_user, item_id, payload)

@router.delete("/debts/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debt(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.delete_debt(db, current_user, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/debts/{item_id}/pay")
def pay_debt(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.pay_debt(
        db,
        current_user,
        item_id,
        authorization=request.headers.get("authorization"),
    )
    return {"status": "success"}


@router.post("/reminders", response_model=schemas.ReminderRead, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: schemas.ReminderCreate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.create_reminder(db, current_user, payload)

@router.get("/reminders", response_model=list[schemas.ReminderRead])
def list_reminders(
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.list_reminders(db, current_user)

@router.put("/reminders/{item_id}", response_model=schemas.ReminderRead)
def update_reminder(
    item_id: int,
    payload: schemas.ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    return service.update_reminder(db, current_user, item_id, payload)

@router.delete("/reminders/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_request_user),
):
    service.delete_reminder(db, current_user, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
