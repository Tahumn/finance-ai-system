from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_url: str = "postgresql://finance_user:finance_pass@localhost:5432/finance_db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
