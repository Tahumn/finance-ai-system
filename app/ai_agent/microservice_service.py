from __future__ import annotations

from collections import defaultdict
from datetime import date as DateType, datetime, timedelta
import io
import os
import re
import unicodedata
from typing import Any

import httpx
from fastapi import HTTPException, status
from PIL import Image
import pytesseract
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.ai_agent.models import ChatMessage
from app.core.auth_context import RequestUser
from app.core.config import settings
import json


def _extract_json(text: str) -> dict:
    """Extract JSON object from Gemini response text (handles markdown fences)."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Handle cases like ```json ... ``` or just ``` ... ```
        start_idx = 1
        if lines[0].strip().lower().startswith("```json"):
            start_idx = 1
        text = "\n".join(lines[start_idx:-1] if lines[-1].strip() == "```" else lines[start_idx:])
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find the first '{' and last '}'
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def _service_url(env_key: str, default: str) -> str:
    return os.getenv(env_key, default).rstrip("/")


FINANCE_API_BASE = f"{_service_url('FINANCE_SERVICE_URL', 'http://finance:8000')}/api/v1/finance"
PLANNING_API_BASE = f"{_service_url('PLANNING_SERVICE_URL', 'http://planning:8000')}/api/v1/planning"
RECURRING_API_BASE = f"{_service_url('RECURRING_SERVICE_URL', 'http://recurring:8000')}/api/v1/recurring"

AMOUNT_REGEX = re.compile(
    r"(?P<num>\d+(?:[.,]\d+)*)\s*(?P<unit>k|nghin|ngan|tr|trieu|m|million|ty|ti|cu|lit|xi)\b|(?P<num_simple>\d+(?:[.,]\d+)*)",
    re.IGNORECASE,
)
DATE_DDMM_REGEX = re.compile(r"(?P<day>\d{1,2})[./-](?P<month>\d{1,2})(?:[./-](?P<year>\d{2,4}))?")
DATE_ISO_REGEX = re.compile(r"(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})")

OCR_TOTAL_KEYWORDS = (
    "tong cong", "tong tien", "tong", "cong", "thanh toan", "phai thanh toan",
    "phai tra", "tong thanh toan", "tong tien thanh toan", "tong gia tri thanh toan",
    "so tien", "amount due", "grand total", "total", "pay"
)
OCR_SUBTOTAL_KEYWORDS = (
    "tam tinh", "subtotal", "thue", "vat", "tax", "phi", "giam gia",
    "discount", "chiet khau", "tien thua", "change", "tien khach", "cash"
)
OCR_VAT_KEYWORDS = ("vat", "thue gtgt", "tien thue", "thue", "tax", "gtgt")
OCR_ESTIMATE_KEYWORDS = (
    "tam tinh", "subtotal", "estimated", "uoc tinh", "du kien",
    "tong truoc thue", "gia truoc thue", "cong tien hang", "tien hang"
)
OCR_PRETAX_KEYWORDS = ("truoc thue", "pre tax", "before tax")
CURRENCY_HINTS = ("vnd", "dong", "đ", "usd", "$", "eur", "yen", "jpy")

TOTAL_HINTS = ("tong cong", "tong tien", "tong thanh toan", "grand total", "amount due", "total")
INCOME_KEYWORDS = ("thu", "luong", "nhan", "bonus", "hoan tien", "lai", "lanh", "thuong", "duoc cho")
EXPENSE_KEYWORDS = ("chi", "mua", "tra", "thanh toan", "an", "uong", "xang", "phi", "mat", "ton")
SUMMARY_KEYWORDS = ("tong", "bao nhieu", "thang nay", "tuan nay", "hom nay", "thang truoc", "so du", "con lai")
UPDATE_KEYWORDS = ("sua", "cap nhat", "doi", "chinh sua", "nham")
DELETE_KEYWORDS = ("xoa", "huy", "bo")
ANOMALY_KEYWORDS = ("bat thuong", "anomaly", "dot bien")
FORECAST_KEYWORDS = ("du bao", "forecast", "thang toi", "thang sau")
SAVING_KEYWORDS = ("tiet kiem", "goi y", "toi uu", "cat giam")
BUDGET_KEYWORDS = ("ngan sach", "han muc", "set budget", "dinh muc")
DEBT_KEYWORDS = (" no ", " vay ", " muon ", " nợ ", " vay ", " mượn ")
RECURRING_KEYWORDS = ("dinh ky", "hang thang", "thanh toan hang", "netflix", "spotify", "icloud")

UNIT_MULTIPLIER = {
    "k": 1_000,
    "nghin": 1_000,
    "ngan": 1_000,
    "tr": 1_000_000,
    "trieu": 1_000_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "ty": 1_000_000_000,
    "ti": 1_000_000_000,
    "cu": 1_000_000,
    "lit": 100_000,
    "xi": 10_000,
}

CATEGORY_KEYWORDS = {
    "an": "Ăn uống", "pho": "Ăn uống", "com": "Ăn uống", "bun": "Ăn uống", "mi": "Ăn uống", "sua": "Ăn uống", "cafe": "Ăn uống", "tra": "Ăn uống", "nhau": "Ăn uống", "an uong": "Ăn uống",
    "xang": "Di chuyển", "grab": "Di chuyển", "taxi": "Di chuyển", "xe": "Di chuyển", "gui xe": "Di chuyển", "bus": "Di chuyển", "di chuyen": "Di chuyển",
    "shopee": "Mua sắm", "tiki": "Mua sắm", "lazada": "Mua sắm", "quan ao": "Mua sắm", "giay": "Mua sắm", "my pham": "Mua sắm", "sieu thi": "Mua sắm", "cho": "Mua sắm", "mua sam": "Mua sắm",
    "dien": "Hóa đơn", "nuoc": "Hóa đơn", "internet": "Hóa đơn", "wifi": "Hóa đơn", "4g": "Hóa đơn", "dien thoai": "Hóa đơn", "hoc phi": "Hóa đơn", "hoa don": "Hóa đơn",
    "luong": "Lương", "thuong": "Thưởng", "nhan": "Thu nhập khác", "duoc cho": "Thu nhập khác", "ban do": "Thu nhập khác",
    "me cho": "Thu nhập khác", "bo cho": "Thu nhập khác", "ba cho": "Thu nhập khác", "ong cho": "Thu nhập khác", "anh cho": "Thu nhập khác",
    "li xi": "Thu nhập khác", "tang": "Thu nhập khác", "duoc tang": "Thu nhập khác", "thu nhap": "Thu nhập khác",
    "thuoc": "Sức khỏe", "benh": "Sức khỏe", "kham": "Sức khỏe", "gym": "Sức khỏe", "suc khoe": "Sức khỏe",
    "phim": "Giải trí", "game": "Giải trí", "du lich": "Giải trí", "hat ho": "Giải trí", "giai tri": "Giải trí",
    "tiet kiem": "Tiết kiệm",
}


def _is_greeting(text: str) -> bool:
    normalized = _normalize_text(text)
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return False
    greetings = {
        "xin chao", "chao", "hello", "hi", "hey",
        "chao ban", "alo", "he lo", "hi ban"
    }
    if normalized in greetings:
        return True
    return bool(re.search(r"\b(xin\s*chao|chao|hello|hi|hey|alo)\b", normalized))


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _coerce_date(value: str | DateType | None) -> DateType | None:
    if value is None:
        return None
    if isinstance(value, DateType):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_number(raw: str) -> float:
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        if raw.count(",") == 1 and len(raw.split(",")[-1]) <= 2:
            raw = raw.replace(",", ".")
        else:
            raw = raw.replace(",", "")
    return float(raw)


def _looks_like_date_fragment(text: str, start: int, end: int) -> bool:
    prev_char = text[start - 1] if start > 0 else ""
    next_char = text[end] if end < len(text) else ""
    return prev_char in "/-." or next_char in "/-."


def _extract_amount(text: str) -> float | None:
    normalized = _normalize_text(text)
    has_half = "ruoi" in normalized
    
    candidates: list[float] = []
    for match in AMOUNT_REGEX.finditer(normalized):
        # Lấy số từ group 'num' hoặc 'num_simple'
        raw_num = match.group("num") or match.group("num_simple")
        if not raw_num:
            continue
            
        # Kiểm tra xem có phải là một phần của ngày tháng không (ví dụ: 27/04)
        # Chỉ kiểm tra date fragment nếu KHÔNG có đơn vị đi kèm (như k, triệu...)
        unit = (match.group("unit") or "").lower()
        if not unit and _looks_like_date_fragment(normalized, match.start(), match.end()):
            continue
            
        try:
            value = _parse_number(raw_num)
        except ValueError:
            continue
        
        if unit in UNIT_MULTIPLIER:
            multiplier = UNIT_MULTIPLIER[unit]
            value *= multiplier
            if has_half:
                value += (multiplier * 0.5)
        elif value < 1_000 and any(keyword in normalized for keyword in INCOME_KEYWORDS + EXPENSE_KEYWORDS):
            # Nếu là số nhỏ (<1000) và xuất hiện trong ngữ cảnh giao dịch, mặc định là nghìn
            value *= 1_000
            
        if value > 0:
            candidates.append(float(value))
    
    return sum(candidates) if candidates else None


def _extract_date(text: str, default_date: DateType | None) -> DateType:
    normalized = _normalize_text(text)
    today = DateType.today()
    if "hom qua" in normalized:
        return today - timedelta(days=1)
    if "hom nay" in normalized:
        return today

    iso_match = DATE_ISO_REGEX.search(normalized)
    if iso_match:
        try:
            return DateType(
                int(iso_match.group("year")),
                int(iso_match.group("month")),
                int(iso_match.group("day")),
            )
        except ValueError:
            pass

    ddmm_match = DATE_DDMM_REGEX.search(normalized)
    if ddmm_match:
        try:
            year = ddmm_match.group("year")
            parsed_year = int(year) if year else today.year
            if parsed_year < 100:
                parsed_year += 2000
            return DateType(
                parsed_year,
                int(ddmm_match.group("month")),
                int(ddmm_match.group("day")),
            )
        except ValueError:
            pass

    return default_date or today


def _detect_transaction_type(text: str) -> str:
    normalized = _normalize_text(text)
    # Check for strong income patterns first
    income_patterns = [
        r"\bduoc\s+\w+\s+cho\b",  # e.g., "duoc me cho", "duoc bo cho"
        r"\b(?:me|bo|ba|ong|anh|ban|sep|nguoi yeu)\s+cho\b",  # e.g., "me cho", "bo cho"
        r"\b(?:thu|luong|nhan|bonus|hoan tien|lai|lanh|thuong|duoc cho|li xi|tang|tro cap|cap tien)\b",
    ]
    for pattern in income_patterns:
        if re.search(pattern, normalized):
            return "income"
    if False:
        return "income"
    if any(keyword in normalized for keyword in EXPENSE_KEYWORDS):
        return "expense"
    return "expense"


def _pick_category_name(text: str) -> str | None:
    normalized = _normalize_text(text)
    # Sort keywords by length in descending order to match longer/more specific phrases first
    sorted_keywords = sorted(CATEGORY_KEYWORDS.items(), key=lambda x: len(x[0]), reverse=True)
    for keyword, category in sorted_keywords:
        if re.search(rf"\b{keyword}\b", normalized):
            return category
    return None


def _split_transaction_segments(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    parts = re.split(
        r",|;|&|\b(?:va|và|nhung|nhưng|roi|rồi|sau do|sau đó|cung voi|cùng với|kem theo|kèm theo|kem|kèm)\b",
        text,
        flags=re.IGNORECASE,
    )
    parts = [part.strip(" ,.;") for part in parts if part and part.strip(" ,.;")]
    return parts if parts else [text.strip()]


def _require_authorization(authorization: str | None) -> dict[str, str]:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )
    return {"Authorization": authorization}


def _service_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict) and payload.get("detail"):
            return str(payload["detail"])
    except Exception:
        pass
    return response.text.strip() or "Service request failed"


def _request_json(
    method: str,
    path: str,
    authorization: str | None,
    *,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
    service: str = "finance"
) -> Any:
    headers = _require_authorization(authorization)
    if service == "planning":
        base_url = PLANNING_API_BASE
    elif service == "recurring":
        base_url = RECURRING_API_BASE
    else:
        base_url = FINANCE_API_BASE
        
    url = f"{base_url}{path}"
    with httpx.Client(timeout=15.0) as client:
        response = client.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=payload,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Finance service error: {_service_error_detail(response)}",
        )
    if response.status_code == status.HTTP_204_NO_CONTENT:
        return None
    if not response.content:
        return {}
    return response.json()


def _list_categories(authorization: str | None) -> list[dict[str, Any]]:
    payload = _request_json("GET", "/categories", authorization)
    if isinstance(payload, list):
        return payload
    return []


def _extract_custom_category(text: str) -> str | None:
    # Lowercase and normalize spaces
    normalized = text.lower().strip()
    # Find position of budget keywords
    budget_kw_match = re.search(r"\b(ngân sách|ngan sach|hạn mức|han muc)\b", normalized)
    if not budget_kw_match:
        return None
    
    # Extract everything after the budget keyword
    after_kw = normalized[budget_kw_match.end():].strip()
    
    # Find the amount pattern (e.g. 2 triệu, 2tr, 200k, 2.000.000)
    amount_match = re.search(r"\b\d", after_kw)
    if not amount_match:
        return None
        
    # The text between the budget keyword and the amount is the category name
    cat_text = after_kw[:amount_match.start()].strip()
    
    # Clean up filler words from the extracted category text
    cat_text = re.sub(r"^(?:cho|cua|ve|cho\s+muc|khoan|chi|ve\s+muc)\s+", "", cat_text)
    cat_text = re.sub(r"\s+(?:la|khoang|tam|du tinh)$", "", cat_text)
    cat_text = cat_text.strip()
    
    # Capitalize the first letter for a clean category name in DB (e.g. "Mua sắm")
    if cat_text:
        return cat_text.capitalize()
    return None


def _resolve_category(
    text: str,
    category_name: str | None,
    auto_create_category: bool,
    authorization: str | None,
) -> tuple[int | None, str | None]:
    chosen_name = category_name or _pick_category_name(text)
    if not chosen_name:
        chosen_name = _extract_custom_category(text)
    if not chosen_name:
        return None, None

    normalized_target = _normalize_text(chosen_name)
    categories = _list_categories(authorization)

    for category in categories:
        name = str(category.get("name") or "")
        if _normalize_text(name) == normalized_target:
            category_id = category.get("id")
            return int(category_id), name

    if auto_create_category:
        created = _request_json(
            "POST",
            "/categories",
            authorization,
            payload={"name": chosen_name},
        )
        category_id = created.get("id")
        return int(category_id), str(created.get("name") or chosen_name)

    return None, chosen_name




def get_gemini_response(prompt: str, system_instruction: str) -> dict:
    url = f"{settings.gemini_api_base}/models/{settings.gemini_model_name}:generateContent?key={settings.gemini_api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.3
        }
    }
    try:
        with httpx.Client(timeout=settings.gemini_timeout_seconds) as client:
            response = client.post(url, json=payload)
            if response.status_code == 429:
                return {"error": "Rate limit", "intent": "rate_limit_error"}
            if response.status_code in [401, 403]:
                return {"error": "Auth error", "intent": "auth_error"}
            response.raise_for_status()
            data = response.json()
            ai_text = data['candidates'][0]['content']['parts'][0]['text']
            return _extract_json(ai_text)
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {"error": "Network error", "intent": "network_error"}


def ai_parse_transaction(text: str) -> dict:
    sys_inst = (
        "Bạn là chuyên gia AI phân tích tài chính cá nhân toàn diện dành cho người Việt.\n"
        "Nhiệm vụ: Phân tích câu nói và trích xuất thông tin phù hợp với một trong các ý định (intent) sau:\n\n"
        "1. 'create_transaction': Ghi chép thu/chi ĐÃ XẢY RA (ví dụ: 'vừa ăn phở', 'mới nhận lương', 'được mẹ cho 500k').\n"
        "2. 'create_budget': Thiết lập kế hoạch chi tiêu TƯƠNG LAI, hạn mức (ví dụ: 'Đặt ngân sách', 'Hạn mức tháng này là...'). Tuyệt đối không nhầm sang create_transaction nếu người dùng nói về 'ngân sách' hoặc 'hạn mức'.\n"
        "3. 'create_debt': Ghi chép nợ/vay.\n"
        "4. 'create_subscription': Đăng ký dịch vụ lặp lại hàng tháng.\n\n"
        "QUY TẮC BẮT BUỘC:\n"
        "1. PHÂN TÁCH GIAO DỊCH (SPLIT TRANSACTIONS):\n"
        "   - Nếu câu nói chứa NHIỀU giao dịch khác nhau hoặc các khoản thu và chi khác nhau (ví dụ: 'được mẹ cho 500k, ăn hết 100k, đổ xăng 50k' hoặc 'chi 50k ăn sáng và 30k cafe'), bạn PHẢI tự tách chúng thành các giao dịch riêng biệt trong mảng `transactions` và đặt `is_multiple` là true.\n"
        "   - Mỗi giao dịch trong mảng `transactions` phải có đầy đủ các trường: `intent` (thường là 'create_transaction'), `amount` (number, ví dụ: 500000, 100000, 50000), `transaction_type` ('income' hoặc 'expense'), `category_name`, `date` (định dạng 'YYYY-MM-DD'), và `description` (nội dung giao dịch ngắn gọn, ví dụ: 'Được mẹ cho', 'Ăn uống', 'Đổ xăng').\n"
        "   - Nếu người dùng chỉ nhập một phép tính đơn giản của cùng một giao dịch (ví dụ: '30k + 25k' cho cùng một mục phở) hoặc chỉ có duy nhất một giao dịch, hãy trả về `is_multiple` là false và điền trực tiếp các trường ở ngoài cùng (không dùng mảng `transactions`).\n"
        "2. SỐ TIỀN (amount): Trích xuất chính xác số tiền. Nếu là giao dịch đơn lẻ và người dùng nhập phép tính (ví dụ: '30k + 25k'), bạn phải TỰ CỘNG lại và trả về con số TỔNG CUỐI CÙNG (55000).\n"
        "3. PHÂN LOẠI THU/CHI (transaction_type): BẮT BUỘC xác định rõ 'income' (nếu là khoản thu như nhận lương, thưởng, được cho tiền, đòi nợ...) hoặc 'expense' (nếu là khoản chi như mua sắm, ăn uống, đi lại, trả nợ...). Phải luôn có trường này.\n"
        "4. DANH MỤC (category_name): Gán vào các nhóm phù hợp (Ăn uống, Di chuyển, Mua sắm, Lương, Sức khỏe, Giải trí, Thu nhập khác...). 'mẹ cho' -> 'Thu nhập khác'; 'ăn uống/ăn phở/cafe' -> 'Ăn uống'; 'đổ xăng/grab' -> 'Di chuyển'.\n"
        "5. NGÀY (date): Định dạng 'YYYY-MM-DD'.\n"
        "6. MÔ TẢ (description): Nội dung giao dịch ngắn gọn.\n\n"
        "ĐỊNH DẠNG JSON TRẢ VỀ:\n"
        "- Nếu `is_multiple` là false:\n"
        "{\n"
        "  \"is_multiple\": false,\n"
        "  \"intent\": \"create_transaction\",\n"
        "  \"amount\": 500000,\n"
        "  \"transaction_type\": \"income\",\n"
        "  \"category_name\": \"Thu nhập khác\",\n"
        "  \"date\": \"2026-05-17\",\n"
        "  \"description\": \"Mới được mẹ cho\"\n"
        "}\n"
        "- Nếu `is_multiple` là true:\n"
        "{\n"
        "  \"is_multiple\": true,\n"
        "  \"transactions\": [\n"
        "    {\n"
        "      \"intent\": \"create_transaction\",\n"
        "      \"amount\": 500000,\n"
        "      \"transaction_type\": \"income\",\n"
        "      \"category_name\": \"Thu nhập khác\",\n"
        "      \"date\": \"2026-05-17\",\n"
        "      \"description\": \"Mới được mẹ cho\"\n"
        "    },\n"
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "TRẢ VỀ DUY NHẤT JSON. KHÔNG GIẢI THÍCH THÊM."
    )
    return get_gemini_response(text, sys_inst)

def ai_parse_transaction_old_obsolete(text: str) -> dict:
    sys_inst = (
        "Bạn là chuyên gia AI phân tích tài chính cá nhân toàn diện dành cho người Việt.\n"
        "Nhiệm vụ: Phân tích câu nói và trích xuất thông tin phù hợp với một trong các ý định (intent) sau:\n\n"
        "1. 'create_transaction': Ghi chép thu/chi ĐÃ XẢY RA (ví dụ: 'vừa ăn phở', 'mới nhận lương', 'được mẹ cho 500k').\n"
        "2. 'create_budget': Thiết lập kế hoạch chi tiêu TƯƠNG LAI, hạn mức (ví dụ: 'Đặt ngân sách', 'Hạn mức tháng này là...'). Tuyệt đối không nhầm sang create_transaction nếu người dùng nói về 'ngân sách' hoặc 'hạn mức'.\n"
        "3. 'create_debt': Ghi chép nợ/vay.\n"
        "4. 'create_subscription': Đăng ký dịch vụ lặp lại hàng tháng.\n\n"
        "QUY TẮC BẮT BUỘC:\n"
        "1. PHÂN TÁCH GIAO DỊCH (SPLIT TRANSACTIONS):\n"
        "   - Nếu câu nói chứa NHIỀU giao dịch khác nhau hoặc các khoản thu và chi khác nhau (ví dụ: 'được mẹ cho 500k, ăn hết 100k, đổ xăng 50k' hoặc 'chi 50k ăn sáng và 30k cafe'), bạn PHẢI tự tách chúng thành các giao dịch riêng biệt trong mảng `transactions` và đặt `is_multiple` là true.\n"
        "   - Mỗi giao dịch trong mảng `transactions` phải có đầy đủ các trường: `intent` (thường là 'create_transaction'), `amount` (number, ví dụ: 500000, 100000, 50000), `transaction_type` ('income' hoặc 'expense'), `category_name`, `date` (định dạng 'YYYY-MM-DD'), và `description` (nội dung giao dịch ngắn gọn, ví dụ: 'Được mẹ cho', 'Ăn uống', 'Đổ xăng').\n"
        "   - Nếu người dùng chỉ nhập một phép tính đơn giản của cùng một giao dịch (ví dụ: '30k + 25k' cho cùng một mục phở) hoặc chỉ có duy nhất một giao dịch, hãy trả về `is_multiple` là false và điền trực tiếp các trường ở ngoài cùng (không dùng mảng `transactions`).\n"
        "2. SỐ TIỀN (amount): Trích xuất chính xác số tiền. Nếu là giao dịch đơn lẻ và người dùng nhập phép tính (ví dụ: '30k + 25k'), bạn phải TỰ CỘNG lại và trả về con số TỔNG CUỐI CÙNG (55000).\n"
        "3. Nếu câu nói có từ 'ngân sách' hoặc 'hạn mức', intent PHẢI LÀ 'create_budget'.\n"
        "4. DANH MỤC (category_name): Gán vào các nhóm phù hợp (Ăn uống, Di chuyển, Mua sắm, Lương, Sức khỏe, Giải trí, Thu nhập khác...). 'mẹ cho' -> 'Thu nhập khác'; 'ăn uống/ăn phở/cafe' -> 'Ăn uống'; 'đổ xăng/grab' -> 'Di chuyển'.\n"
        "5. NGÀY (date): Định dạng 'YYYY-MM-DD'.\n"
        "6. MÔ TẢ (description): Nội dung giao dịch ngắn gọn.\n\n"
        "TRẢ VỀ DUY NHẤT JSON. KHÔNG GIẢI THÍCH."
    )
    return get_gemini_response(text, sys_inst)


def parse_transaction_text(
    db: Session,
    current_user: RequestUser,
    text: str,
    default_date: DateType | None = None,
    auto_create_category: bool = True,
    authorization: str | None = None,
) -> dict[str, Any]:
    _ = (db, current_user)
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text is required")

    warnings: list[str] = []
    
    # AI Fallback: Attempt Gemini extraction first
    ai_data = ai_parse_transaction(cleaned_text)
    
    if ai_data and not ai_data.get("error") and ai_data.get("is_multiple"):
        resolved_transactions = []
        for tx in ai_data.get("transactions", []):
            tx_amount = tx.get("amount")
            tx_type = tx.get("transaction_type") or "expense"
            tx_category_name = tx.get("category_name")
            tx_desc = tx.get("description") or cleaned_text
            tx_date = _coerce_date(tx.get("date")) or default_date or DateType.today()
            
            cat_id, resolved_cat_name = _resolve_category(
                tx_desc,
                tx_category_name,
                auto_create_category,
                authorization,
            )
            
            resolved_transactions.append({
                "description": tx_desc,
                "amount": tx_amount,
                "transaction_type": tx_type,
                "category_id": cat_id,
                "category_name": resolved_cat_name,
                "date": tx_date,
                "intent": tx.get("intent") or "create_transaction",
            })
        
        if resolved_transactions:
            first_parsed = resolved_transactions[0].copy()
            first_parsed["warnings"] = warnings
            first_parsed["confidence"] = 0.8
            first_parsed["is_multiple"] = True
            first_parsed["transactions"] = resolved_transactions
            return first_parsed

    if ai_data and not ai_data.get("error"):
        amount = ai_data.get("amount")
        transaction_type = ai_data.get("transaction_type") or "expense"
        resolved_name = ai_data.get("category_name")
        description = ai_data.get("description") or cleaned_text
        parsed_date = _coerce_date(ai_data.get("date")) or default_date or DateType.today()
    else:
        # Fallback to pure regex if AI fails (Network error, etc.)
        amount = _extract_amount(cleaned_text)
        transaction_type = _detect_transaction_type(cleaned_text)
        resolved_name = _pick_category_name(cleaned_text)
        description = cleaned_text
        parsed_date = _extract_date(cleaned_text, default_date)

    if amount is None:
        warnings.append("amount_not_found")

    category_id, resolved_name = _resolve_category(
        description,
        resolved_name,
        auto_create_category,
        authorization,
    )

    confidence = 0.8 if ai_data and not ai_data.get("error") else 0.4

    return {
        "description": description,
        "amount": amount,
        "transaction_type": transaction_type,
        "category_id": category_id,
        "category_name": resolved_name,
        "date": parsed_date,
        "warnings": warnings,
        "confidence": confidence,
        "intent": ai_data.get("intent") if ai_data else "create_transaction",
        "period": ai_data.get("period") if ai_data else None,
        "frequency": ai_data.get("frequency") if ai_data else None,
        "is_multiple": False,
    }


def create_transaction_from_parsed(
    parsed: dict[str, Any],
    *,
    fallback_text: str,
    authorization: str | None,
) -> dict[str, Any]:
    amount = parsed.get("amount")
    if amount is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to detect amount from text",
        )

    tx_date = _coerce_date(parsed.get("date")) or DateType.today()
    payload = {
        "description": parsed.get("description") or fallback_text,
        "amount": float(amount),
        "transaction_type": parsed.get("transaction_type") or "expense",
        "category_id": parsed.get("category_id"),
        "account_id": parsed.get("account_id"),
        "date": tx_date.isoformat(),
        "tag_ids": parsed.get("tag_ids") or [],
    }
    return _request_json("POST", "/transactions", authorization, payload=payload)


def _list_transactions(
    authorization: str | None,
    *,
    start_date: DateType | None = None,
    end_date: DateType | None = None,
    transaction_type: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"limit": max(1, min(limit, 500)), "offset": 0}
    if start_date:
        params["start_date"] = start_date.isoformat()
    if end_date:
        params["end_date"] = end_date.isoformat()
    if transaction_type:
        params["transaction_type"] = transaction_type
    payload = _request_json("GET", "/transactions", authorization, params=params)
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        return payload["items"]
    return []


def _summary_range(text: str) -> tuple[DateType, DateType]:
    normalized = _normalize_text(text)
    today = DateType.today()
    if "hom nay" in normalized:
        return today, today
    if "tuan nay" in normalized:
        start = today - timedelta(days=today.weekday())
        return start, today
    if "thang truoc" in normalized:
        last_month = today.replace(day=1) - timedelta(days=1)
        start = last_month.replace(day=1)
        return start, last_month
    start = today.replace(day=1)
    return start, today


def _persist_chat_messages(db: Session, current_user: RequestUser, user_text: str, response: dict[str, Any]) -> None:
    if not user_text:
        return
    try:
        db.add_all(
            [
                ChatMessage(user_id=current_user.id, role="user", content=user_text),
                ChatMessage(
                    user_id=current_user.id,
                    role="assistant",
                    content=str(response.get("answer") or ""),
                    intent=response.get("intent"),
                ),
            ]
        )
        db.commit()
    except Exception:
        db.rollback()


def get_chat_history(db: Session, current_user: RequestUser, limit: int = 50) -> list[ChatMessage]:
    items = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(desc(ChatMessage.created_at), desc(ChatMessage.id))
        .limit(max(1, min(limit, 200)))
        .all()
    )
    items.reverse()
    return items


def get_spending_anomalies(
    db: Session,
    current_user: RequestUser,
    authorization: str | None,
) -> list[dict[str, Any]]:
    _ = (db, current_user)
    end_date = DateType.today()
    start_date = end_date - timedelta(days=30)
    items = _list_transactions(
        authorization,
        start_date=start_date,
        end_date=end_date,
        transaction_type="expense",
        limit=500,
    )
    if not items:
        return []

    daily_total: dict[DateType, float] = defaultdict(float)
    biggest_item: dict[DateType, dict[str, Any]] = {}
    for item in items:
        tx_date = _coerce_date(item.get("date"))
        amount = float(item.get("amount") or 0.0)
        if not tx_date or amount <= 0:
            continue
        daily_total[tx_date] += amount
        current_biggest = biggest_item.get(tx_date)
        if current_biggest is None or float(current_biggest.get("amount") or 0.0) < amount:
            biggest_item[tx_date] = item

    if not daily_total:
        return []

    values = list(daily_total.values())
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / max(1, len(values))
    std_dev = variance ** 0.5
    threshold = mean + max(std_dev * 2.0, mean * 0.6)

    alerts: list[dict[str, Any]] = []
    for day, total in sorted(daily_total.items()):
        if total <= threshold:
            continue
        severity = "low"
        if total > threshold * 1.4:
            severity = "high"
        elif total > threshold * 1.2:
            severity = "medium"
        sample = biggest_item.get(day, {})
        alerts.append(
            {
                "id": f"anomaly-{day.isoformat()}",
                "date": day,
                "amount": round(total, 2),
                "description": sample.get("description") or "Chi tiêu bất thường",
                "reason": "Chi tiêu ngày này cao hơn mức thông thường",
                "severity": severity,
                "transaction_id": sample.get("id"),
            }
        )
    return alerts


def get_spending_forecast(
    db: Session,
    current_user: RequestUser,
    authorization: str | None,
) -> dict[str, Any]:
    _ = (db, current_user)
    chart = _request_json("GET", "/reports/chart", authorization, params={"limit_months": 6})
    series = chart.get("series") if isinstance(chart, dict) else []
    if not isinstance(series, list) or not series:
        return {
            "summary": "Chưa đủ dữ liệu để dự báo chi tiêu.",
            "points": [],
            "top_growing_categories": [],
            "risk_level": "low",
            "tips": ["Ghi nhận giao dịch đều đặn để AI dự báo chính xác hơn."],
        }

    monthly_expense = [float(item.get("expense") or 0.0) for item in series]
    average_expense = sum(monthly_expense) / len(monthly_expense)
    slope = 0.0
    if len(monthly_expense) >= 2:
        slope = (monthly_expense[-1] - monthly_expense[0]) / (len(monthly_expense) - 1)

    base_month = datetime.strptime(series[-1]["month"] + "-01", "%Y-%m-%d").date()
    points: list[dict[str, Any]] = []
    for step in range(1, 4):
        target_month = (base_month.replace(day=28) + timedelta(days=4)).replace(day=1)
        for _ in range(step - 1):
            target_month = (target_month.replace(day=28) + timedelta(days=4)).replace(day=1)
        predicted_expense = max(0.0, monthly_expense[-1] + slope * step)
        points.append(
            {
                "month": target_month.strftime("%Y-%m"),
                "predicted_expense": round(predicted_expense, 2),
                "predicted_income": None,
                "note": "Dự báo dựa trên xu hướng 6 tháng gần nhất",
            }
        )

    next_expense = points[0]["predicted_expense"] if points else average_expense
    risk_level = "low"
    if average_expense > 0 and next_expense > average_expense * 1.3:
        risk_level = "high"
    elif average_expense > 0 and next_expense > average_expense * 1.15:
        risk_level = "medium"

    tips = [
        "Theo dõi các khoản chi lớn trong 7 ngày tới.",
        "Đặt mức cảnh báo khi chi tiêu vượt 85% ngân sách.",
    ]
    if risk_level == "high":
        tips.insert(0, "Cần ưu tiên cắt giảm nhóm chi tiêu không thiết yếu trong tháng tới.")

    return {
        "summary": f"Dự báo chi tiêu tháng tới khoảng {next_expense:,.0f} VND.",
        "points": points,
        "top_growing_categories": [],
        "risk_level": risk_level,
        "tips": tips,
    }


def get_savings_suggestions(
    db: Session,
    current_user: RequestUser,
    authorization: str | None,
) -> dict[str, Any]:
    _ = (db, current_user)
    start_date = DateType.today().replace(day=1)
    end_date = DateType.today()
    breakdown = _request_json(
        "GET",
        "/reports/category-breakdown",
        authorization,
        params={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "transaction_type": "expense",
        },
    )
    if not isinstance(breakdown, list) or not breakdown:
        return {
            "summary": "Chưa đủ dữ liệu chi tiêu để đưa ra gợi ý tiết kiệm.",
            "tips": [],
            "total_potential_saving": 0.0,
            "general_advice": ["Bắt đầu ghi chép giao dịch hằng ngày để AI đưa gợi ý tốt hơn."],
        }

    top_categories = sorted(
        [
            {"category": str(item.get("category") or "Khac"), "spent": float(item.get("spent") or 0.0)}
            for item in breakdown
            if float(item.get("spent") or 0.0) > 0
        ],
        key=lambda item: item["spent"],
        reverse=True,
    )[:3]

    tips: list[dict[str, Any]] = []
    total_potential_saving = 0.0
    for item in top_categories:
        suggested_limit = round(item["spent"] * 0.9, 2)
        potential = round(item["spent"] - suggested_limit, 2)
        total_potential_saving += potential
        tips.append(
            {
                "category": item["category"],
                "current_spend": round(item["spent"], 2),
                "suggested_limit": suggested_limit,
                "potential_saving": potential,
                "tip": f"Giảm 10% chi tiêu nhóm {item['category']} trong tháng tới.",
            }
        )

    return {
        "summary": f"Bạn có thể tiết kiệm khoảng {total_potential_saving:,.0f} VND nếu tối ưu 3 nhóm chi tiêu lớn nhất.",
        "tips": tips,
        "total_potential_saving": round(total_potential_saving, 2),
        "general_advice": [
            "Sử dụng quy tắc 50/30/20 cho thu nhập hằng tháng.",
            "Đặt trần chi tiêu theo tuần để cảnh báo sớm.",
        ],
    }


def _month_summary(text: str, authorization: str | None) -> dict[str, Any]:
    start_date, end_date = _summary_range(text)
    summary = _request_json(
        "GET",
        "/reports/summary",
        authorization,
        params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
    )
    total_income = float(summary.get("total_income") or summary.get("period_total_income") or 0.0)
    total_expense = float(summary.get("total_expense") or summary.get("period_total_expense") or 0.0)
    balance = float(summary.get("balance") or summary.get("total_balance") or (total_income - total_expense))
    return {
        "answer": (
            f"Từ {start_date.isoformat()} đến {end_date.isoformat()}:\n"
            f"- Tổng thu: {total_income:,.0f} VND\n"
            f"- Tổng chi: {total_expense:,.0f} VND\n"
            f"- Số dư: {balance:,.0f} VND"
        ),
        "intent": "summary",
        "start_date": start_date,
        "end_date": end_date,
        "category_name": None,
        "total": total_expense,
    }


def _latest_transaction(authorization: str | None) -> dict[str, Any] | None:
    items = _list_transactions(authorization, limit=1)
    return items[0] if items else None


def answer_chat(
    db: Session,
    current_user: RequestUser,
    text: str,
    authorization: str | None,
) -> dict[str, Any]:
    normalized = _normalize_text(text)

    if _is_greeting(text):
        return {
            "answer": "Chào bạn! Mình là trợ lý tài chính AI. Bạn cần mình giúp ghi chép chi tiêu hay kiểm tra số dư không?",
            "intent": "greeting",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }

    if any(keyword in normalized for keyword in ANOMALY_KEYWORDS):
        alerts = get_spending_anomalies(db, current_user, authorization)
        if not alerts:
            response = {
                "answer": "Chi tiêu 30 ngày qua ổn định, chưa có điểm bất thường.",
                "intent": "anomaly_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        else:
            lines = ["Phát hiện các điểm cần lưu ý:"]
            for item in alerts:
                lines.append(f"- {item['date']}: {item['amount']:,.0f} VND ({item['reason']})")
            response = {
                "answer": "\n".join(lines),
                "intent": "anomaly_alert",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if any(keyword in normalized for keyword in FORECAST_KEYWORDS):
        forecast = get_spending_forecast(db, current_user, authorization)
        response = {
            "answer": forecast["summary"],
            "intent": "forecast",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if any(keyword in normalized for keyword in SAVING_KEYWORDS):
        suggestions = get_savings_suggestions(db, current_user, authorization)
        response = {
            "answer": suggestions["summary"],
            "intent": "saving_tips",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": suggestions.get("total_potential_saving"),
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if any(keyword in normalized for keyword in SUMMARY_KEYWORDS):
        response = _month_summary(text, authorization)
        _persist_chat_messages(db, current_user, text, response)
        return response

    # Heuristic multi-transaction split:
    # Handle cases like: "Duoc me cho 500k, an het 100k, do xang 50k"
    # even when Gemini fails to return `is_multiple=true`.
    segments = _split_transaction_segments(text)
    if len(segments) >= 2:
        parsed_items: list[dict[str, Any]] = []
        for segment in segments:
            parsed_seg = parse_transaction_text(
                db,
                current_user,
                segment,
                auto_create_category=True,
                authorization=authorization,
            )
            if parsed_seg.get("amount") is None:
                continue
            parsed_items.append(parsed_seg)

        if len(parsed_items) >= 2:
            created_txs = []
            for tx in parsed_items:
                created = create_transaction_from_parsed(
                    tx,
                    fallback_text=tx.get("description") or text,
                    authorization=authorization,
                )
                if "category_name" not in created:
                    created["category_name"] = tx.get("category_name")
                created_txs.append(created)

            lines = ["Đã ghi nhận các giao dịch sau:"]
            total_income = 0.0
            total_expense = 0.0
            for tx in created_txs:
                tx_type = tx.get("transaction_type") or "expense"
                amt = float(tx.get("amount") or 0.0)
                cat_name = tx.get("category_name")
                cat_str = f" ({cat_name})" if cat_name else ""
                desc_str = f" - {tx.get('description')}" if tx.get("description") else ""

                if tx_type == "income":
                    lines.append(f"- Thu {amt:,.0f} VND{cat_str}{desc_str}")
                    total_income += amt
                else:
                    lines.append(f"- Chi {amt:,.0f} VND{cat_str}{desc_str}")
                    total_expense += amt

            response = {
                "answer": "\n".join(lines),
                "intent": "create_transaction",
                "start_date": _coerce_date(created_txs[0].get("date")) if created_txs else DateType.today(),
                "end_date": _coerce_date(created_txs[-1].get("date")) if created_txs else DateType.today(),
                "category_name": None,
                "total": total_income - total_expense,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response

    if any(keyword in normalized for keyword in DELETE_KEYWORDS):
        latest = _latest_transaction(authorization)
        if not latest:
            response = {
                "answer": "Khong tim thay giao dich gan day de xoa.",
                "intent": "not_found",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response
        _request_json("DELETE", f"/transactions/{latest['id']}", authorization)
        response = {
            "answer": "Da xoa giao dich gan nhat theo yeu cau.",
            "intent": "delete_transaction",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if any(keyword in normalized for keyword in UPDATE_KEYWORDS):
        latest = _latest_transaction(authorization)
        if not latest:
            response = {
                "answer": "Khong tim thay giao dich gan day de cap nhat.",
                "intent": "not_found",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response
        parsed = parse_transaction_text(
            db,
            current_user,
            text,
            auto_create_category=True,
            authorization=authorization,
        )
        update_payload: dict[str, Any] = {}
        if parsed.get("amount"):
            update_payload["amount"] = float(parsed["amount"])
        if parsed.get("category_id"):
            update_payload["category_id"] = parsed["category_id"]
        if parsed.get("description"):
            update_payload["description"] = parsed["description"]
        if parsed.get("date"):
            update_payload["date"] = (_coerce_date(parsed["date"]) or DateType.today()).isoformat()
        if not update_payload:
            response = {
                "answer": "Minh chua nhan ra thong tin can cap nhat.",
                "intent": "ask_more_info",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response
        updated = _request_json("PUT", f"/transactions/{latest['id']}", authorization, payload=update_payload)
        response = {
            "answer": f"Da cap nhat giao dich gan nhat thanh {float(updated.get('amount') or 0):,.0f} VND.",
            "intent": "update_transaction",
            "start_date": _coerce_date(updated.get("date")),
            "end_date": _coerce_date(updated.get("date")),
            "category_name": parsed.get("category_name"),
            "total": float(updated.get("amount") or 0.0),
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    parsed = parse_transaction_text(
        db,
        current_user,
        text,
        auto_create_category=True,
        authorization=authorization,
    )
    
    if parsed.get("is_multiple") and parsed.get("transactions"):
        created_txs = []
        for tx in parsed["transactions"]:
            created = create_transaction_from_parsed(tx, fallback_text=text, authorization=authorization)
            if "category_name" not in created:
                created["category_name"] = tx.get("category_name")
            created_txs.append(created)
        
        lines = ["Đã ghi nhận các giao dịch sau:"]
        total_income = 0.0
        total_expense = 0.0
        for tx in created_txs:
            tx_type = tx.get("transaction_type") or "expense"
            amt = float(tx.get("amount") or 0.0)
            cat_name = tx.get("category_name")
            cat_str = f" ({cat_name})" if cat_name else ""
            desc_str = f" - {tx.get('description')}" if tx.get("description") else ""
            
            if tx_type == "income":
                lines.append(f"- Thu {amt:,.0f} VND{cat_str}{desc_str}")
                total_income += amt
            else:
                lines.append(f"- Chi {amt:,.0f} VND{cat_str}{desc_str}")
                total_expense += amt
        
        response = {
            "answer": "\n".join(lines),
            "intent": "create_transaction",
            "start_date": _coerce_date(created_txs[0].get("date")) if created_txs else DateType.today(),
            "end_date": _coerce_date(created_txs[-1].get("date")) if created_txs else DateType.today(),
            "category_name": None,
            "total": total_income - total_expense,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    # Lớp bảo vệ: Ép intent nếu có từ khóa Ngân sách/Nợ/Định kỳ
    if any(kw in normalized for kw in BUDGET_KEYWORDS):
        parsed["intent"] = "create_budget"
    elif any(kw in normalized for kw in DEBT_KEYWORDS):
        parsed["intent"] = "create_debt"
    elif any(kw in normalized for kw in RECURRING_KEYWORDS):
        parsed["intent"] = "create_subscription"

    # -- BẮT ĐẦU CRITIC AGENT --
    # Kiểm tra xem người dùng có phải đang đính chính "À nhầm" không
    critic_prompt = f"Câu nói: '{text}'. Dữ liệu vừa trích xuất: {parsed}. Nếu câu này mang ý nghĩa đính chính hoặc sửa lỗi cho giao dịch vừa mới thực hiện (ví dụ: 'à nhầm', 'ghi sai rồi', 'sửa lại thành...'), hãy trả về {{'intent': 'UPDATE_TRANSACTION'}}. Nếu là ghi chép mới hoàn toàn, trả về {{'intent': 'CREATE_TRANSACTION'}}. TRẢ VỀ JSON."
    critic_data = get_gemini_response(critic_prompt, "Bạn là chuyên gia kiểm tra ý định đính chính của người dùng.")
    
    if critic_data.get("intent") == "UPDATE_TRANSACTION":
        latest = _latest_transaction(authorization)
        if latest:
            update_payload = {}
            if parsed.get("amount"): update_payload["amount"] = float(parsed["amount"])
            if parsed.get("category_id"): update_payload["category_id"] = parsed["category_id"]
            if parsed.get("description"): update_payload["description"] = parsed["description"]
            
            updated = _request_json("PUT", f"/transactions/{latest['id']}", authorization, payload=update_payload)
            response = {
                "answer": f"Đã sửa lại giao dịch gần nhất thành {float(updated.get('amount') or 0):,.0f} VND.",
                "intent": "update_transaction",
                "start_date": _coerce_date(updated.get("date")),
                "end_date": _coerce_date(updated.get("date")),
                "category_name": parsed.get("category_name"),
                "total": float(updated.get("amount") or 0.0),
            }
            _persist_chat_messages(db, current_user, text, response)
            return response

    if parsed.get("intent") == "create_budget":
        # Resolve category if provided
        cat_id, resolved_cat_name = _resolve_category(text, parsed.get("category_name"), True, authorization)
            
        payload = {
            "name": parsed.get("description") or f"Ngân sách {resolved_cat_name or 'tổng hợp'}",
            "category_id": int(cat_id) if cat_id else None,
            "amount": float(parsed["amount"]),
            "cycle": parsed.get("period") or "monthly"
        }
        _request_json("POST", "/budgets", authorization, payload=payload, service="finance")
        response = {"answer": f"Đã thiết lập ngân sách {payload['amount']:,.0f} VND cho mục {resolved_cat_name or 'chung'}.", "intent": "create_budget"}
        _persist_chat_messages(db, current_user, text, response)
        return response

    if parsed.get("intent") == "create_debt":
        payload = {
            "name": parsed.get("description") or text,
            "amount": float(parsed["amount"]),
            "due_date": (parsed.get("date") or DateType.today()).isoformat(),
            "frequency": "one_time"
        }
        _request_json("POST", "/debts", authorization, payload=payload, service="recurring")
        response = {"answer": f"Đã ghi lại khoản nợ {payload['amount']:,.0f} VND: {payload['name']}.", "intent": "create_debt"}
        _persist_chat_messages(db, current_user, text, response)
        return response

    if parsed.get("intent") == "create_subscription":
        payload = {
            "name": parsed.get("description") or "Subscription",
            "amount": float(parsed["amount"]),
            "frequency": parsed.get("frequency") or "monthly",
            "start_date": (parsed.get("date") or DateType.today()).isoformat(),
        }
        _request_json("POST", "/subscriptions", authorization, payload=payload, service="recurring")
        response = {"answer": f"Đã cài đặt thanh toán định kỳ {payload['amount']:,.0f} VND cho {payload['name']}.", "intent": "create_subscription"}
        _persist_chat_messages(db, current_user, text, response)
        return response

    if parsed.get("amount") is None:
        response = {
            "answer": "Mình chưa nhận ra số tiền. Bạn thử nhập lại kèm số tiền cụ thể nhé.",
            "intent": "ask_amount",
            "start_date": None,
            "end_date": None,
            "category_name": parsed.get("category_name"),
            "total": None,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    created = create_transaction_from_parsed(parsed, fallback_text=text, authorization=authorization)
    created_date = _coerce_date(created.get("date")) or _coerce_date(parsed.get("date"))
    amount = float(created.get("amount") or parsed.get("amount") or 0.0)
    tx_type = created.get("transaction_type") or parsed.get("transaction_type") or "expense"
    prefix = "Da ghi nhan thu" if tx_type == "income" else "Da ghi nhan chi"
    response = {
        "answer": f"{prefix} {amount:,.0f} VND.",
        "intent": "create_transaction",
        "start_date": created_date,
        "end_date": created_date,
        "category_name": parsed.get("category_name"),
        "total": amount,
    }
    _persist_chat_messages(db, current_user, text, response)
    return response


def _extract_receipt_total(text: str) -> float | None:
    normalized = _normalize_text(text)
    best_total: float | None = None
    for line in normalized.splitlines():
        if not any(hint in line for hint in TOTAL_HINTS):
            continue
        amount = _extract_amount(line)
        if amount is None:
            continue
        if best_total is None or amount > best_total:
            best_total = amount
    if best_total is not None:
        return best_total
    return _extract_amount(normalized)


def extract_ocr(payload: bytes) -> dict[str, Any]:
    if not payload:
        return {"warnings": ["empty_file"], "text": ""}

    try:
        image = Image.open(io.BytesIO(payload))
    except Exception:
        return {"warnings": ["invalid_image"], "text": ""}

    try:
        text = pytesseract.image_to_string(image, lang="vie+eng")
    except Exception:
        text = ""

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    merchant = lines[0] if lines else None
    total = _extract_receipt_total(text) if text else None
    parsed_date = _extract_date(text, None) if text else None

    return {
        "merchant": merchant,
        "total": total,
        "date": parsed_date,
        "vat": None,
        "estimated": None,
        "note": None,
        "computed_total": total,
        "total_delta": 0.0 if total is not None else None,
        "is_total_consistent": True if total is not None else None,
        "warnings": [] if text else ["ocr_empty"],
        "text": text or "",
    }
