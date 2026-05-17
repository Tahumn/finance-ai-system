import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add workspace root to Python path
sys.path.insert(0, os.getcwd())

from app.ai_agent import microservice_service as s
import json

print("API KEY:", os.getenv("GEMINI_API_KEY"))
print("MODEL NAME:", os.getenv("GEMINI_MODEL_NAME"))

# Test the parsing with Gemini
res = s.ai_parse_transaction("Mới được mẹ cho 500k, ăn tối 150k, đổ xăng 50k")
print("Response:", json.dumps(res, indent=2, ensure_ascii=False))

# Test segment parsing
print("\nSegment parsing:")
for seg in ["Mới được mẹ cho 500k", "ăn tối 150k", "đổ xăng 50k"]:
    print(f"\nSegment: '{seg}'")
    parsed_seg = s.ai_parse_transaction(seg)
    print("Parsed segment:", json.dumps(parsed_seg, indent=2, ensure_ascii=False))
