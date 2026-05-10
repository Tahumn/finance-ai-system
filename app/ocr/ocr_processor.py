from __future__ import annotations

import io
import os
import re
import uuid
import unicodedata
from datetime import date as DateType, datetime, timedelta
from typing import Any

import cv2
import numpy as np
from PIL import Image
import pytesseract
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.finance.models import Transaction, Category, Tag

try:
    import google.generativeai as genai
except ImportError:
    genai = None

# --- Constants ---

OCR_TOTAL_KEYWORDS = (
    "tong cong", "tong tien", "tong", "cong", "thanh toan", "phai thanh toan",
    "phai tra", "tong thanh toan", "tong tien thanh toan", "tong gia tri thanh toan",
    "so tien", "amount due", "grand total", "total", "pay"
)
OCR_SUBTOTAL_KEYWORDS = (
    "tam tinh", "subtotal", "thue", "vat", "tax", "phi", "giam gia",
    "discount", "chiet khau", "tien thua", "change", "tien khach", "cash"
)
OCR_MERCHANT_SKIP_KEYWORDS = (
    "hoa don", "receipt", "invoice", "bill", "dia chi", "address", "sdt", "phone",
    "tel", "tax", "mst", "ma so thue", "ngay", "date", "time", "website", "www", ".com", ".vn"
)
OCR_VAT_KEYWORDS = ("vat", "thue gtgt", "tien thue", "thue", "tax", "gtgt")
OCR_ESTIMATE_KEYWORDS = (
    "tam tinh", "subtotal", "estimated", "uoc tinh", "du kien",
    "tong truoc thue", "gia truoc thue", "cong tien hang", "tien hang"
)
OCR_PRETAX_KEYWORDS = ("truoc thue", "pre tax", "before tax")
CURRENCY_HINTS = ("vnd", "dong", "đ", "usd", "$", "eur", "yen", "jpy")

MERCHANT_ALIASES = {
    "dookki": "DOOKKI Korean Topokki Buffet",
    "dooki": "DOOKKI Korean Topokki Buffet",
    "familymart": "FamilyMart",
    "circle k": "Circle K",
    "winmart": "WinMart",
    "highlands": "Highlands Coffee",
    "the coffee house": "The Coffee House",
    "grab": "Grab",
    "shopee": "Shopee",
    "lazada": "Lazada",
    "tiki": "Tiki",
    "starbucks": "Starbucks",
    "phuc long": "Phúc Long Coffee & Tea",
    "lotte": "Lotte Mart",
    "coop": "Co.op Mart",
    "big c": "Big C",
    "go!": "GO!",
}

# --- Helper Functions ---

def _normalize_text(text: str) -> str:
    if not text: return ""
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower()
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized

def _clean_merchant_name(name: str | None) -> str | None:
    if not name: return None
    norm = _normalize_text(name)
    for alias, full_name in MERCHANT_ALIASES.items():
        if alias in norm:
            return full_name
    cleaned = name.strip()
    cleaned = re.sub(r"[^\w\s\&\.\-]", "", cleaned)
    words = cleaned.split()
    filtered_words = [w for w in words if _normalize_text(w) not in OCR_MERCHANT_SKIP_KEYWORDS]
    final_name = " ".join(filtered_words).strip().title()
    return final_name if len(final_name) > 2 else None

def _extract_json(text: str) -> dict:
    if not text: return {}
    text = text.strip()
    # Remove markdown code blocks if present
    if "```" in text:
        # Match ```json ... ``` or just ``` ... ```
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            text = match.group(1)
        else:
            # Fallback: just strip the triple backticks lines
            text = re.sub(r"```(json)?", "", text).strip()
    
    try:
        import json
        return json.loads(text)
    except Exception:
        # Final fallback: find the first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                import json
                return json.loads(text[start:end+1])
            except Exception: pass
    return {}

def _coerce_amount(value: Any) -> float | None:
    if value is None: return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # Remove currency symbols and common spaces
            val = value.lower().replace("vnd", "").replace("đ", "").replace("đ", "").strip()
            val = val.replace(" ", "")
            
            # If both . and , exist, it's likely 1.234.567,89 or 1,234,567.89
            if "." in val and "," in val:
                dot_idx = val.rfind(".")
                comma_idx = val.rfind(",")
                if dot_idx > comma_idx: # 1,234.56
                    val = val.replace(",", "")
                else: # 1.234,56
                    val = val.replace(".", "").replace(",", ".")
            else:
                # Only one type of separator. 
                # In VND, 1.000.000 is 1 million. 
                # In USD/Standard, 1,000,000 is 1 million.
                # If there are multiple separators, they are thousand separators.
                if val.count(".") > 1: val = val.replace(".", "")
                if val.count(",") > 1: val = val.replace(",", "")
                
                # If only one remains, check its position.
                # If it's near the end (last 3 chars), it's likely a decimal separator.
                # UNLESS we are in VND context where decimals are rare.
                # For now, let's assume if it's VND and the value is large, it's a thousand separator.
                if "." in val:
                    if val.rfind(".") <= len(val) - 4: # e.g. 1.234
                        val = val.replace(".", "")
                    # else: keep it as decimal
                if "," in val:
                    if val.rfind(",") <= len(val) - 4: # e.g. 1,234
                        val = val.replace(",", "")
                    else:
                        val = val.replace(",", ".")
            
            if re.search(r"\d", val):
                return float(val)
        return float(value)
    except (ValueError, TypeError): return None

