from fastapi import FastAPI

from app.ai_agent.router import router as ai_router
from app.database import ensure_schema
from app.migrations import run_migrations

app = FastAPI(title="AI Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "ai"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    run_migrations("ai")


app.include_router(ai_router, prefix="/api/v1")
