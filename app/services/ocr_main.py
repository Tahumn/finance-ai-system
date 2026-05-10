from fastapi import FastAPI
from app.ocr.router import router as ocr_router
from app.database import ensure_schema

app = FastAPI(title="OCR Service")

@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "ocr"}

@app.on_event("startup")
def on_startup() -> None:
    # Ensure schema is ready, although OCR might not need its own tables 
    # it still shares the connection for auth context checks if needed.
    ensure_schema()

app.include_router(ocr_router, prefix="/api/v1")