def _coerce_date_value(value: Any) -> DateType | None:
    if value is None: return None
    if isinstance(value, DateType): return value
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            # Try some common receipt formats
            for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
                try: return datetime.strptime(value, fmt).date()
                except ValueError: continue
    return None

def _map_payment_source(text: str) -> str | None:
    norm = _normalize_text(text)
    if any(k in norm for k in ["momo", "zalopay", "vnpay"]): return "Ví điện tử"
    if any(k in norm for k in ["tien mat", "cash", "khach tra"]): return "Tiền mặt"
    if any(k in norm for k in ["the", "card", "atm", "bank", "chuyen khoan"]): return "Ngân hàng"
    return None

# --- OCR Core ---

def _call_gemini_ocr(image_bytes: bytes, cat_context: str = "") -> dict | None:
    if genai is None or not settings.gemini_api_key: return None
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model_name = "gemini-1.5-pro"
        
        system_instruction = (
            "Bạn là chuyên gia phân tích hóa đơn tài chính chuyên nghiệp tại Việt Nam.\n"
            "NHIỆM VỤ: Trích xuất dữ liệu CỰC KỲ CHÍNH XÁC.\n\n"
            "QUY TẮC CHI TIẾT:\n"
            "1. MERCHANT: Tên cửa hàng ở trên cùng (ví dụ: 'Hej', 'Xưởng Trà Thủ Công').\n"
            "2. DATE & TIME: Tìm ngày (DD/MM/YYYY) và giờ (HH:mm) giao dịch. Tuyệt đối KHÔNG lấy ngày hiện tại.\n"
            "3. TOTAL: Con số tổng cộng cuối cùng. Tránh nhầm với số điện thoại hay số hóa đơn.\n"
            "4. PAYMENT SOURCE: Tìm từ khóa thanh toán (ví dụ: 'Momo', 'Ví MoMo', 'ZaloPay', 'Thẻ', 'Visa', 'Tiền mặt', 'Chuyển khoản').\n"
            "5. SUGGESTED NOTE: Tạo ghi chú theo định dạng: '[Giờ] - Mua [Danh sách các món hàng chính]'. \n"
            "   Ví dụ: '19:51 - Mua Trà Sữa Ô Long, Bạc Xỉu'.\n"
            "6. CATEGORY: Chọn 1 trong: [" + cat_context + "]. Nếu là đồ uống/đồ ăn chọn 'Ăn uống' (nếu có trong danh sách).\n\n"
            "TRẢ VỀ DUY NHẤT JSON:\n"
            "{\n"
            "  \"data\": {\n"
            "    \"merchant\": \"string\", \"transaction_date\": \"YYYY-MM-DD\", \"final_total\": number,\n"
            "    \"category\": \"string\", \"payment_source\": \"string\", \"suggested_note\": \"string\",\n"
            "    \"line_items\": [{\"name\": \"string\", \"quantity\": number, \"total\": number}]\n"
            "  },\n"
            "  \"confidence\": {\"merchant\": number, \"final_total\": number, \"transaction_date\": number}\n"
            "}"
        )
        
        model = genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)
        response = model.generate_content([
            {"mime_type": "image/jpeg", "data": image_bytes},
            "Hãy trích xuất thông tin hóa đơn này. Lưu ý tìm tên cửa hàng ở trên cùng và tổng tiền ở dưới cùng."
        ])
        
        text_val = getattr(response, "text", "")
        # Debug logging
        with open("uploads/last_ocr_debug.txt", "w", encoding="utf-8") as f:
            f.write(text_val)
            
        return _extract_json(text_val) if text_val else None
    except Exception as e:
        print(f"Gemini OCR Error: {e}")
        return None

