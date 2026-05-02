from fastapi import FastAPI

from app.database import ensure_schema
from app.migrations import run_migrations
from app.notifications.router import router as notifications_router

app = FastAPI(title="Notification Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "notifications"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    run_migrations("notifications")


app.include_router(notifications_router, prefix="/api/v1")
