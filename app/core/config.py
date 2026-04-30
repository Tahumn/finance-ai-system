from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Cấu hình Cơ sở dữ liệu (PostgreSQL)
    db_url: str = "postgresql://finance_user:finance_pass@postgres:5432/finance_db"
    secret_key: str = Field(default="change-this-to-a-long-random-string")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Cấu hình Gemini AI (Lấy từ .env)
    gemini_api_key: Optional[str] = None
    gemini_model_name: str = "gemini-1.5-flash"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout_seconds: int = 15

    # Cấu hình OTP / Email (Đồ án FoodFast)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    otp_expire_minutes: int = 10
    dev_return_otp: bool = False
    
    # OCR Provider
    ocr_provider: str = "tesseract"

    # Tự động load từ file .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()