def _ocr_best_text(image: Image.Image) -> str:
    candidates = []
    for deg in (0, 90, 180, 270):
        rotated = image.rotate(deg, expand=True)
        text = pytesseract.image_to_string(rotated, lang="vie+eng", config="--oem 3 --psm 6")
        score = 0.0
        norm = _normalize_text(text)
        if any(k in norm for k in OCR_TOTAL_KEYWORDS): score += 5
        if len(re.findall(r"\d", text)) > 10: score += 2
        candidates.append((score, text))
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1] if candidates else ""

def extract_ocr(image_bytes: bytes, current_user_id: int, db: Session) -> dict:
    image = Image.open(io.BytesIO(image_bytes))
    os.makedirs("uploads/bills", exist_ok=True)
    filename = f"{current_user_id}_{uuid.uuid4()}.jpg"
    final_image_path = f"/uploads/bills/{filename}"
    
    # Resize image to optimal size for Gemini (max 1600px)
    max_size = 1600
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
        image = image.resize(new_size, Image.LANCZOS)

    # Save standardized high-quality JPEG
    buffer = io.BytesIO()
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")
    image.save(buffer, format="JPEG", quality=95)
    image_bytes_to_send = buffer.getvalue()

    # 2. Fetch existing categories
    categories = db.query(Category).filter(Category.user_id == current_user_id).all()
    cat_list = [c.name for c in categories]
    cat_context = ", ".join(cat_list) if cat_list else "Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Khác"

    # 3. Call Gemini Pro with the standardized image
    gemini_result = _call_gemini_ocr(image_bytes_to_send, cat_context=cat_context)
    
    # Initialize variables
    text = ""
    merchant, total, date_value = None, None, None
    vat_amount, discount_amount, subtotal = None, None, None
    suggested_note, category_name, suggested_tags, line_items = None, None, [], []
    payment_source = None
    conf = {k: 0.0 for k in ["merchant", "transaction_date", "payment_source", "category", "tags", "suggested_note", "subtotal_before_tax", "vat_amount", "discount_amount", "final_total"]}

    if gemini_result and isinstance(gemini_result, dict):
        data = gemini_result.get("data", {})
        merchant = data.get("merchant")
        total = _coerce_amount(data.get("final_total"))
        date_value = _coerce_date_value(data.get("transaction_date"))
        category_name = data.get("category")
        payment_source = data.get("payment_source")
        line_items = data.get("line_items") or []
        text = data.get("raw_ocr_text") or ""
        # New fields
        vat_amount = _coerce_amount(data.get("vat_amount"))
        discount_amount = _coerce_amount(data.get("discount_amount"))
        subtotal = _coerce_amount(data.get("subtotal_before_tax"))
        suggested_note = data.get("suggested_note")
        
        g_conf = gemini_result.get("confidence", {})
        if isinstance(g_conf, dict):
            for k in conf:
                if k in g_conf:
                    val = float(g_conf.get(k, 0))
                    conf[k] = val if val <= 1.0 else val / 100.0

    # 4. Fallback Logic with stricter rules
    if not merchant or not total:
        cv_img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        fallback_text = _ocr_best_text(Image.fromarray(thresh))
        text = text or fallback_text
        
        if not merchant:
            lines = [l.strip() for l in fallback_text.splitlines() if l.strip()]
            for l in lines[:3]:
                if len(l) > 3 and not any(k in _normalize_text(l) for k in OCR_MERCHANT_SKIP_KEYWORDS):
                    merchant = l; conf["merchant"] = 0.3; break
        
        if not total:
            # Enhanced amount extraction: avoid phone numbers (usually start with 0 or have many separators)
            potential_amounts = []
            for line in reversed(fallback_text.splitlines()):
                nums = re.findall(r"\d+(?:[.,]\d+)+", line) # Find numbers with at least one separator
                for n in nums:
                    if n.startswith("0"): continue # Likely a phone number
                    val = _coerce_amount(n)
                    if val and 1000 <= val < 10000000: # Realistic range for a single receipt
                        potential_amounts.append(val)
            if potential_amounts:
                total = potential_amounts[0] # Take the last found amount (usually at the bottom)
                conf["final_total"] = 0.4

    if not suggested_note and merchant: suggested_note = f"Thanh toán tại {merchant}"
    if not payment_source: payment_source = _map_payment_source(text)

    return {
        "data": {
            "merchant": merchant, "transaction_date": date_value, "transaction_type": "expense",
            "payment_source": payment_source, "category": category_name, "tags": suggested_tags,
            "suggested_note": suggested_note, "raw_ocr_text": text, "final_total": total,
            "subtotal_before_tax": subtotal, "vat_amount": vat_amount, "discount_amount": discount_amount,
            "currency": "VND", "line_items": line_items, "image_path": final_image_path,
        },
        "confidence": conf,
        "warnings": []
    }
