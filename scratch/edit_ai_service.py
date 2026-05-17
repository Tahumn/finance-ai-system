import re

filepath = "app/ai_agent/microservice_service.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Define new CATEGORY_KEYWORDS
new_category_keywords = """CATEGORY_KEYWORDS = {
    "an": "Ăn uống", "pho": "Ăn uống", "com": "Ăn uống", "bun": "Ăn uống", "mi": "Ăn uống", "sua": "Ăn uống", "cafe": "Ăn uống", "tra": "Ăn uống", "nhau": "Ăn uống", "an uong": "Ăn uống",
    "xang": "Di chuyển", "grab": "Di chuyển", "taxi": "Di chuyển", "xe": "Di chuyển", "gui xe": "Di chuyển", "bus": "Di chuyển", "di chuyen": "Di chuyển",
    "shopee": "Mua sắm", "tiki": "Mua sắm", "lazada": "Mua sắm", "quan ao": "Mua sắm", "giay": "Mua sắm", "my pham": "Mua sắm", "sieu thi": "Mua sắm", "cho": "Mua sắm", "mua sam": "Mua sắm",
    "dien": "Hóa đơn", "nuoc": "Hóa đơn", "internet": "Hóa đơn", "wifi": "Hóa đơn", "4g": "Hóa đơn", "dien thoai": "Hóa đơn", "hoc phi": "Hóa đơn", "hoa don": "Hóa đơn",
    "luong": "Lương", "thuong": "Thưởng", "nhan": "Thu nhập khác", "duoc cho": "Thu nhập khác", "ban do": "Thu nhập khác",
    "me cho": "Thu nhập khác", "bo cho": "Thu nhập khác", "ba cho": "Thu nhập khác", "ong cho": "Thu nhập khác", "anh cho": "Thu nhập khác",
    "li xi": "Thu nhập khác", "tang": "Thu nhập khác", "duoc tang": "Thu nhập khác", "thu nhap": "Thu nhập khác",
    "thuoc": "Sức khỏe", "benh": "Sức khỏe", "kham": "Sức khỏe", "gym": "Sức khỏe", "suc khoe": "Sức khỏe",
    "phim": "Giải trí", "game": "Giải trí", "du lich": "Giải trí", "hat ho": "Giải trí", "giai tri": "Giải trí",
    "tiet kiem": "Tiết kiệm",
}"""

# Replace the CATEGORY_KEYWORDS dictionary
content_replaced = re.sub(
    r"CATEGORY_KEYWORDS\s*=\s*\{.*?\n\}",
    new_category_keywords,
    content,
    flags=re.DOTALL
)

# 2. Add _extract_custom_category function
custom_category_func = """def _extract_custom_category(text: str) -> str | None:
    # Lowercase and normalize spaces
    normalized = text.lower().strip()
    # Find position of budget keywords
    budget_kw_match = re.search(r"\\b(ngân sách|ngan sach|hạn mức|han muc)\\b", normalized)
    if not budget_kw_match:
        return None
    
    # Extract everything after the budget keyword
    after_kw = normalized[budget_kw_match.end():].strip()
    
    # Find the amount pattern (e.g. 2 triệu, 2tr, 200k, 2.000.000)
    amount_match = re.search(r"\\b\\d", after_kw)
    if not amount_match:
        return None
        
    # The text between the budget keyword and the amount is the category name
    cat_text = after_kw[:amount_match.start()].strip()
    
    # Clean up filler words from the extracted category text
    cat_text = re.sub(r"^(?:cho|cua|ve|cho\\s+muc|khoan|chi|ve\\s+muc)\\s+", "", cat_text)
    cat_text = re.sub(r"\\s+(?:la|khoang|tam|du tinh)$", "", cat_text)
    cat_text = cat_text.strip()
    
    # Capitalize the first letter for a clean category name in DB (e.g. "Mua sắm")
    if cat_text:
        return cat_text.capitalize()
    return None


def _resolve_category("""

# Inject the function right before def _resolve_category
content_replaced = content_replaced.replace("def _resolve_category(", custom_category_func)

# 3. Update _resolve_category to use the fallback custom category extractor
new_resolve_category_start = """def _resolve_category(
    text: str,
    category_name: str | None,
    auto_create_category: bool,
    authorization: str | None,
) -> tuple[int | None, str | None]:
    chosen_name = category_name or _pick_category_name(text)
    if not chosen_name:
        chosen_name = _extract_custom_category(text)
    if not chosen_name:
        return None, None"""

# Replace the start of _resolve_category
target_resolve_start = """def _resolve_category(
    text: str,
    category_name: str | None,
    auto_create_category: bool,
    authorization: str | None,
) -> tuple[int | None, str | None]:
    chosen_name = category_name or _pick_category_name(text)
    if not chosen_name:
        return None, None"""

content_replaced = content_replaced.replace(target_resolve_start, new_resolve_category_start)

# Write back to file
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content_replaced)

print("Edits successfully applied to app/ai_agent/microservice_service.py!")
