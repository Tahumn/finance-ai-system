from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict


class RegisterStartRequest(BaseModel):
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=6)
    email: EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str = "OTP sent to email"
    code: str | None = None


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=10)


class ResendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpResponse(BaseModel):
    registration_token: str


class SetPasswordRequest(BaseModel):
    registration_token: str
    password: str = Field(..., min_length=6)

