from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.finance.router import router as finance_router

app = FastAPI(title="Finance AI Monolith")


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
