from fastapi import APIRouter

from app.auth import schemas, service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=dict)
def register(payload: schemas.UserCreate):
    return service.register_user(payload)


@router.post("/login", response_model=dict)
def login(payload: schemas.UserLogin):
    return service.authenticate_user(payload)

