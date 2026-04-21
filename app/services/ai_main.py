from fastapi import FastAPI

from app.ai_agent import models as ai_models
from app.ai_agent.router import router as ai_router
from app.database import Base, engine, ensure_schema

app = FastAPI(title="AI Service")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "ai"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    Base.metadata.create_all(bind=engine)
    _ = (ai_models.ChatMessage,)


app.include_router(ai_router, prefix="/api/v1")
