from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth import schemas
from app.auth.email import send_otp_email
from app.auth.models import EmailOTP, User
from app.auth.security import create_access_token, decode_token, hash_password, verify_password
from app.database import get_db
from app.core.config import settings
from jose import jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _hash_otp(code_salt: str, code: str) -> str:
    return hashlib.sha256(f"{code_salt}:{code}".encode("utf-8")).hexdigest()


def _create_and_send_email_otp(db: Session, db_user: User) -> str | None:
    code = f"{secrets.randbelow(1_000_000):06d}"
    salt = secrets.token_hex(16)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)
    otp = EmailOTP(
        user_id=db_user.id,
        code_salt=salt,
        code_hash=_hash_otp(salt, code),
        expires_at=expires_at,
        consumed_at=None,
    )
    db.add(otp)
    db.commit()

    try:
        send_otp_email(to_email=db_user.email, code=code)
    except RuntimeError as exc:
        # Allow local testing without SMTP configured.
        if settings.dev_return_otp:
            return code
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return code if settings.dev_return_otp else None


def start_register(db: Session, user: schemas.RegisterStartRequest) -> str | None:
    exists = db.query(User).filter(User.email == user.email).first()
    if exists:
        # If not yet verified, allow updating profile + resend OTP.
        if exists.email_verified:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

        exists.first_name = user.first_name
        exists.last_name = user.last_name
        exists.phone = user.phone
        # No password yet; prevent login until set_password marks the account active.
        exists.hashed_password = hash_password(secrets.token_urlsafe(24))
        exists.is_active = False
        db.commit()
        return _create_and_send_email_otp(db, exists)

    db_user = User(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        hashed_password=hash_password(secrets.token_urlsafe(24)),
        email_verified=False,
        is_active=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    _create_and_send_email_otp(db, db_user)
    return _create_and_send_email_otp(db, db_user)


def authenticate_user(db: Session, user: schemas.UserLogin) -> schemas.Token:
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not db_user.email_verified or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified",
        )

    token = create_access_token(subject=str(db_user.id), email=db_user.email)
    return schemas.Token(access_token=token)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from None

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return db_user


def _create_registration_token(*, user_id: int, email: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "purpose": "set_password",
        "exp": exp,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _decode_registration_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except Exception:
        return {}


def verify_email_otp(db: Session, payload: schemas.VerifyOtpRequest) -> schemas.VerifyOtpResponse:
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = datetime.now(timezone.utc)
    otps = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.user_id == db_user.id,
            EmailOTP.consumed_at.is_(None),
            EmailOTP.expires_at > now,
        )
        .order_by(EmailOTP.created_at.desc(), EmailOTP.id.desc())
        .all()
    )
    if not otps:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is expired")

    matched = None
    for otp in otps:
        if _hash_otp(otp.code_salt, payload.code) == otp.code_hash:
            matched = otp
            break
    if not matched:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")

    matched.consumed_at = now
    db_user.email_verified = True
    db_user.is_active = False
    db.commit()
    return schemas.VerifyOtpResponse(
        registration_token=_create_registration_token(user_id=db_user.id, email=db_user.email)
    )


def set_password(db: Session, payload: schemas.SetPasswordRequest) -> dict:
    decoded = _decode_registration_token(payload.registration_token)
    if not decoded or decoded.get("purpose") != "set_password":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = decoded.get("sub")
    email = decoded.get("email")
    if not sub or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from None

    db_user = db.query(User).filter(User.id == user_id, User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not db_user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

    db_user.hashed_password = hash_password(payload.password)
    db_user.is_active = True
    db.commit()
    return {"message": "Password set"}


def resend_email_otp(db: Session, payload: schemas.ResendOtpRequest) -> dict:
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if db_user.email_verified and db_user.is_active:
        return {"message": "Already verified"}

    _create_and_send_email_otp(db, db_user)
    return {"message": "OTP sent to email"}

