import requests
import json

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
print("\nSending chat request to AI...")
chat_payload = {
    "text": "Mới được mẹ cho 500k, ăn tối 150k, đổ xăng 50k"
}
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

try:
    response = requests.post(f"{base_url}/api/v1/ai/chat", headers=headers, json=chat_payload)
    response.raise_for_status()
    chat_result = response.json()
    print("\nAI Chat Response:")
    print(json.dumps(chat_result, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Chat request failed: {e}")
