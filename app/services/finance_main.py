from fastapi import FastAPI

from app.database import ensure_schema
from app.finance.router import router as finance_router
from app.core.kafka import producer_manager
from app.migrations import run_migrations

app = FastAPI(title="Finance Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "finance"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    run_migrations("finance")

@app.on_event("startup")
async def startup_event():
    await producer_manager.start()

@app.on_event("shutdown")
async def shutdown_event():
    await producer_manager.stop()

app.include_router(finance_router, prefix="/api/v1")
