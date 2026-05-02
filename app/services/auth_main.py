from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.database import ensure_schema
from app.migrations import run_migrations

app = FastAPI(title="Auth Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "auth"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    run_migrations("auth")


app.include_router(auth_router, prefix="/api/v1")
