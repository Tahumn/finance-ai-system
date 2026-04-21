from __future__ import annotations

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    db_url: str = "postgresql://finance_user:finance_pass@postgres:5432/finance_db"
    db_schema: str | None = None

    # Security
    secret_key: str = Field(default="change-this-to-a-long-random-string")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Queue
    redis_url: str = "redis://redis:6379/0"
    queue_default_timeout: int = 300

    # Gemini
    gemini_api_key: Optional[str] = None
    gemini_model_name: str = "gemini-1.5-flash"
    gemini_model: str | None = None
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout_seconds: int = 15

    # Dify
    dify_api_base: str | None = None
    dify_api_key: str | None = None
    dify_force_json: bool = True
    dify_timeout_seconds: int = 20

    # OTP / Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    otp_expire_minutes: int = 10
    dev_return_otp: bool = False

    # OCR
    ocr_provider: str = "tesseract"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
