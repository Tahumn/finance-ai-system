from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.ai_agent import models as ai_models
from app.ai_agent.router import router as ai_router
from app.auth import models as auth_models
from app.auth.router import router as auth_router
from app.database import ensure_schema
from app.finance import models as finance_models
from app.finance.router import router as finance_router
from app.migrations import run_migrations
from app.notifications.router import router as notifications_router
from app.ocr.router import router as ocr_router
from app.realtime import socket_app

app = FastAPI(title="Finance AI Monolith")

# Dev-friendly CORS so the Vite React app can call the API (including when testing on a phone
# via LAN IP like http://192.168.x.x:5173).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    run_migrations("monolith")
    _ = (
        auth_models.User,
        auth_models.EmailOTP,
        finance_models.Category,
        finance_models.Transaction,
        finance_models.Tag,
        finance_models.Account,
        finance_models.Transfer,
        finance_models.Budget,
        finance_models.SavingsGoal,
        finance_models.Bill,
        ai_models.ChatMessage,
    )

app.include_router(auth_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(ocr_router, prefix="/api/v1")

import os
if not os.path.exists("uploads"):
    os.makedirs("uploads")

app.mount("/ws", socket_app)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
