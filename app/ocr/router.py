from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session
from app.ocr import ocr_processor
from app.ai_agent import schemas
from app.core.auth_context import RequestUser, get_active_request_user
from app.database import get_db

router = APIRouter(prefix="/ocr", tags=["ocr"])

@router.post("/scan", response_model=schemas.OcrResponse)
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: RequestUser = Depends(get_active_request_user),
):
    """Scan a receipt image and return extracted data."""
    payload = await file.read()
    result = ocr_processor.extract_ocr(payload, current_user_id=current_user.id, db=db)
    return result

@router.get("/health")
def healthcheck():
    return {"status": "ok", "service": "ocr"}
