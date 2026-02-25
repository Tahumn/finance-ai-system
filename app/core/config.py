from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_url: str = "postgresql://finance_user:finance_pass@localhost:5432/finance_db"
    secret_key: str = Field(default="replace-me-in-env")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    otp_expire_minutes: int = 10
    dev_return_otp: bool = False
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
