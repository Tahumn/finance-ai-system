import io
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.ai_agent import schemas, service
from app.auth.models import User
from app.auth.service import get_current_active_user
from app.database import get_db
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)

OCR_ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
OCR_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
OCR_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
OCR_MIN_DIMENSION = 64
OCR_MAX_DIMENSION = 8000
OCR_MAX_PIXELS = 40_000_000


def _raise_ocr_error(
    status_code: int,
    error_code: str,
    message: str,
    trace_id: str,
    details: dict[str, object] | None = None,
) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={
            "success": False,
            "error_code": error_code,
            "message": message,
            "details": details or {},
            "trace_id": trace_id,
        },
    )


@router.post("/parse-transaction", response_model=schemas.ParseTransactionResponse)
def parse_transaction(
    payload: schemas.ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
    )


@router.post("/transactions", status_code=status.HTTP_201_CREATED)
def create_transaction_from_text(
    payload: schemas.ParseTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = service.parse_transaction_text(
        db=db,
        current_user=current_user,
        text=payload.text,
        default_date=payload.default_date,
        auto_create_category=payload.auto_create_category,
    )
    if result.get("amount") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to detect amount from text",
        )

    tx_payload = finance_schemas.TransactionCreate(
        description=result["description"],
        amount=result["amount"],
        transaction_type=result["transaction_type"],
        category_id=result.get("category_id"),
        account_id=result.get("account_id"),
        date=result.get("date"),
        tag_ids=result.get("tag_ids") or [],
    )
    return finance_service.create_transaction(db, current_user, tx_payload)


@router.post("/chat", response_model=schemas.ChatResponse)
def chat(
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.answer_chat(db, current_user, payload.text)


@router.get("/chat/history", response_model=schemas.ChatHistoryResponse)
def chat_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    messages = service.get_chat_history(db, current_user, limit=limit)
    return {"messages": messages}


@router.post("/ocr", response_model=schemas.OcrResponse)
async def ocr_receipt(
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_active_user),
):
    _ = current_user
    trace_id = uuid4().hex

    if file is None:
        _raise_ocr_error(
            status.HTTP_400_BAD_REQUEST,
            "OCR_INVALID_FILE",
            "Thiếu file upload.",
            trace_id,
        )

    filename = file.filename or ""
    if not filename.strip():
        _raise_ocr_error(
            status.HTTP_400_BAD_REQUEST,
            "OCR_INVALID_FILE",
            "Tên file không hợp lệ.",
            trace_id,
        )

    content_type = (file.content_type or "").lower().strip()
    ext = Path(filename).suffix.lower()
    if content_type not in OCR_ALLOWED_MIME_TYPES and ext not in OCR_ALLOWED_EXTENSIONS:
        _raise_ocr_error(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "OCR_UNSUPPORTED_FORMAT",
            "Định dạng file không được hỗ trợ. Chỉ chấp nhận jpg, jpeg, png, webp.",
            trace_id,
            details={"content_type": content_type, "extension": ext},
        )

    payload = await file.read()
    size_bytes = len(payload or b"")
    if size_bytes == 0:
        _raise_ocr_error(
            status.HTTP_400_BAD_REQUEST,
            "OCR_INVALID_FILE",
            "File rỗng.",
            trace_id,
        )

    if size_bytes > OCR_MAX_FILE_SIZE_BYTES:
        _raise_ocr_error(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "OCR_FILE_TOO_LARGE",
            "File quá lớn, vui lòng dùng ảnh dưới 8MB.",
            trace_id,
            details={"size_bytes": size_bytes, "max_size_bytes": OCR_MAX_FILE_SIZE_BYTES},
        )

    try:
        with Image.open(io.BytesIO(payload)) as img:
            width, height = img.size
    except (UnidentifiedImageError, OSError):
        _raise_ocr_error(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "OCR_UNSUPPORTED_FORMAT",
            "Không thể đọc file ảnh hợp lệ.",
            trace_id,
            details={"filename": filename, "content_type": content_type},
        )
        return  # pragma: no cover

    if width < OCR_MIN_DIMENSION or height < OCR_MIN_DIMENSION:
        _raise_ocr_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "OCR_INVALID_IMAGE_DIMENSIONS",
            "Ảnh quá nhỏ để OCR.",
            trace_id,
            details={"width": width, "height": height, "min_dimension": OCR_MIN_DIMENSION},
        )

    if width > OCR_MAX_DIMENSION or height > OCR_MAX_DIMENSION or width * height > OCR_MAX_PIXELS:
        _raise_ocr_error(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "OCR_FILE_TOO_LARGE",
            "Kích thước ảnh quá lớn để xử lý an toàn.",
            trace_id,
            details={
                "width": width,
                "height": height,
                "max_dimension": OCR_MAX_DIMENSION,
                "max_pixels": OCR_MAX_PIXELS,
            },
        )

    logger.info(
        "ocr_request_received trace_id=%s filename=%s content_type=%s size=%s",
        trace_id,
        filename,
        content_type,
        size_bytes,
    )

    try:
        result = service.extract_ocr(
            payload,
            trace_id=trace_id,
            filename=filename,
            content_type=content_type,
        )
    except service.OcrProcessingError as exc:
        logger.warning(
            "ocr_request_failed trace_id=%s code=%s message=%s details=%s",
            trace_id,
            exc.error_code,
            exc.message,
            exc.details,
        )
        _raise_ocr_error(exc.status_code, exc.error_code, exc.message, trace_id, exc.details)
        return  # pragma: no cover
    except Exception as exc:
        logger.exception("ocr_request_failed_unexpected trace_id=%s", trace_id)
        _raise_ocr_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "OCR_INTERNAL_ERROR",
            "Lỗi nội bộ khi xử lý OCR.",
            trace_id,
            details={"error": str(exc)},
        )
        return  # pragma: no cover

    return result


@router.get("/anomalies", response_model=schemas.AnomalyListResponse)
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return {"alerts": service.get_spending_anomalies(db, current_user)}


@router.get("/forecast", response_model=schemas.ForecastResponse)
def get_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.get_spending_forecast(db, current_user)


@router.get("/savings-tips", response_model=schemas.SavingTipsResponse)
def get_savings_tips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return service.get_savings_suggestions(db, current_user)

