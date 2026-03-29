import os
import json
import urllib.request
from app.core.config import settings

def test_gemini():
    text = "Tôi đi mua sắm hết 1 triệu rưỡi"
    print(f"Testing with API Key: {settings.gemini_api_key}")
    
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not found in settings")
        return

    model = settings.gemini_model or "gemini-1.5-flash"
    base = (settings.gemini_api_base or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
    url = f"{base}/models/{model}:generateContent?key={settings.gemini_api_key}"
    
    system_instruction = "Bạn là Trợ lý AI chuyên nghiệp. Trả về JSON."
    
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode("utf-8"), 
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            body = json.loads(res.read().decode("utf-8"))
            print("Response body:", body)
            chat_text = body["candidates"][0]["content"]["parts"][0]["text"]
            print("Extracted text:", chat_text)
    except Exception as e:
        print(f"Exception: {e}")
        if hasattr(e, 'read'):
            print(f"Error detail: {e.read().decode('utf-8')}")

if __name__ == "__main__":
    test_gemini()
