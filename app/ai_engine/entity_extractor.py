# Mục tiêu: Trích xuất thông tin chi tiết từ câu hỏi người dùng (số tiền, loại giao dịch, ngày tháng...)
# Module dùng regex + keyword mapping
import re
from datetime import date, timedelta

CATEGORY_KEYWORDS = {
    "Food": ["ăn", "cơm", "sáng", "trưa", "tối", "bún", "phở"],
    "Beverage": ["cafe", "cà phê", "tra", "trà", "nước"],
    "Transport": ["xăng", "taxi", "grab", "bus", "xe"],
    "Shopping": ["mua", "shop", "quần áo", "quan ao"],
}

TYPE_KEYWORDS = {
    "expense": ["chi", "mua", "trả", "thanh toán", "thanh toan"],
    "income": ["thu", "nhận", "lương", "luong", "hoàn", "refund"],
}

AMOUNT_REGEX = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(k|nghìn|nghin|tr|triệu|trieu|m|đ|vnd|₫)\b",
    re.IGNORECASE,
)

MONTH_REGEX = re.compile(r"tháng\s*(\d{1,2})", re.IGNORECASE)


def extract_amount(text: str) -> float | None:
    match = AMOUNT_REGEX.search(text)
    if not match:
        return None
    raw = match.group(1).replace(",", ".")
    unit = match.group(2).lower()

    value = float(raw)
    if unit in ["k", "nghìn", "nghin"]:
        value *= 1_000
    elif unit in ["tr", "triệu", "trieu", "m"]:
        value *= 1_000_000
    else:
        value *= 1

    return value


def extract_category(text: str) -> str | None:
    t = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(k in t for k in keywords):
            return category
    return None


def extract_date(text: str) -> date | None:
    t = text.lower()
    today = date.today()
    if "hôm nay" in t:
        return today
    if "hôm qua" in t:
        return today - timedelta(days=1)
    if "hôm kia" in t:
        return today - timedelta(days=2)
    return None


def extract_month(text: str) -> int | None:
    match = MONTH_REGEX.search(text)
    if not match:
        return None
    month = int(match.group(1))
    return month if 1 <= month <= 12 else None


def extract_type(text: str) -> str | None:
    t = text.lower()
    for t_type, keywords in TYPE_KEYWORDS.items():
        if any(k in t for k in keywords):
            return t_type
    return None


def extract_entities(text: str) -> dict:
    return {
        "amount": extract_amount(text),
        "category": extract_category(text),
        "date": extract_date(text),
        "month": extract_month(text),
        "type": extract_type(text),
    }
