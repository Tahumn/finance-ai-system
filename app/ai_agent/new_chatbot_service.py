import httpx
import re
import json
from datetime import date as DateType
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.auth_context import RequestUser
from app.finance import service as finance_service
from app.finance import schemas as finance_schemas

# --- REGEX FALLBACK LOGIC ---
# Bộ lọc cơ bản để trả lời nhanh hoặc dùng khi mất kết nối AI
REGEX_PATTERNS = {
    r"(số dư|còn bao nhiêu|tài khoản)": "Để kiểm tra số dư, bạn hãy vào mục 'Ví của tôi' hoặc hỏi cụ thể hơn nhé!",
    r"(chi tiêu|đã tiêu|hết bao nhiêu)": "Bạn có thể xem biểu đồ chi tiêu ở màn hình chính để biết tháng này đã tiêu bao nhiêu nè.",
    r"(vay|nợ|mượn)": "Quản lý nợ rất quan trọng! Bạn hãy ghi chép lại trong phần 'Ghi nợ' để mình theo dõi giúp nhé.",
}

SYSTEM_INSTRUCTION = """
Bạn là Trợ lý AI Tài chính Cá nhân chuyên nghiệp trong dự án FoodFast.
Nhiệm vụ của bạn là hỗ trợ người dùng Việt Nam quản lý chi tiêu, tiết kiệm và lập kế hoạch tài chính.

Phong cách: Thân thiện (dùng 'mình', 'bạn'), chuyên nghiệp, tin cậy.
Dự án FoodFast: Đây là hệ thống quản lý tài chính thông minh tích hợp AI.

Quy tắc phản hồi:
1. Luôn trả về định dạng JSON nếu là yêu cầu xử lý giao dịch.
2. Nếu là trò chuyện thông thườn, hãy trả lời tự nhiên.
3. Luôn ưu tiên độ chính xác về con số.
"""

def get_gemini_response(prompt: str) -> dict:
    """
    Gọi trực tiếp Gemini API qua REST thay vì dùng SDK để đảm bảo ổn định.
    Tích hợp xử lý lỗi chuyên sâu (429, 401, 403) và Regex Fallback.
    """
    
    # 1. Kiểm tra Regex Fallback trước khi gọi API (Tiết kiệm Token & Phản hồi nhanh)
    for pattern, fallback_msg in REGEX_PATTERNS.items():
        if re.search(pattern, prompt.lower()):
            return {
                "answer": fallback_msg,
                "intent": "regex_fallback"
            }

    # 2. Cấu hình Endpoint
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
            
            # Xử lý các mã lỗi HTTP cụ thể
            if response.status_code == 429:
                return {
                    "answer": "Mình đang hơi mệt vì trả lời quá nhanh, bạn đợi 1 phút rồi hỏi tiếp nhé! (Lỗi 429 - Hết hạn mức)",
                    "intent": "error_rate_limit"
                }
            elif response.status_code in [401, 403]:
                return {
                    "answer": "Hệ thống đang gặp lỗi xác thực (API Key). Bạn vui lòng kiểm tra lại cấu hình trong file .env nhé!",
                    "intent": "error_auth"
                }
            
            response.raise_for_status()
            result = response.json()
            
            # Trích xuất nội dung từ cấu trúc trả về của Gemini
            content = result['candidates'][0]['content']['parts'][0]['text']
            return json.loads(content)

    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        # Cứu cánh cuối cùng: Nếu sập mạng toàn tập thì dùng Regex hoặc báo lỗi nhẹ
        return {
            "answer": "Kết nối của mình đang chập chờn một chút. Bạn thử lại sau vài giây hoặc kiểm tra mạng nhé!",
            "intent": "error_network"
        }

def answer_chat(db: Session, current_user: RequestUser, text: str) -> dict:
    """
    Hàm chính xử lý tin nhắn từ Frontend
    """
    ai_result = get_gemini_response(text)
    
    # Logic xử lý nghiệp vụ dựa trên intent trả về từ AI (Ví dụ trích xuất giao dịch)
    # ... (Phần này có thể tích hợp với logic lưu DB của bạn) ...
    
    return {
        "answer": ai_result.get("answer") or ai_result.get("friendly_response") or "Mình đã nhận được thông tin.",
        "intent": ai_result.get("intent", "UNKNOWN"),
        "total": ai_result.get("data", {}).get("amount"),
        "category_name": ai_result.get("data", {}).get("category")
    }
