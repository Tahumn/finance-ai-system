import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add workspace root to Python path
sys.path.insert(0, os.getcwd())

from app.ai_agent import microservice_service as s

print("--- TESTING FALLBACK / HEURISTIC EXTRACTOR ---")
for text in ["Mới được mẹ cho 500k", "ăn tối 150k", "đổ xăng 50k", "lương về 10tr", "bố cho 2tr"]:
    print(f"\nText: '{text}'")
    tx_type = s._detect_transaction_type(text)
    cat_name = s._pick_category_name(text)
    amount = s._extract_amount(text)
    print(f"  Detected Type: {tx_type}")
    print(f"  Picked Category: {cat_name}")
    print(f"  Extracted Amount: {amount}")
