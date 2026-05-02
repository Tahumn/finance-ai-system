from fastapi import FastAPI
from app.database import ensure_schema
from app.recurring.router import router as recurring_router
from app.migrations import run_migrations

app = FastAPI(title="Recurring Service")

@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "recurring"}

@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    run_migrations("recurring")

app.include_router(recurring_router, prefix="/api/v1")
