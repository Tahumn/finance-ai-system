from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import schemas, service
from app.auth.models import User
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    return service.register_user(db, payload)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    return service.authenticate_user(db, payload)


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: User = Depends(service.get_current_user)):
    return current_user

