import re
import unicodedata

def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return normalized.lower().strip()

EXPENSE_KEYWORDS = [
    "chi", "mua", "tra", "thanh toan", "phi", "hoa don", "an", "uong", "di lai", "xang", "taxi"
]

INCOME_KEYWORDS = [
    "thu", "luong", "lanh", "bonus", "lai", "nhan", "refund", "hoan tien", "thuong"
]

def current_has_expense(text: str) -> bool:
    normalized = _normalize_text(text)
    return any(keyword in normalized for keyword in EXPENSE_KEYWORDS)

def current_has_income(text: str) -> bool:
    normalized = _normalize_text(text)
    return any(keyword in normalized for keyword in INCOME_KEYWORDS)

def proposed_has_expense(text: str) -> bool:
    normalized = _normalize_text(text)
    for kw in EXPENSE_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    return False

def proposed_has_income(text: str) -> bool:
    normalized = _normalize_text(text)
    for kw in INCOME_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    return False

test_input = "Tôi vừa lãnh lương được 13 triệu"
print(f"Input: {test_input}")
print(f"Normalized: {_normalize_text(test_input)}")
print(f"Current Income: {current_has_income(test_input)}")
print(f"Current Expense: {current_has_expense(test_input)}")
print(f"Proposed Income: {proposed_has_income(test_input)}")
print(f"Proposed Expense: {proposed_has_expense(test_input)}")

test_input_2 = "Tôi ăn phở hết 50k"
print(f"\nInput: {test_input_2}")
print(f"Normalized: {_normalize_text(test_input_2)}")
print(f"Current Income: {current_has_income(test_input_2)}")
print(f"Current Expense: {current_has_expense(test_input_2)}")
print(f"Proposed Income: {proposed_has_income(test_input_2)}")
print(f"Proposed Expense: {proposed_has_expense(test_input_2)}")
