from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.auth import schemas, service
from app.auth.models import User
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    return service.register_user(db, payload)


@router.post("/login", response_model=schemas.Token)
async def login(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")

    # Swagger UI "Authorize" uses OAuth2 password flow and sends form fields:
    # username=<email> & password=<password>
    if content_type.startswith("application/x-www-form-urlencoded") or content_type.startswith(
        "multipart/form-data"
    ):
        form = await request.form()
        email = form.get("username")
        password = form.get("password")
        payload = schemas.UserLogin(email=email, password=password)
        return service.authenticate_user(db, payload)

    # Support JSON login for React clients.
    data = await request.json()
    payload = schemas.UserLogin.model_validate(data)
    return service.authenticate_user(db, payload)


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: User = Depends(service.get_current_user)):
    return current_user

