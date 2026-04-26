from fastapi import FastAPI

from app.database import Base, engine, ensure_schema
from app.finance import models as finance_models
from app.finance.router import router as finance_router
from app.core.kafka import producer_manager

app = FastAPI(title="Finance Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "finance"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    Base.metadata.create_all(
        bind=engine,
        tables=[
            finance_models.Category.__table__,
            finance_models.Tag.__table__,
            finance_models.Account.__table__,
            finance_models.Transaction.__table__,
            finance_models.Transfer.__table__,
            finance_models.transaction_tags,
        ],
    )

@app.on_event("startup")
async def startup_event():
    await producer_manager.start()

@app.on_event("shutdown")
async def shutdown_event():
    await producer_manager.stop()

app.include_router(finance_router, prefix="/api/v1")
