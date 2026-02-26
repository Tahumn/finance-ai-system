from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict


class RegisterStartRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    # Allow digits with optional + and spaces/dashes; normalize later.
    phone: str | None = Field(default=None, pattern=r"^\+?[\d\s-]{6,20}$")


class UserLogin(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=100)
    password: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str = "OTP sent to email"
    code: str | None = None


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendOtpRequest(BaseModel):
    email: EmailStr


class PasswordResetStartRequest(BaseModel):
    email: EmailStr


class PasswordResetVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class PasswordResetVerifyResponse(BaseModel):
    reset_token: str


class PasswordResetConfirmRequest(BaseModel):
    reset_token: str
    password: str = Field(..., min_length=8)


class VerifyOtpResponse(BaseModel):
    registration_token: str


class SetPasswordRequest(BaseModel):
    registration_token: str
    password: str = Field(..., min_length=8)

