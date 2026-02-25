from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import models as auth_models
from app.auth.router import router as auth_router
from app.database import Base, engine, ensure_schema
from app.finance import models as finance_models
from app.finance.router import router as finance_router

app = FastAPI(title="Finance AI Monolith")

# Dev-friendly CORS so the Vite React app can call the API (including when testing on a phone
# via LAN IP like http://192.168.x.x:5173).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    _ = (
        auth_models.User,
        auth_models.EmailOTP,
        finance_models.Category,
        finance_models.Transaction,
    )


app.include_router(auth_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
