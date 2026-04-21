from fastapi import FastAPI

from app.auth import models as auth_models
from app.auth.router import router as auth_router
from app.database import Base, engine, ensure_schema

app = FastAPI(title="Auth Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "auth"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    Base.metadata.create_all(bind=engine)
    _ = (auth_models.User, auth_models.EmailOTP)


app.include_router(auth_router, prefix="/api/v1")
