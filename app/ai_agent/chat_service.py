import httpx
import re
import json
from datetime import date as DateType
from sqlalchemy.orm import Session
from app.core.config import settings
from app.auth.models import User
from app.finance import service as finance_service
from app.finance import schemas as finance_schemas

# --- BỘ LỌC REGEX DỰ PHÒNG (FALLBACK) ---
# Được thiết kế để bắt gần như mọi cách hỏi về tài chính cơ bản
# Giúp ứng dụng luôn phản hồi ngay cả khi mất mạng hoặc API lỗi
REGEX_PATTERNS = {
    r"(số dư|còn bao nhiêu|tài khoản|tiền)": "Để kiểm tra số dư, bạn hãy vào mục 'Ví của tôi' hoặc xem trực tiếp trên Dashboard nhé!",
    r"(tiêu|chi tiêu|đã tiêu|hết bao nhiêu|bao nhiêu)": "Bạn có thể xem biểu đồ chi tiêu ở màn hình chính để biết tháng này đã sử dụng bao nhiêu tiền nè.",
    r"(vay|nợ|mượn)": "Quản lý nợ rất quan trọng! Bạn hãy ghi chép lại trong phần 'Sổ nợ' để mình theo dõi giúp nhé.",
}

SYSTEM_INSTRUCTION = """
Bạn là Trợ lý AI Tài chính Cá nhân chuyên nghiệp tích hợp trong dự án FoodFast. 
Nhiệm vụ: Hỗ trợ người dùng quản lý chi tiêu và lập kế hoạch tài chính.
Phong cách: Thân thiện, xưng 'mình' - 'bạn', luôn sẵn sàng giúp đỡ.
"""

def get_gemini_response(prompt: str) -> dict:
    """
    Xử lý logic Chatbot bằng REST API và Fallback ưu tiên.
    """
    
    # 1. Kiểm tra Regex Fallback trước (Cực kỳ quan trọng cho đồ án)
    clean_prompt = prompt.lower().strip()
    for pattern, message in REGEX_PATTERNS.items():
        if re.search(pattern, clean_prompt):
            return {"answer": message, "intent": "regex_fallback"}

    # 2. Chuẩn bị gọi API Gemini
    url = f"{settings.gemini_api_base}/models/{settings.gemini_model_name}:generateContent?key={settings.gemini_api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.7
        }
    }

    try:
        with httpx.Client(timeout=settings.gemini_timeout_seconds) as client:
            response = client.post(url, json=payload)
            
            # Xử lý các mã lỗi đặc biệt
            if response.status_code == 429:
                return {
                    "answer": "Mình đang hơi mệt vì trả lời quá nhanh, bạn đợi 1 phút rồi hỏi tiếp nhé!",
                    "intent": "rate_limit_error"
                }
            
            if response.status_code in [401, 403]:
                return {
                    "answer": "Hệ thống đang gặp lỗi xác thực API Key. Bạn hãy kiểm tra lại file .env nhé!",
                    "intent": "auth_error"
                }

            response.raise_for_status()
            data = response.json()
            
            # Phân tích phản hồi từ AI
            ai_text = data['candidates'][0]['content']['parts'][0]['text']
            return json.loads(ai_text)

    except Exception:
        # Nếu mất mạng hoàn toàn: Luôn trả về câu thông báo an toàn
        return {
            "answer": "Kết nối của mình đang chập chờn một chút. Bạn thử lại sau vài giây hoặc hỏi về 'Số dư', 'Chi tiêu' nhé!",
            "intent": "network_error"
        }

def answer_chat(db: Session, current_user: User, text: str) -> dict:
    """
    Hàm entry-point cho Router.
    """
    ai_result = get_gemini_response(text)
    
    return {
        "answer": ai_result.get("answer") or ai_result.get("friendly_response") or "Mình đã nhận được thông tin.",
        "intent": ai_result.get("intent", "UNKNOWN"),
        "total": ai_result.get("data", {}).get("amount"),
        "category_name": ai_result.get("data", {}).get("category")
    }
