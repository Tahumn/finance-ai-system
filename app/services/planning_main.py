from fastapi import FastAPI
from app.database import ensure_schema
from app.planning.router import router as planning_router
from app.core.kafka import KafkaConsumerManager
from app.migrations import run_migrations
from app.planning.worker import handle_finance_event

app = FastAPI(title="Planning Service")
consumer_manager = KafkaConsumerManager("finance.transactions", "planning_group", handle_finance_event)

@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "planning"}

@app.on_event("startup")
async def on_startup() -> None:
    ensure_schema()
    run_migrations("planning")
    await consumer_manager.start()

@app.on_event("shutdown")
async def on_shutdown() -> None:
    await consumer_manager.stop()

app.include_router(planning_router, prefix="/api/v1")
