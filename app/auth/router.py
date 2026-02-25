from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.auth import schemas, service
from app.auth.models import User
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=schemas.RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: schemas.RegisterStartRequest, db: Session = Depends(get_db)):
    # Backward-compatible alias for register start.
    dev_code = service.start_register(db, payload)
    return schemas.RegisterResponse(code=dev_code)


@router.post(
    "/register/start",
    response_model=schemas.RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_start(payload: schemas.RegisterStartRequest, db: Session = Depends(get_db)):
    dev_code = service.start_register(db, payload)
    return schemas.RegisterResponse(code=dev_code)


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


@router.post("/verify-otp")
def verify_otp(payload: schemas.VerifyOtpRequest, db: Session = Depends(get_db)):
    return service.verify_email_otp(db, payload)


@router.post("/set-password")
def set_password(payload: schemas.SetPasswordRequest, db: Session = Depends(get_db)):
    return service.set_password(db, payload)


@router.post("/resend-otp")
def resend_otp(payload: schemas.ResendOtpRequest, db: Session = Depends(get_db)):
    return service.resend_email_otp(db, payload)


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: User = Depends(service.get_current_user)):
    return current_user

