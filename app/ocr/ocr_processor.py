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

def _clean_merchant_name(name: str | None, is_from_ai: bool = False) -> str | None:
    if not name: return None
    norm = _normalize_text(name)
    for alias, full_name in MERCHANT_ALIASES.items():
        if alias in norm:
            return full_name
            
    if is_from_ai:
        return name.strip()

    cleaned = name.strip()
    # Remove leading symbols and junk
    cleaned = re.sub(r"^[|.\-\s]+", "", cleaned)
    
    # Remove common prefixes
    prefixes = ["store:", "shop:", "cua hang:", "nha hang:", "branch:", "chi nhanh:"]
    for p in prefixes:
        if cleaned.lower().startswith(p):
            cleaned = cleaned[len(p):].strip()
            
    cleaned = re.sub(r"[^\w\s\&\.\-]", "", cleaned)
    words = cleaned.split()
    filtered_words = [w for w in words if _normalize_text(w) not in OCR_MERCHANT_SKIP_KEYWORDS]
    final_name = " ".join(filtered_words).strip().title()
    return final_name if len(final_name) > 1 else None

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
    if not value: return None
    if isinstance(value, (DateType, datetime)): return value.date() if hasattr(value, "date") else value
    if isinstance(value, str):
        value = value.strip()
        # Common ISO format
        try: return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError: pass
        
        # English month formats (e.g., 18 Jun 2024)
        for fmt in ("%d %b %Y", "%d %B %Y", "%b %d, %Y", "%d/%m/%Y", "%d-%m-%Y"):
            try: return datetime.strptime(value, fmt).date()
            except ValueError: continue
            
        # Vietnamese date format (Ngày 18 Tháng 06 Năm 2024)
        if "ngay" in value.lower() or "thang" in value.lower():
            nums = re.findall(r"\d+", value)
            if len(nums) >= 3:
                try:
                    d, m, y = map(int, nums[:3])
                    if y < 100: y += 2000
                    return DateType(y, m, d)
                except ValueError: pass

        # Clean numeric parts if it's like 18.06.2024
        clean = re.sub(r"[./]", "-", value)
        match = re.search(r"(\d{1,2}-\d{1,2}-\d{2,4})", clean)
        if match:
            d_str = match.group(1)
            parts = d_str.split("-")
            if len(parts) == 3:
                # Try DD-MM-YYYY
                try:
                    d, m, y = map(int, parts)
                    if y < 100: y += 2000
                    return DateType(y, m, d)
                except ValueError: pass
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
            "Bạn là chuyên gia OCR tài chính hàng đầu, chuyên trách bóc tách hóa đơn tại Việt Nam.\n"
            "NHIỆM VỤ: Trích xuất thông tin hóa đơn vào định dạng JSON với độ chính xác tuyệt đối.\n\n"
            "HƯỚNG DẪN BÓC TÁCH CHI TIẾT:\n"
            "1. TÊN CỬA HÀNG (MERCHANT):\n"
            "   - Tìm tên thương hiệu chính (thường ở dòng 1-2, chữ TO NHẤT, hoặc TRONG LOGO).\n"
            "   - Trả về tên hiển thị ĐÚNG, RÕ RÀNG, viết hoa chữ cái đầu hoặc đúng chuẩn thương hiệu.\n"
            "   - Ví dụ: 'DOOKKI', 'CIRCLE K', 'HIGHLANDS COFFEE', 'WINMART', 'GS25'.\n"
            "   - BỎ QUA: Địa chỉ, Số điện thoại, Tên nhân viên, Số bàn (Table), Số hóa đơn (Bill No).\n"
            "2. NGÀY GIAO DỊCH (TRANSACTION DATE):\n"
            "   - Tìm ngày thực tế hóa đơn được in (thường sau chữ 'Ngày', 'Date', 'Time').\n"
            "   - CẢNH BÁO QUAN TRỌNG: TUYỆT ĐỐI KHÔNG LẤY NGÀY HÔM NAY. Phải lấy ngày có trong ảnh. Nếu không thấy, trả về null.\n"
            "   - Định dạng trả về: YYYY-MM-DD (ví dụ: '2026-04-13').\n"
            "3. CÁC KHOẢN TIỀN (MONEY):\n"
            "   - final_total: Giá tiền cuối cùng (Payment Amount, Tổng cộng, Tổng thanh toán).\n"
            "   - subtotal_before_tax: Tiền hàng trước thuế VAT (SubTotal, Cộng tiền hàng).\n"
            "   - vat_amount: Số tiền thuế (VAT, Thuế GTGT). Lấy giá trị tiền chính xác (ví dụ: 44480), không lấy %.\n"
            "   - discount_amount: Tiền giảm giá, chiết khấu (Discount, Giam gia).\n"
            "4. NGUỒN TIỀN (PAYMENT SOURCE):\n"
            "   - Xác định rõ nguồn tiền thanh toán dựa vào thông tin trên hóa đơn (ví dụ: 'Tiền mặt', 'Ví MoMo', 'Thẻ Visa', 'Thẻ ATM', 'Chuyển khoản').\n"
            "   - Nếu hóa đơn có ghi hình thức thanh toán (Payment method), hãy trích xuất chính xác.\n"
            "5. DANH MỤC (CATEGORY) & NỘI DUNG (NOTE):\n"
            "   - category: Chọn 1 danh mục phù hợp nhất từ danh sách: [" + cat_context + "].\n"
            "   - suggested_note: Mô tả tóm tắt LẠI nội dung hóa đơn một cách CHÍNH XÁC và HAY dựa trên 'line_items'. Ví dụ: 'Mua 2 ly trà sữa Ô Long và đồ uống tại Xưởng Trà Thủ Công' hoặc 'Mua nhu yếu phẩm và đồ dùng gia đình tại FamilyMart'. Cần bám sát thực tế các món đã mua, không bịa đặt.\n"
            "6. ĐỘ TIN CẬY (CONFIDENCE SCORE):\n"
            "   - Đánh giá CÔNG TÂM chất lượng ảnh và mức độ dễ đọc từ 0.0 đến 1.0 cho các trường: merchant, final_total, transaction_date, category, payment_source.\n"
            "   - Rõ nét, 100% chắc chắn đúng: 0.9 - 1.0.\n"
            "   - Mờ, nhòe, bị rách, hoặc phải suy đoán ngữ cảnh: 0.5 - 0.8.\n"
            "   - Hoàn toàn không có thông tin (trả về null): 0.0.\n\n"
            "VÍ DỤ TRẢ VỀ:\n"
            "{\n"
            "  \"data\": {\n"
            "    \"merchant\": \"DOOKKI\",\n"
            "    \"transaction_date\": \"2026-04-13\",\n"
            "    \"final_total\": 600480,\n"
            "    \"subtotal_before_tax\": 556000,\n"
            "    \"vat_amount\": 44480,\n"
            "    \"discount_amount\": 0,\n"
            "    \"category\": \"Ăn uống\",\n"
            "    \"payment_source\": \"Tiền mặt\",\n"
            "    \"suggested_note\": \"Thưởng thức Buffet lẩu topokki tại DOOKKI\",\n"
            "    \"line_items\": [{\"name\": \"Buffet Người Lớn\", \"quantity\": 4, \"total\": 556000}]\n"
            "  },\n"
            "  \"confidence\": {\"merchant\": 0.95, \"final_total\": 0.99, \"transaction_date\": 0.9, \"category\": 0.9, \"payment_source\": 0.85}\n"
            "}\n"
        )
        
        # Use model from settings or fallback to 1.5 flash which is widely available
        model_name = getattr(settings, "gemini_model_name", "gemini-1.5-flash")
        
        model = genai.GenerativeModel(
            model_name=model_name, 
            system_instruction=system_instruction,
            generation_config={"response_mime_type": "application/json"}
        )
        response = model.generate_content([
            {"mime_type": "image/jpeg", "data": image_bytes},
            "Hãy bóc tách thông tin từ hóa đơn này. Đặc biệt chú ý đến Tên cửa hàng (Merchant) ở trên cùng, Ngày giao dịch chính xác (KHÔNG lấy ngày hiện tại), và các khoản Thuế VAT nếu có."
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
    image_save_path = os.path.join("uploads", "bills", filename)
    image.save(image_save_path, format="JPEG", quality=95)
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
        merchant = _clean_merchant_name(data.get("merchant"), is_from_ai=True)
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
