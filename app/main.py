from fastapi import FastAPI

from app.auth import models as auth_models
from app.auth.router import router as auth_router
from app.database import Base, engine
from app.finance import models as finance_models
from app.finance.router import router as finance_router

app = FastAPI(title="Finance AI Monolith")


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _ = (auth_models.User, finance_models.Category, finance_models.Transaction)


app.include_router(auth_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
