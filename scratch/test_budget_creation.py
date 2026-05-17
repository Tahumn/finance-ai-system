import requests
import json
import sys

base_url = "http://localhost:8005"

# 1. Login to get token
print("Attempting to login...")
login_payload = {
    "username": "demo@financeai.local",
    "password": "Demo@1234"
}
try:
    response = requests.post(f"{base_url}/api/v1/auth/login", data=login_payload)
    response.raise_for_status()
    login_data = response.json()
    token = login_data["access_token"]
    print("Login successful! Token acquired.")
except Exception as e:
    print(f"Login failed: {e}")
    sys.exit(1)

# 2. Call the chat endpoint
print("\nSending chat request to AI to create a budget...")
chat_payload = {
    "text": "Tạo ngân sách đi phượt 5 triệu"
}
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

try:
    response = requests.post(f"{base_url}/api/v1/ai/chat", headers=headers, json=chat_payload)
    print("Response Status Code:", response.status_code)
    try:
        print("Response Body:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception:
        print("Response Content:", response.text)
except Exception as e:
    print(f"Chat request failed: {e}")
