from fastapi import FastAPI
from app.database import Base, engine, ensure_schema
from app.recurring import models as recurring_models
from app.recurring.router import router as recurring_router

app = FastAPI(title="Recurring Service")

@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "recurring"}

@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    Base.metadata.create_all(bind=engine)
    _ = (
        recurring_models.Subscription,
        recurring_models.Debt,
        recurring_models.Reminder,
    )

app.include_router(recurring_router, prefix="/api/v1")
