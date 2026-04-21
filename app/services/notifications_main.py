from fastapi import FastAPI

from app.database import Base, engine, ensure_schema
from app.notifications.router import router as notifications_router

app = FastAPI(title="Notification Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "notifications"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    Base.metadata.create_all(bind=engine)


app.include_router(notifications_router, prefix="/api/v1")
