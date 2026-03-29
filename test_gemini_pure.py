import json
import urllib.request
import re
import socket

def _extract_json(text):
    if not text: return None
    try:
        match = re.search(r"(\{.*\})", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text)
    except Exception as e:
        print(f"Extraction error: {e}")
        return None

def test_gemini_pure():
    print("Start testing...")
    text = "Tôi đi mua sắm hết 1 triệu rưỡi"
    api_key = "AIzaSyC-JP_7ioSPhuqAJGfrnzZtciQ4YGFfcXs"
    model = "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    system_instruction = "Bạn là Trợ lý AI chuyên nghiệp. Trả về JSON."
    
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    print(f"Calling URL: {url}")
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode("utf-8"), 
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
        }
    )
    
    try:
        print("Sending request...")
        with urllib.request.urlopen(req, timeout=10) as res:
            print(f"Status: {res.status}")
            raw_body = res.read().decode("utf-8")
            print("Response body received.")
            body = json.loads(raw_body)
            chat_text = body["candidates"][0]["content"]["parts"][0]["text"]
            print("Extracted text:", chat_text)
            parsed = _extract_json(chat_text)
            print("Parsed JSON:", parsed)
    except Exception as e:
        print(f"Exception type: {type(e)}")
        print(f"Exception message: {e}")
        if hasattr(e, 'read'):
            try:
                error_body = e.read().decode('utf-8')
                print(f"Error detail: {error_body}")
            except:
                print("Could not read error body.")

if __name__ == "__main__":
    test_gemini_pure()
