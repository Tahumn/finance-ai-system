# File này xử lý nghiệp vụ:
# chat AI,
# OCR,
# phân tích giao dịch,
# parse tiếng Việt,
# classify thu/chi,
# thống kê,
# dự đoán tài chính

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List, Dict
from datetime import date as DateType, datetime, timedelta
from zoneinfo import ZoneInfo
import base64
import io
import json
import math
import re
import unicodedata
import urllib.error
import urllib.request
import os
try:
    import google.generativeai as genai  
except Exception:
    genai = None

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.auth.models import User
from app.core.config import settings
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service
from app.ai_agent.models import ChatMessage
from app.finance.models import (
    Account,
    Budget,
    Category,
    Debt,
    Goal,
    Reminder,
    Subscription,
    Transaction,
    Transfer,
    Tag,
)

try:
    import cv2  
    import numpy as np  
except Exception:
    cv2 = None
    np = None


APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Ho_Chi_Minh")


def _today_local() -> DateType:
    try:
        return datetime.now(ZoneInfo(APP_TIMEZONE)).date()
    except Exception:
        return datetime.now().date()


def _extract_json(text: str) -> dict:
    """Extract JSON object from Gemini response text (handles markdown fences)."""
    text = text.strip()
    # Try to strip markdown code fence
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find first {...} block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}



AMOUNT_UNIT_PATTERN = r"million|trieu|nghin|ngan|chai|canh|lit|ty|ti|tr|cu|xi|ca|k|m"
AMOUNT_HALF_PATTERN = r"ruoi|nua"

# Use normalized ASCII units so "trieu" is not truncated to "tr".
AMOUNT_REGEX = re.compile(
    r"(?P<num>"
    r"\d{1,3}(?:\.\d{3})+"
    r"|"
    r"\d+(?:[.,]\d+)?"
    r")"
    r"\s*"
    r"(?P<unit>k|nghin|ngàn|ngan|tr|trieu|triệu|cu|củ)"
    r"(?:\s*(?P<half>ruoi|rưỡi|nua|nửa))?",
    re.IGNORECASE
)

AMOUNT_REGEX = re.compile(
    rf"(?P<num>"
    rf"\d{{1,3}}(?:\.\d{{3}})+"
    rf"|"
    rf"\d+(?:[.,]\d+)?"
    rf")"
    rf"\s*"
    rf"(?P<unit>{AMOUNT_UNIT_PATTERN})\b"
    rf"(?:\s*(?P<half>{AMOUNT_HALF_PATTERN}))?",
    re.IGNORECASE,
)

DECIMAL_AMOUNT_WITH_UNIT_REGEX = re.compile(
    rf"\b\d+\.\d+\s*(?=(?:{AMOUNT_UNIT_PATTERN})\b)",
    re.IGNORECASE,
)

AMOUNT_UNIT_REGEX = re.compile(
    rf"\d+(?:[.,]\d+)?\s*(?:{AMOUNT_UNIT_PATTERN})\b",
    re.IGNORECASE,
)

DATE_DDMM_REGEX = re.compile(r"(?P<day>\d{1,2})[./-](?P<month>\d{1,2})(?:[./-](?P<year>\d{2,4}))?")
DATE_ISO_REGEX = re.compile(r"(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})")
DATE_TEXT_REGEX = re.compile(
    r"(?:ngay\s*)?(?P<day>\d{1,2})\s*thang\s*(?P<month>\d{1,2})(?:\s*nam\s*(?P<year>\d{2,4}))?"
)
MONTH_REGEX = re.compile(r"thang\s*(?P<month>\d{1,2})")
YEAR_REGEX = re.compile(r"nam\s*(?P<year>\d{4})")

UNIT_MULTIPLIER = {
    "k": 1_000,
    "nghin": 1_000,
    "ngan": 1_000,
    "tr": 1_000_000,
    "trieu": 1_000_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "ty": 1_000_000_000,
    "ti": 1_000_000_000,
}

COLLOQUIAL_UNIT_MULTIPLIER = {
    "cu": 1_000_000,
    "lit": 100_000,
    "xi": 100_000,
    "chai": 1_000_000,
    "canh": 1_000,
    "ca": 1_000,
}

# Merger slang units into main multiplier for heuristic consistency
UNIT_MULTIPLIER.update(COLLOQUIAL_UNIT_MULTIPLIER)
UNIT_MULTIPLIER.update({
    "k": 1000, "nghin": 1000, "ngan": 1000,
    "tr": 1000000, "triệu": 1000000, "tỷ": 1000000000
})


VN_NUMBER_WORDS = {
    "khong": 0,
    "mot": 1,
    "hai": 2,
    "ba": 3,
    "bon": 4,
    "tu": 4,
    "nam": 5,
    "lam": 5,
    "sau": 6,
    "bay": 7,
    "tam": 8,
    "chin": 9,
}

INCOME_KEYWORDS = [
    "thu", "nhận", "lãnh lương", "lương", "bonus", "thưởng", "refund", "hoàn tiền",
    "ting ting", "về tiền", "vào tiền", "bank vào", "ck tới", "paypal về", "khách ck", 
    "khách trả", "job về", "ăn kèo", "có kèo", "deal xong", "có project",
    "mẹ cho", "ba cho", "được cho", "được tặng", "lì xì", "được lì xì",
    "chốt lời", "có lãi", "trade lời", "bán coin", "bán cổ phiếu"
]

EXPENSE_KEYWORDS = [
    "chi", "chi tiêu", "mua", "trả", "thanh toán", "đóng", "tốn", "mất", "hết", "xài", "tiêu", "ứng",
    "ăn", "uống", "ăn vặt", "ăn sáng", "ăn trưa", "ăn tối", "buffet", "lẩu", "nướng", "trà sữa", "cà phê", "cafe",
    "bay", "bay màu", "bay mất", "đốt", "đốt tiền", "ném", "ném tiền", "đập ví", "rách ví", "rút ví", 
    "thủng ví", "viêm màng túi", "khom lưng", "xả ví", "rút máu", "toang", "đau ví",
    "order", "lên đơn", "chốt đơn", "săn sale", "flash sale", "cop", "hốt", "tậu", "quất", "gom",
    "grab", "be", "taxi", "book xe", "đổ xăng", "bơm xăng", "gửi xe",
    "nộp", "học phí", "trả nợ", "trả góp", "bill"
]

EXPENSE_KEYWORDS.extend([
    "tru", "trừ", "phat", "phạt", "tien phat", "tiền phạt",
])

CORRECTION_KEYWORDS = [
    "nhầm", "ghi sai", "sai rồi", "không phải", "à không", "ý là", "sửa lại", "đổi lại", "đổi thành", 
    "phải là", "mới đúng", "ghi nhầm", "fix lại", "edit lại", "cập nhật lại", "tôi nói nhầm", 
    "viết nhầm", "nhầm lẫn", "không tính", "bỏ giao dịch đó", "xóa giao dịch đó"
]

DELETE_KEYWORDS = ["xóa", "hủy", "remove", "delete", "undo", "rollback", "bỏ"]
CONFIRM_KEYWORDS = ["ok", "oke", "okela", "yes", "yep", "uhm", "đúng rồi", "chuẩn", "xác nhận"]
REJECT_KEYWORDS = ["không", "ko", "k", "không phải", "sai rồi", "hủy", "bỏ đi", "cancel"]
MULTI_CONNECTORS = ["rồi", "xong", "sau đó", "kèm", "với", "và", "cùng với", "&"]
RECENT_REFERENCE_KEYWORDS = ["hồi nãy", "lúc nãy", "vừa rồi", "mới đây", "gần nhất", "giao dịch đó", "cái đó", "bill đó"]


def _has_income_keyword(text: str) -> bool:
    normalized = _normalize_text(text)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    for kw in INCOME_KEYWORDS:
        # Normalize the keyword as well to ensure match against normalized text
        kw_norm = _normalize_text(kw)
        if not kw_norm:
            continue
        if " " in kw_norm:
            if kw_norm in normalized:
                return True
        else:
            if re.search(rf"\b{re.escape(kw_norm)}\b", normalized):
                return True

    return False


def _has_expense_keyword(text: str) -> bool:
    normalized = _normalize_text(text)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    for kw in EXPENSE_KEYWORDS:
        # Normalize the keyword as well
        kw_norm = _normalize_text(kw)
        if not kw_norm:
            continue
        if " " in kw_norm:
            if kw_norm in normalized:
                return True
        else:
            if re.search(rf"\b{re.escape(kw_norm)}\b", normalized):
                return True

    return False

CATEGORY_KEYWORDS = {
    # FOOD & DRINKS
    "cơm": "Ăn uống", "phở": "Ăn uống", "bún": "Ăn uống", "hủ tiếu": "Ăn uống", "mì": "Ăn uống",
    "lẩu": "Ăn uống", "nướng": "Ăn uống", "pizza": "Ăn uống", "gà rán": "Ăn uống", "đồ ăn": "Ăn uống",
    "ăn vặt": "Ăn uống", "buffet": "Ăn uống", "ăn sáng": "Ăn uống", "ăn trưa": "Ăn uống", "ăn tối": "Ăn uống",
    "hamburger": "Ăn uống", "banh mi": "Ăn uống",
    "trà sữa": "Ăn uống", "cà phê": "Ăn uống", "cafe": "Ăn uống", "cf": "Ăn uống", "matcha": "Ăn uống",
    "highland": "Ăn uống", "starbucks": "Ăn uống", "phúc long": "Ăn uống", "katinat": "Ăn uống",
    "grabfood": "Ăn uống", "shopeefood": "Ăn uống", "befood": "Ăn uống",

    # TRANSPORT
    "grab": "Di chuyển", "be": "Di chuyển", "gojek": "Di chuyển", "taxi": "Di chuyển", "xe ôm": "Di chuyển",
    "metro": "Di chuyển", "bus": "Di chuyển", "xe buýt": "Di chuyển", "xăng": "Di chuyển", 
    "đổ xăng": "Di chuyển", "gửi xe": "Di chuyển",

    # SHOPPING
    "shopee": "Mua sắm", "lazada": "Mua sắm", "tiki": "Mua sắm", "tiktok shop": "Mua sắm", 
    "mua sắm": "Mua sắm", "order": "Mua sắm", "áo": "Mua sắm", "quần": "Mua sắm", "giày": "Mua sắm", 
    "dép": "Mua sắm", "túi": "Mua sắm", "mỹ phẩm": "Mua sắm", "skin care": "Mua sắm",

    # TECHNOLOGY
    "iphone": "Công nghệ", "ipad": "Công nghệ", "bàn phím": "Công nghệ", "chuột": "Công nghệ",

    # ENTERTAINMENT
    "netflix": "Giải trí", "spotify": "Giải trí", "karaoke": "Giải trí", "game": "Giải trí", 
    "steam": "Giải trí", "valorant": "Giải trí", "pubg": "Giải trí", "lol": "Giải trí", 
    "bar": "Giải trí", "club": "Giải trí", "beer": "Giải trí", "nhậu": "Giải trí",

    # HEALTH
    "thuốc": "Sức khỏe", "bệnh viện": "Sức khỏe", "khám": "Sức khỏe", "gym": "Sức khỏe", "vitamin": "Sức khỏe",

    # EDUCATION
    "học phí": "Giáo dục", "course": "Giáo dục", "udemy": "Giáo dục", "coursera": "Giáo dục", 
    "toeic": "Giáo dục", "ielts": "Giáo dục",

    # HOUSING
    "tiền nhà": "Nhà cửa", "điện": "Nhà cửa", "nước": "Nhà cửa", "wifi": "Nhà cửa", "internet": "Nhà cửa",
}

ONBOARDING_USAGE_PHRASES = (
    "app nay dung de lam gi",
    "ung dung nay dung de lam gi",
    "app dung de lam gi",
    "app nay lam gi",
    "ung dung nay lam gi",
    "ung dung nay de lam gi",
)
ONBOARDING_START_PHRASES = (
    "bat dau nhu the nao",
    "bat dau nhu nao",
    "lam sao bat dau",
    "bat dau the nao",
    "lam sao de bat dau",
)
ONBOARDING_RECORD_PHRASES = (
    "nen ghi chi tieu kieu gi",
    "ghi chi tieu kieu gi",
    "ghi chi tieu nhu the nao",
    "ghi chi tieu ra sao",
)

TRANSACTION_CREATE_KEYWORDS = ("ghi", "them", "tao", "nhap")
TRANSACTION_UPDATE_KEYWORDS = ("sua", "cap nhat", "doi", "chinh sua")
TRANSACTION_DELETE_KEYWORDS = ("xoa", "huy", "bo")
TRANSFER_KEYWORDS = ("chuyen", "ck")
ACCOUNT_CREATE_KEYWORDS = ("them vi", "tao vi", "them tai khoan", "tao tai khoan")
RECENT_REFERENCE_KEYWORDS = ("vua roi", "gan nhat", "moi nhat", "vua moi")
CURRENCY_HINTS = ("vnd", "dong", "đ", "usd", "$", "eur", "yen", "jpy")

QUESTION_HINTS = ("bao nhieu", "tong", "co khong", "khong", "bao gio", "?")

OCR_TOTAL_KEYWORDS = (
    "tong cong",
    "tong tien",
    "tong",
    "cong",
    "thanh toan",
    "phai thanh toan",
    "phai tra",
    "tong thanh toan",
    "tong tien thanh toan",
    "tong gia tri thanh toan",
    "so tien",
    "amount due",
    "grand total",
    "total",
    "pay",
)
OCR_SUBTOTAL_KEYWORDS = (
    "tam tinh",
    "subtotal",
    "thue",
    "vat",
    "tax",
    "phi",
    "giam gia",
    "discount",
    "chiet khau",
    "tien thua",
    "change",
    "tien khach",
    "cash",
)
OCR_MERCHANT_SKIP_KEYWORDS = (
    "hoa don",
    "receipt",
    "invoice",
    "bill",
    "dia chi",
    "address",
    "sdt",
    "phone",
    "tel",
    "tax",
    "mst",
    "ma so thue",
    "ngay",
    "date",
    "time",
)
OCR_DATE_HINTS = ("ngay", "date", "time", "gio")
OCR_DUE_DATE_HINTS = ("truoc ngay", "han", "due", "thanh toan", "payment")
OCR_VAT_KEYWORDS = ("vat", "thue gtgt", "tien thue", "thue", "tax", "gtgt")
OCR_ESTIMATE_KEYWORDS = (
    "tam tinh",
    "subtotal",
    "estimated",
    "uoc tinh",
    "du kien",
    "tong truoc thue",
    "gia truoc thue",
    "cong tien hang",
    "cong tien hang hoa",
    "tong tien hang",
    "tien hang",
)
OCR_PRETAX_KEYWORDS = ("truoc thue", "pre tax", "before tax")
OCR_NOTE_KEYWORDS = ("ghi chu", "note", "chu thich")
OCR_MERCHANT_HINTS = ("don vi ban hang", "cua hang", "cong ty", "store", "shop", "market")
OCR_MERCHANT_IGNORE = ("xuat hoa don cho", "nguoi mua", "buyer", "khach hang")

STOPWORDS = {
    "giao",
    "dich",
    "mua",
    "ban",
    "toi",
    "minh",
    "vua",
    "roi",
    "hom",
    "nay",
    "qua",
    "thang",
    "nam",
    "sua",
    "cap",
    "nhat",
    "doi",
    "thanh",
    "xoa",
    "huy",
    "bo",
    "cho",
    "va",
    "tu",
    "den",
    "tren",
    "duoi",
    "bao",
    "nhieu",
}

CHAT_INTENT_SCHEMA = {
    "name": "chat_intent",
    "schema": {
        "type": "object",
        "properties": {
            "intent": {
                "type": "string",
                "enum": [
                    "summary",
                    "expense_total",
                    "income_total",
                    "category_breakdown",
                    "onboarding",
                    "create_transaction",
                    "update_transaction",
                    "delete_transaction",
                    "transfer",
                    "report_summary",
                    "compare_months",
                    "daily_chart",
                    "search_transactions",
                    "budget_set",
                    "budget_status",
                    "budget_overrun",
                    "goal_set",
                    "goal_status",
                    "debt_status",
                    "debt_payment",
                    "reminder_set",
                    "subscription_set",
                    "subscription_total",
                    "category_rename",
                    "category_merge",
                    "export_data",
                    "import_data",
                ],
            },
            "category_name": {"type": ["string", "null"]},
            "start_date": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
            "end_date": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
        },
        "required": ["intent"],
        "additionalProperties": False,
    },
}

TRANSACTION_SCHEMA = {
    "name": "transaction_parse",
    "schema": {
        "type": "object",
        "properties": {
            "description": {"type": ["string", "null"]},
            "amount": {"type": ["number", "string", "null"]},
            "transaction_type": {"type": ["string", "null"], "enum": ["income", "expense", None]},
            "category_name": {"type": ["string", "null"]},
            "date": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
        },
        "required": [],
        "additionalProperties": False,
    },
}

@dataclass
class _PendingIntent:
    intent: str
    category_name: str | None
    created_at: datetime


@dataclass
class _PendingAction:
    action: str
    candidate_ids: list[int] | None
    payload: dict | None
    created_at: datetime


@dataclass
class _Budget:
    category_name: str
    limit: float
    period: str
    created_at: datetime


@dataclass
class _Goal:
    target: float
    months: int
    created_at: datetime


@dataclass
class _Subscription:
    name: str
    amount: float
    day_of_month: int | None
    created_at: datetime


@dataclass
class _Reminder:
    label: str
    date: DateType | None
    channel: str | None
    created_at: datetime


_PENDING_BY_USER: dict[int, _PendingIntent] = {}
_PENDING_TTL_SECONDS = 10 * 60
_PENDING_ACTION_BY_USER: dict[int, _PendingAction] = {}
_BUDGETS_BY_USER: dict[int, dict[str, _Budget]] = {}
_GOALS_BY_USER: dict[int, _Goal] = {}
_SUBSCRIPTIONS_BY_USER: dict[int, dict[str, _Subscription]] = {}
_REMINDERS_BY_USER: dict[int, list[_Reminder]] = {}


@dataclass
class _Debt:
    creditor: str
    amount: float
    due_date: DateType | None
    created_at: datetime


@dataclass
class _Transfer:
    amount: float
    source: str
    target: str
    date: DateType
    created_at: datetime


_DEBTS_BY_USER: dict[int, list[_Debt]] = {}
_TRANSFERS_BY_USER: dict[int, list[_Transfer]] = {}
_ACCOUNTS_BY_USER: dict[int, set[str]] = {}


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    # Normalize text
    text = text.lower().strip()
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    # Thay thế teencode phổ biến cho heuristic
    teencode_map = {
        "ko": "khong", "k": "khong", "dc": "duoc", "đc": "duoc", 
        "nham": "nham", "lộn": "nham", "lon": "nham"
    }
    for k, v in teencode_map.items():
        text = re.sub(rf"\b{k}\b", v, text)
    return text.strip()


def _normalize_text_basic(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8").strip()


def _strip_date_fragments(text: str) -> str:
    protected: dict[str, str] = {}

    def _protect_decimal_amount(match: re.Match) -> str:
        key = f"__amt_decimal_{len(protected)}__"
        protected[key] = match.group(0)
        return key

    # Preserve decimal amounts such as "5.5 trieu" before removing date-like fragments.
    text = DECIMAL_AMOUNT_WITH_UNIT_REGEX.sub(_protect_decimal_amount, text)
    text = DATE_ISO_REGEX.sub(" ", text)
    text = DATE_DDMM_REGEX.sub(" ", text)
    text = DATE_TEXT_REGEX.sub(" ", text)
    text = re.sub(r"thang\s*\d{1,2}", " ", text)
    text = re.sub(r"nam\s*\d{4}", " ", text)
    for key, value in protected.items():
        text = text.replace(key, value)
    return text


def _parse_date(text: str) -> DateType | None:
    normalized = _normalize_text(text)
    today = _today_local()
    if "hom nay" in normalized or "today" in normalized:
        return today
    if "hom qua" in normalized or "yesterday" in normalized:
        return today - timedelta(days=1)
    if "tomorrow" in normalized or "ngay mai" in normalized:
        return today + timedelta(days=1)

    iso_match = DATE_ISO_REGEX.search(normalized)
    if iso_match:
        try:
            return DateType(
                int(iso_match.group("year")),
                int(iso_match.group("month")),
                int(iso_match.group("day")),
            )
        except ValueError:
            return None

    text_match = DATE_TEXT_REGEX.search(normalized)
    if text_match:
        day = int(text_match.group("day"))
        month = int(text_match.group("month"))
        year_raw = text_match.group("year")
        year = today.year
        if year_raw:
            year = int(year_raw)
            if year < 100:
                year += 2000
        try:
            return DateType(year, month, day)
        except ValueError:
            return None

    match = DATE_DDMM_REGEX.search(normalized)
    if not match:
        return None
    day = int(match.group("day"))
    month = int(match.group("month"))
    year_raw = match.group("year")
    year = today.year
    if year_raw:
        year = int(year_raw)
        if year < 100:
            year += 2000
    try:
        return DateType(year, month, day)
    except ValueError:
        return None


def _parse_iso_date(value: str) -> DateType | None:
    try:
        return DateType.fromisoformat(value)
    except ValueError:
        return None


def _coerce_date_value(value: object) -> DateType | None:
    if value is None:
        return None
    if isinstance(value, DateType):
        return value
    if isinstance(value, str):
        return _parse_iso_date(value) or _parse_date(value)
    return None


def _is_question(text: str) -> bool:
    normalized = _normalize_text(text)
    if text.strip().endswith("?"):
        return True
    return any(hint in normalized for hint in QUESTION_HINTS)


def _is_greeting(text: str) -> bool:
    normalized = _normalize_text(text)
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return False

    greetings = {
        "xin chao",
        "chao",
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "chao ban",
        "chao minh",
    }
    if normalized in greetings:
        return True

    return bool(re.search(r"\b(xin\s*chao|chao|hello|hi|hey)\b", normalized))


MULTI_CONNECTOR_REGEX = re.compile(
    r"\b(?:nhung|nhưng|va|và|roi|rồi|sau do|sau đó|dong thoi|đồng thời|cung|cũng|kem theo|kèm theo|kem|kèm)\b",
    re.IGNORECASE,
)


def _split_transaction_segments(text: str) -> list[str]:

    if not text or not text.strip():
        return []

    parts = re.split(
        r",|;|&|\b(?:va|và|nhung|nhưng|roi|rồi|sau do|sau đó|cung voi|cùng với|dong thoi|đồng thời|kem theo|kèm theo|kem|kèm)\b",
        text,
        flags=re.IGNORECASE,
    )

    parts = [p.strip(" ,.;") for p in parts if p.strip()]

    if len(parts) <= 1:
        return [text.strip()]

    return parts


def _extract_multi_transactions(
    db: Session,
    current_user: User,
    text: str,
) -> list[dict]:
    segments = _split_transaction_segments(text)
    if len(segments) < 2:
        return []

    explicit_date = _parse_date(text)
    candidates: list[dict] = []
    for segment in segments:
        parsed = parse_transaction_text(
            db,
            current_user,
            segment,
            auto_create_category=True,
            use_llm=False,
        )
        amount = parsed.get("amount")
        if amount is None:
            continue
        tx_type = parsed.get("transaction_type")
        tx_type = _infer_transaction_type(segment, tx_type)
        if tx_type not in ("income", "expense"):
            continue

        segment_date = _parse_date(segment)
        date_value = parsed.get("date")
        if explicit_date and not segment_date:
            date_value = explicit_date

        candidates.append(
            {
                "amount": amount,
                "transaction_type": tx_type,
                "category_id": parsed.get("category_id"),
                "category_name": parsed.get("category_name"),
                "note": parsed.get("description") or segment,
                "date": date_value,
            }
        )

    if len(candidates) < 2:
        return []
    return candidates


def _normalize_transaction_type(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = _normalize_text(value)
    mapping = {
        "income": "income",
        "thu": "income",
        "thu nhap": "income",
        "save_income": "income",
        "expense": "expense",
        "chi": "expense",
        "chi tieu": "expense",
        "save_expense": "expense",
    }
    return mapping.get(normalized)


def _infer_transaction_type(text: str, fallback: str | None = None) -> str:
    normalized = _normalize_text(text)
    income_hit = _has_income_keyword(normalized)
    expense_hit = _has_expense_keyword(normalized)
    if income_hit and not expense_hit:
        return "income"
    if expense_hit and not income_hit:
        return "expense"

    if fallback in ("income", "expense"):
        return fallback

    if _has_income_keyword(text):
        return "income"

    if _has_expense_keyword(text):
        return "expense"

    return "unknown"


def _extract_quoted(text: str) -> list[str]:
    results = re.findall(r"['\"]([^'\"]+)['\"]", text)
    return [item.strip() for item in results if item.strip()]


def _extract_search_term(text: str) -> str | None:
    quoted = _extract_quoted(text)
    if quoted:
        return quoted[0]
    normalized = _normalize_text(text)
    match = re.search(r"giao dich\s+(?P<term>.+)", normalized)
    if match:
        term = match.group("term").strip()
        term = re.sub(r"thang\s+\d+.*$", "", term).strip()
        return term or None
    return None


def _tokenize_keywords(text: str) -> list[str]:
    normalized = _normalize_text(text)
    tokens = re.split(r"[\s,.;:!?]+", normalized)
    keywords = [token for token in tokens if token and token not in STOPWORDS and len(token) > 2]
    return keywords


def _format_tx_line(tx: Transaction) -> str:
    return f"{tx.date} - {tx.description} - {tx.amount}"


def _extract_category_rename(text: str) -> tuple[str, str] | None:
    quoted = _extract_quoted(text)
    if len(quoted) >= 2:
        return quoted[0], quoted[1]
    normalized = _normalize_text(text)
    match = re.search(r"doi ten danh muc\s+(?P<old>.+?)\s+thanh\s+(?P<new>.+)", normalized)
    if match:
        old = match.group("old").strip()
        new = match.group("new").strip()
        if old and new:
            return old, new
    return None


def _extract_category_merge(text: str) -> tuple[str, str] | None:
    quoted = _extract_quoted(text)
    if len(quoted) >= 2:
        return quoted[0], quoted[1]
    normalized = _normalize_text(text)
    match = re.search(r"gop danh muc\s+(?P<src>.+?)\s+vao\s+(?P<dst>.+)", normalized)
    if match:
        src = match.group("src").strip()
        dst = match.group("dst").strip()
        if src and dst:
            return src, dst
    return None


def _to_number(value: str) -> float | None:
    clean = value.strip().replace(",", ".")
    try:
        return float(clean)
    except ValueError:
        return None


def _parse_vn_number_words(phrase: str) -> float | None:
    tokens = [token for token in phrase.split() if token]
    if not tokens:
        return None
    if any(token not in VN_NUMBER_WORDS and token not in ("muoi", "tram", "le", "linh", "ruoi") for token in tokens):
        return None

    value = 0.0
    idx = 0
    n = len(tokens)

    if n >= 2 and tokens[1] == "tram":
        hundred = VN_NUMBER_WORDS.get(tokens[0])
        if hundred is None:
            return None
        value += hundred * 100
        idx = 2

    if idx < n and tokens[idx] in ("le", "linh"):
        idx += 1

    if idx < n:
        if tokens[idx] == "muoi":
            value += 10
            idx += 1
            if idx < n and tokens[idx] not in ("ruoi",):
                digit = VN_NUMBER_WORDS.get(tokens[idx])
                if digit is None:
                    return None
                value += digit
                idx += 1
        elif idx + 1 < n and tokens[idx + 1] == "muoi":
            tens = VN_NUMBER_WORDS.get(tokens[idx])
            if tens is None:
                return None
            value += tens * 10
            idx += 2
            if idx < n and tokens[idx] not in ("ruoi",):
                digit = VN_NUMBER_WORDS.get(tokens[idx])
                if digit is None:
                    return None
                value += digit
                idx += 1
        else:
            digit = VN_NUMBER_WORDS.get(tokens[idx])
            if digit is None:
                return None
            value += digit
            idx += 1

    if idx < n and tokens[idx] == "ruoi":
        value += 0.5
        idx += 1

    if idx != n:
        return None
    return value


def _extract_colloquial_amount_candidates(normalized_text: str) -> list[float]:
    candidates: list[float] = []
    pattern = re.compile(r"\b(?P<unit>cu|lit|xi)\b", re.IGNORECASE)
    for match in pattern.finditer(normalized_text):
        unit = match.group("unit").lower()
        multiplier = COLLOQUIAL_UNIT_MULTIPLIER.get(unit)
        if multiplier is None:
            continue

        prefix = normalized_text[: match.start()]
        tokens = re.findall(r"[a-z0-9.,]+", prefix)
        if not tokens:
            continue

        max_len = min(5, len(tokens))
        for length in range(max_len, 0, -1):
            phrase = " ".join(tokens[-length:])
            if not phrase:
                continue
            base_value = _to_number(phrase) if re.fullmatch(r"\d+(?:[.,]\d+)?", phrase) else _parse_vn_number_words(phrase)
            if base_value is None:
                continue
            candidates.append(base_value * multiplier)
            break
    return candidates


def _parse_amount(text: str) -> float | None:
    normalized = _strip_date_fragments(_normalize_text(text))
    # Loại bỏ khoảng trắng bị Tesseract chen vào giữa các số
    normalized = re.sub(r"(\d),(\d)", r"\1.\2", normalized)
    normalized = re.sub(r"(?<=\d)\s*([.,])\s*(?=\d)", r"\1", normalized)
    normalized = re.sub(r"(?<=\d)\s+(?=\d{3}(?:\s|\b|$))", "", normalized)
    normalized = re.sub(r"(?<=\d)\s+(?=\d{3}(?:\s|\b|$))", "", normalized)

    # Loại bỏ dấu phân cách hàng nghìn (dấu chấm hoặc phẩy)
    normalized = re.sub(r"\b\d{1,3}(?:\.\d{3})+\b", lambda match: match.group(0).replace(".", ""), normalized)
    normalized = re.sub(r"\b\d{1,3}(?:,\d{3})+\b", lambda match: match.group(0).replace(",", ""), normalized)
    
    matches = []

    for match in AMOUNT_REGEX.finditer(normalized):

        raw_num = match.group("num")

        if not raw_num:
            continue

        # 1.500.000
        if raw_num.count(".") > 1:
            clean_num = raw_num.replace(".", "")

        # 1,5
        elif "," in raw_num and "." not in raw_num:
            clean_num = raw_num.replace(",", ".")

        # 1.5
        else:
            clean_num = raw_num

        try:
            value = float(clean_num)

        except ValueError:
            continue

        unit = match.group("unit").lower()

        multiplier = 1

        if unit:
            multiplier = UNIT_MULTIPLIER.get(unit, 1)
            value *= multiplier

        full_match = match.group(0)

        # 1 triệu rưỡi / 2 củ rưỡi
        if any(x in full_match for x in ["ruoi", "rưỡi", "nua", "nửa"]):
            value += multiplier * 0.5

        matches.append(value)

    matches.extend(_extract_colloquial_amount_candidates(normalized))
    matches = list(set(matches))

    if not matches:
        return None
    return max(matches)


def _amount_has_unit(text: str) -> bool:
    normalized = _normalize_text(text)
    if any(hint in normalized for hint in CURRENCY_HINTS):
        return True
    return AMOUNT_UNIT_REGEX.search(normalized) is not None


def _prefer_explicit_amount(text: str, ai_amount: float | None, heuristic_amount: float | None) -> float | None:
    if heuristic_amount is None:
        return ai_amount
    if ai_amount is None:
        return heuristic_amount

    normalized = _normalize_text(text)
    has_explicit_numeric_amount = bool(re.search(r"\d", normalized)) and (
        _amount_has_unit(text) or any(marker in normalized for marker in ("ruoi", "nua"))
    )
    if has_explicit_numeric_amount:
        return heuristic_amount
    return ai_amount


_OCR_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1"})


def _normalize_ocr_numeric_tokens(text: str) -> str:
    def _replace(match: re.Match) -> str:
        token = match.group(0)
        if re.search(r"\d", token):
            return token.translate(_OCR_DIGIT_FIX)
        return token

    return re.sub(r"[0-9OoIl|]+", _replace, text)


def _needs_amount_clarification(text: str, amount: float | None) -> bool:
    if amount is None:
        return True
    return not _amount_has_unit(text)


def _coerce_amount(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        return _parse_amount(value)
    return None


def _coerce_transaction_type(value: object) -> str:
    if isinstance(value, str):
        normalized = _normalize_text(value)
        if normalized in ("income", "thu", "thu nhap"):
            return "income"
        if normalized in ("expense", "chi", "chi tieu"):
            return "expense"
    return "expense"


def _is_recent_reference(text: str) -> bool:
    normalized = _normalize_text(text)
    return any(keyword in normalized for keyword in RECENT_REFERENCE_KEYWORDS)


def _extract_account_name(text: str) -> str | None:
    quoted = _extract_quoted(text)
    if quoted:
        return quoted[0]
    normalized = _normalize_text(text)
    match = re.search(r"(them|tao)\s+(vi|tai khoan)\s+(?P<name>.+)", normalized)
    if match:
        return match.group("name").strip() or None
    return None


def _parse_transfer(text: str) -> tuple[float | None, str | None, str | None, DateType | None]:
    amount = _parse_amount(text)
    date_value = _parse_date(text)
    if not date_value:
        month_range = _parse_month_range(text) or _parse_relative_range(text)
        if month_range:
            date_value = month_range[0]
    date_value = date_value or _today_local()
    normalized = _normalize_text(text)
    match = re.search(r"tu\s+(?P<src>.+?)\s+(sang|qua|toi)\s+(?P<dst>.+)", normalized)
    if match:
        src = match.group("src").strip()
        dst = match.group("dst").strip()
        return amount, src or None, dst or None, date_value
    return amount, None, None, date_value


def _parse_debt_entry(text: str) -> tuple[float | None, str | None, DateType | None]:
    amount = _parse_amount(text)
    due_date = _parse_date(text)
    quoted = _extract_quoted(text)
    if quoted:
        return amount, quoted[0], due_date
    normalized = _normalize_text(text)
    match = re.search(r"(voi|cho|cua|tu)\s+(?P<name>.+?)(?:\s+han|\s+$)", normalized)
    if match:
        return amount, match.group("name").strip() or None, due_date
    return amount, None, due_date


def _extract_account_from_text(text: str) -> str | None:
    normalized = _normalize_text(text)
    match = re.search(
        r"tu\s+(vi|tai khoan)\s+(?P<name>.+?)(?:\s+(den|vao|cho|sang|qua)\b|$)",
        normalized,
    )
    if match:
        return match.group("name").strip() or None
    return None


def _extract_reminder_channel(text: str) -> str | None:
    normalized = _normalize_text(text)
    if "email" in normalized:
        return "email"
    if "push" in normalized:
        return "push"
    if "n8n" in normalized:
        return "n8n"
    return None


def _parse_transaction_type(text: str) -> str:
    is_income = _has_income_keyword(text)
    is_expense = _has_expense_keyword(text)
    if is_income and not is_expense:
        return "income"
    if is_expense and not is_income:
        return "expense"
    return "expense"


def _pick_category_name(text: str) -> str | None:
    normalized = _normalize_text(text)
    for keyword, category in CATEGORY_KEYWORDS.items():
        if _normalize_text(keyword) in normalized:
            return category
    return None


def _parse_month_range(text: str) -> tuple[DateType, DateType] | None:
    normalized = _normalize_text(text)

    # Common user replies after a clarification prompt are short, like "3" or "12/2025".
    # Support these forms in addition to "thang 3" / "thang 12 nam 2025".
    compact = re.sub(r"\s+", "", normalized)
    short_match = re.fullmatch(r"(?P<month>\d{1,2})(?:[/-](?P<year>\d{4}))?", compact)
    if short_match:
        month = int(short_match.group("month"))
        year = int(short_match.group("year")) if short_match.group("year") else _today_local().year
    else:
        match = MONTH_REGEX.search(normalized)
        if not match:
            return None
        month = int(match.group("month"))
        year = _today_local().year

        # Support "thang 12/2025" and "thang 12-2025" in addition to "nam 2025".
        after_month = normalized[match.end() :]
        year_inline = re.search(r"^[\s]*[/-][\s]*(?P<year>\d{4})\b", after_month)
        if year_inline:
            year = int(year_inline.group("year"))
        else:
            year_match = YEAR_REGEX.search(normalized)
            if year_match:
                year = int(year_match.group("year"))

    if month < 1 or month > 12:
        return None
    start = DateType(year, month, 1)
    if month == 12:
        end = DateType(year, 12, 31)
    else:
        end = DateType(year, month + 1, 1) - timedelta(days=1)
    return start, end


def _default_month_range() -> tuple[DateType, DateType]:
    today = _today_local()
    start = DateType(today.year, today.month, 1)
    if today.month == 12:
        end = DateType(today.year, 12, 31)
    else:
        end = DateType(today.year, today.month + 1, 1) - timedelta(days=1)
    return start, end


def _month_range_for_date(target: DateType) -> tuple[DateType, DateType]:
    start = DateType(target.year, target.month, 1)
    if target.month == 12:
        end = DateType(target.year, 12, 31)
    else:
        end = DateType(target.year, target.month + 1, 1) - timedelta(days=1)
    return start, end


def _week_range_for_date(target: DateType) -> tuple[DateType, DateType]:
    start = target - timedelta(days=target.weekday())
    end = start + timedelta(days=6)
    return start, end


def _previous_week_range(target: DateType) -> tuple[DateType, DateType]:
    start = target - timedelta(days=target.weekday() + 7)
    end = start + timedelta(days=6)
    return start, end


def _parse_year_range(text: str) -> tuple[DateType, DateType] | None:
    normalized = _normalize_text(text)
    match = YEAR_REGEX.search(normalized)
    if not match:
        return None
    year = int(match.group("year"))
    return DateType(year, 1, 1), DateType(year, 12, 31)


def _parse_relative_range(text: str) -> tuple[DateType, DateType] | None:
    normalized = _normalize_text(text)
    today = _today_local()
    if "hom nay" in normalized:
        return today, today
    if "hom qua" in normalized:
        day = today - timedelta(days=1)
        return day, day
    if "tuan nay" in normalized:
        return _week_range_for_date(today)
    if "tuan truoc" in normalized:
        return _previous_week_range(today)
    if "thang nay" in normalized:
        return _month_range_for_date(today)
    if "thang truoc" in normalized:
        previous = today.replace(day=1) - timedelta(days=1)
        return _month_range_for_date(previous)
    if "nam nay" in normalized:
        return DateType(today.year, 1, 1), DateType(today.year, 12, 31)
    if "nam truoc" in normalized:
        year = today.year - 1
        return DateType(year, 1, 1), DateType(year, 12, 31)
    return None


def _range_label(start_date: DateType, end_date: DateType) -> str:
    if start_date == end_date:
        return f"ngay {start_date}"
    return f"tu {start_date} den {end_date}"


def _format_amount(value: float | int) -> str:
    return f"{float(value):.0f}"


def _set_pending_intent(user_id: int, intent: str, category_name: str | None) -> None:
    _PENDING_BY_USER[user_id] = _PendingIntent(
        intent=intent, category_name=category_name, created_at=datetime.utcnow()
    )


def _pop_pending_intent(user_id: int) -> _PendingIntent | None:
    pending = _PENDING_BY_USER.get(user_id)
    if not pending:
        return None
    age = (datetime.utcnow() - pending.created_at).total_seconds()
    if age > _PENDING_TTL_SECONDS:
        _PENDING_BY_USER.pop(user_id, None)
        return None
    _PENDING_BY_USER.pop(user_id, None)
    return pending


def _set_pending_action(
    user_id: int,
    action: str,
    candidate_ids: list[int] | None = None,
    payload: dict | None = None,
) -> None:
    _PENDING_ACTION_BY_USER[user_id] = _PendingAction(
        action=action,
        candidate_ids=candidate_ids,
        payload=payload,
        created_at=datetime.utcnow(),
    )


def _pop_pending_action(user_id: int) -> _PendingAction | None:
    pending = _PENDING_ACTION_BY_USER.get(user_id)
    if not pending:
        return None
    age = (datetime.utcnow() - pending.created_at).total_seconds()
    if age > _PENDING_TTL_SECONDS:
        _PENDING_ACTION_BY_USER.pop(user_id, None)
        return None
    _PENDING_ACTION_BY_USER.pop(user_id, None)
    return pending


def _peek_pending_action(user_id: int) -> _PendingAction | None:
    pending = _PENDING_ACTION_BY_USER.get(user_id)
    if not pending:
        return None
    age = (datetime.utcnow() - pending.created_at).total_seconds()
    if age > _PENDING_TTL_SECONDS:
        _PENDING_ACTION_BY_USER.pop(user_id, None)
        return None
    return pending


def _sum_by_category(
    db: Session,
    current_user: User,
    start_date: DateType,
    end_date: DateType,
    category_id: int | None,
    transaction_type: str,
) -> float:
    query = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.date >= start_date, Transaction.date <= end_date)
        .filter(Transaction.transaction_type == transaction_type)
    )
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    total = sum(item.amount for item in query.all())
    return float(total or 0.0)


def _count_transactions(
    db: Session,
    current_user: User,
    start_date: DateType,
    end_date: DateType,
    category_id: int | None,
    transaction_type: str | None = None,
) -> int:
    query = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.date >= start_date, Transaction.date <= end_date)
    )
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    return int(query.count())


def _list_transactions(
    db: Session,
    current_user: User,
    start_date: DateType | None = None,
    end_date: DateType | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
    account_id: int | None = None,
) -> list[Transaction]:
    return finance_service.list_transactions(
        db,
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        transaction_type=transaction_type,
        account_id=account_id,
    )


def _filter_transactions_by_keywords(transactions: list[Transaction], keywords: list[str]) -> list[Transaction]:
    if not keywords:
        return transactions
    matches: list[Transaction] = []
    for tx in transactions:
        normalized_desc = _normalize_text(tx.description)
        if any(keyword in normalized_desc for keyword in keywords):
            matches.append(tx)
    return matches


def _find_transactions_by_text(
    db: Session,
    current_user: User,
    text: str,
    start_date: DateType,
    end_date: DateType,
    category_id: int | None,
) -> list[Transaction]:
    transactions = _list_transactions(
        db,
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
    )
    if not transactions:
        return []
    keywords = _tokenize_keywords(text)
    filtered = _filter_transactions_by_keywords(transactions, keywords)
    return filtered or transactions


def _sum_expense_by_keywords(
    db: Session,
    current_user: User,
    start_date: DateType,
    end_date: DateType,
    keywords: list[str],
) -> tuple[float, int]:
    transactions = _list_transactions(
        db, current_user, start_date, end_date, None, "expense"
    )
    filtered = _filter_transactions_by_keywords(transactions, keywords)
    total = sum(tx.amount for tx in filtered)
    return float(total or 0.0), len(filtered)


def _latest_transaction(
    db: Session, current_user: User, transaction_type: str | None = None
) -> Transaction | None:
    items = _list_transactions(db, current_user, None, None, None, transaction_type)
    return items[0] if items else None


def _months_between(start_date: DateType, end_date: DateType) -> int:
    delta = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    return max(1, delta + 1)


def _resolve_time_range(text: str) -> tuple[DateType, DateType, str]:
    explicit_date = _parse_date(text)
    if explicit_date:
        return explicit_date, explicit_date, "day"
    explicit_range = _parse_month_range(text)
    if explicit_range:
        return explicit_range[0], explicit_range[1], "month"
    relative_range = _parse_relative_range(text)
    if relative_range:
        return relative_range[0], relative_range[1], "relative"
    explicit_year = _parse_year_range(text)
    if explicit_year:
        return explicit_year[0], explicit_year[1], "year"
    start, end = _default_month_range()
    return start, end, "default"


def _daily_expense_totals(transactions: list[Transaction]) -> dict[DateType, float]:
    totals: dict[DateType, float] = {}
    for tx in transactions:
        totals[tx.date] = totals.get(tx.date, 0.0) + float(tx.amount or 0.0)
    return totals

def _detect_spend_anomalies(transactions: list[Transaction]) -> list[tuple[DateType, float]]:
    """
    Simple statistical anomaly detection for daily spend totals.

    Returns a list of (date, total_spent) for days that look unusually high compared to the recent window.
    Designed to be robust and fast (no external deps).
    """

    totals = _daily_expense_totals(transactions)
    if len(totals) < 7:
        return []

    values = [v for v in totals.values() if v and v > 0]
    if len(values) < 7:
        return []

    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std = math.sqrt(variance)

    # Threshold: high relative to average and also above a z-score cutoff.
    z_cutoff = 2.0
    threshold = mean + z_cutoff * std
    threshold = max(threshold, mean * 2)

    candidates = [(day, amount) for day, amount in totals.items() if amount >= threshold]
    candidates.sort(key=lambda item: item[1], reverse=True)
    return candidates[:10]

def _analyze_anomalies_with_ai(db: Session, current_user: User, candidate_anomalies: list[tuple[DateType, float]], all_txs: list[Transaction]) -> dict[str, dict]:
    """Sử dụng AI để phân tích tính hợp lý của các điểm bất thường thống kê."""
    if not candidate_anomalies or not settings.gemini_api_key or genai is None:
        return {}
    
    # Chuẩn bị dữ liệu cho AI
    context = []
    for day, amount in candidate_anomalies:
        day_txs = [tx for tx in all_txs if tx.date == day]
        tx_details = ", ".join([f"{tx.description} ({tx.amount:,.0f}đ)" for tx in day_txs])
        context.append(f"- Ngày {day}: Tổng {amount:,.0f}đ. Các giao dịch: {tx_details}")
    
    prompt = (
        "Bạn là chuyên gia phân tích tài chính. Hệ thống phát hiện các ngày có chi tiêu cao bất thường sau đây.\n"
        "Hãy phân tích từng ngày và cho biết:\n"
        "1. Đây là bất thường thực sự (chi tiêu hoang phí, đột xuất) hay là chi tiêu định kỳ hợp lý (tiền nhà, hóa đơn, học phí)?\n"
        "2. Đưa ra một câu giải thích ngắn gọn, tinh tế (tiếng Việt).\n"
        "3. Xác định mức độ nghiêm trọng (low, medium, high).\n\n"
        "Dữ liệu:\n" + "\n".join(context) + "\n\n"
        "Trả về DUY NHẤT JSON dạng: {\"YYYY-MM-DD\": {\"reason\": \"...\", \"severity\": \"...\", \"is_structural\": true/false}}"
    )
    
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash-latest")
        response = model.generate_content(prompt)
        text_val = getattr(response, "text", "{}")
        return _extract_json(text_val) or {}
    except Exception as e:
        print(f"AI Anomaly Analysis failed: {e}")
        return {}


def get_spending_anomalies(db: Session, current_user: User) -> list[finance_schemas.AnomalyAlert]:
    # Lấy giao dịch 30 ngày qua để tính trung bình
    today = _today_local()
    start = today - timedelta(days=30)
    txs = finance_service.list_transactions(db, current_user, start_date=start, end_date=today, transaction_type="expense", limit=500)[0]
    
    candidates = _detect_spend_anomalies(txs)
    if not candidates:
        return []

    # AI Phân tích tính hợp lý
    ai_analysis = _analyze_anomalies_with_ai(db, current_user, candidates, txs)
    
    alerts = []
    for day, amount in candidates:
        day_str = day.isoformat()
        analysis = ai_analysis.get(day_str, {})
        
        reason = analysis.get("reason")
        severity = analysis.get("severity") or "medium"
        
        if not reason:
            # Fallback nếu AI lỗi
            day_txs = [tx for tx in txs if tx.date == day]
            top_tx = sorted(day_txs, key=lambda x: x.amount, reverse=True)[0]
            reason = f"Chi tiêu cao bất thường, chủ yếu từ '{top_tx.description}' ({top_tx.amount:,.0f}đ)."

        alerts.append(finance_schemas.AnomalyAlert(
            id=f"anomaly-{day}",
            date=day,
            amount=amount,
            description=f"Chi tiêu {amount:,.0f}đ vào ngày {day.strftime('%d/%m')}",
            reason=reason,
            severity=severity
        ))
    
    return alerts


def _get_user_financial_context(
    db: Session,
    current_user: User,
    months: int = 6,
) -> dict:
    """Build a financial context dict for AI prompts."""
    today = _today_local()
    start = DateType(today.year, 1, 1) if months >= 12 else (
        today.replace(day=1) if months == 1 else
        DateType(
            today.year if today.month > months else today.year - 1,
            (today.month - months) % 12 or 12,
            1
        )
    )
    # Monthly series
    monthly_data = finance_service.get_chart_data(db, current_user, limit_months=months)
    # Category breakdown for expenses
    breakdown = finance_service.get_category_breakdown(db, current_user, start_date=start, end_date=today, transaction_type="expense")
    # Summary
    summary = finance_service.get_summary(db, current_user, start_date=start, end_date=today)
    return {
        "series": [{"month": p.month, "income": p.income, "expense": p.expense} for p in monthly_data.series],
        "breakdown": [{"category": b.category, "spent": b.spent} for b in breakdown],
        "total_income": summary.total_income,
        "total_expense": summary.total_expense,
        "balance": summary.balance,
    }


def get_spending_forecast(
    db: Session,
    current_user: User,
) -> dict:
    """Phân tích và dự đoán xu hướng chi tiêu 3 tháng tới bằng Gemini."""
    from calendar import month_abbr
    ctx = _get_user_financial_context(db, current_user, months=6)

    today = _today_local()
    next_months = []
    for i in range(1, 4):
        m = (today.month - 1 + i) % 12 + 1
        y = today.year + ((today.month - 1 + i) // 12)
        next_months.append(f"{y}-{str(m).zfill(2)}")

    # Try Gemini first
    gemini_result = None
    if genai is not None and settings.gemini_api_key:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model_name = (
                os.environ.get("GEMINI_MODEL_NAME")
                or settings.gemini_model_name
                or settings.gemini_model
                or "gemini-1.5-flash-latest"
            )
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=(
                    "Bạn là chuyên gia phân tích tài chính cá nhân. "
                    "Phân tích dữ liệu thu chi và trả về dự báo dưới dạng JSON thuần (không có markdown). "
                    "Luôn dùng tiếng Việt tự nhiên trong các trường text."
                )
            )
            series_str = json.dumps(ctx["series"], ensure_ascii=False)
            breakdown_str = json.dumps(ctx["breakdown"], ensure_ascii=False)
            prompt = (
                f"Dữ liệu thu chi 6 tháng gần đây (đơn vị VND):\n{series_str}\n"
                f"Cơ cấu chi tiêu theo danh mục:\n{breakdown_str}\n"
                f"Tổng thu: {ctx['total_income']:,.0f} VND, Tổng chi: {ctx['total_expense']:,.0f} VND\n\n"
                f"Hãy dự báo chi tiêu cho 3 tháng tới: {', '.join(next_months)}.\n"
                "Trả về JSON với cấu trúc (không bao gồm markdown):\n"
                "{\"summary\": \"mô tả tóm tắt xu hướng\", "
                "\"points\": [{\"month\": \"YYYY-MM\", \"predicted_expense\": number, \"note\": \"ghi chú\"}], "
                "\"top_growing_categories\": [\"danh mục tăng mạnh\"], "
                "\"risk_level\": \"low|medium|high\", "
                "\"tips\": [\"lời khuyên\"]}"
            )
            generation_config = genai.GenerationConfig(response_mime_type="application/json")
            response = model.generate_content(prompt, generation_config=generation_config)
            if response and response.text:
                gemini_result = _extract_json(response.text)
        except Exception as e:
            print(f"Gemini Forecast Error: {e}")

    if gemini_result and "summary" in gemini_result:
        return gemini_result

    # Fallback: statistical forecast
    series = ctx["series"]
    if not series:
        return {
            "summary": "Chưa có đủ dữ liệu để dự báo xu hướng chi tiêu.",
            "points": [],
            "top_growing_categories": [],
            "risk_level": "low",
            "tips": ["Hãy bắt đầu ghi lại chi tiêu hàng ngày để nhận dự báo chính xác hơn."],
        }
    expenses = [s["expense"] for s in series if s.get("expense", 0) > 0]
    avg_expense = sum(expenses) / len(expenses) if expenses else 0
    # Simple trend: compare last 2 months
    if len(expenses) >= 2:
        trend_pct = (expenses[-1] - expenses[-2]) / (expenses[-2] or 1) * 100
    else:
        trend_pct = 0
    projected = avg_expense * (1 + trend_pct / 100)
    risk = "high" if trend_pct > 15 else "medium" if trend_pct > 5 else "low"
    top_cats = sorted(ctx["breakdown"], key=lambda x: x["spent"], reverse=True)[:3]
    return {
        "summary": (
            f"Chi tiêu trung bình {avg_expense:,.0f} VND/tháng. "
            f"Xu hướng {'tăng' if trend_pct > 0 else 'giảm'} {abs(trend_pct):.1f}% so với tháng trước."
        ),
        "points": [
            {"month": nm, "predicted_expense": round(projected * (1 + 0.02 * i)), "note": "Dựa trên xu hướng hiện tại"}
            for i, nm in enumerate(next_months)
        ],
        "top_growing_categories": [c["category"] for c in top_cats],
        "risk_level": risk,
        "tips": [
            "Theo dõi chi tiêu hàng ngày để có dự báo chính xác hơn.",
            f"Danh mục chiếm nhiều nhất: {top_cats[0]['category'] if top_cats else 'chưa xác định'}."
        ],
    }


def get_savings_suggestions(
    db: Session,
    current_user: User,
) -> dict:
    """Gợi ý kế hoạch tiết kiệm dựa trên phân tích chi tiêu thực tế bằng Gemini."""
    ctx = _get_user_financial_context(db, current_user, months=3)

    # Try Gemini first
    gemini_result = None
    if genai is not None and settings.gemini_api_key:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model_name = (
                os.environ.get("GEMINI_MODEL_NAME")
                or settings.gemini_model_name
                or settings.gemini_model
                or "gemini-1.5-flash-latest"
            )
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=(
                    "Bạn là cố vấn tài chính cá nhân thông minh. "
                    "Phân tích cơ cấu chi tiêu và đưa ra các gợi ý tiết kiệm thực tế bằng tiếng Việt. "
                    "Trả về JSON thuần (không markdown)."
                )
            )
            breakdown_str = json.dumps(ctx["breakdown"], ensure_ascii=False)
            prompt = (
                f"Cơ cấu chi tiêu 3 tháng gần đây (VND):\n{breakdown_str}\n"
                f"Tổng thu: {ctx['total_income']:,.0f} VND, Tổng chi: {ctx['total_expense']:,.0f} VND\n\n"
                "Phân tích và đưa ra gợi ý tiết kiệm thực tế. Trả về JSON:\n"
                "{\"summary\": \"tóm tắt tổng quan\", "
                "\"tips\": [{\"category\": \"tên danh mục\", \"current_spend\": number, "
                "\"suggested_limit\": number, \"potential_saving\": number, \"tip\": \"lời khuyên cụ thể\"}], "
                "\"total_potential_saving\": number, "
                "\"general_advice\": [\"lời khuyên chung\"]}"
            )
            generation_config = genai.GenerationConfig(response_mime_type="application/json")
            response = model.generate_content(prompt, generation_config=generation_config)
            if response and response.text:
                gemini_result = _extract_json(response.text)
        except Exception as e:
            print(f"Gemini Savings Error: {e}")

    if gemini_result and "summary" in gemini_result:
        return gemini_result

    # Fallback: rule-based suggestions
    breakdown = ctx["breakdown"]
    if not breakdown:
        return {
            "summary": "Chưa có đủ dữ liệu chi tiêu để phân tích.",
            "tips": [],
            "total_potential_saving": 0.0,
            "general_advice": [
                "Hãy ghi lại chi tiêu hàng ngày để nhận được gợi ý tiết kiệm cá nhân hóa.",
                "Đặt mục tiêu tiết kiệm ít nhất 20% thu nhập mỗi tháng."
            ],
        }
    sorted_cats = sorted(breakdown, key=lambda x: x["spent"], reverse=True)
    total_expense = ctx["total_expense"] or 1
    tips = []
    total_saving = 0.0
    for cat in sorted_cats[:5]:
        share = cat["spent"] / total_expense
        if share > 0.25:
            limit = cat["spent"] * 0.8
            saving = cat["spent"] - limit
            tips.append({
                "category": cat["category"],
                "current_spend": cat["spent"],
                "suggested_limit": round(limit),
                "potential_saving": round(saving),
                "tip": f"Giảm chi tiêu cho {cat['category']} xuống còn {limit:,.0f} VND/tháng (giảm 20%)."
            })
            total_saving += saving
        elif share > 0.15:
            limit = cat["spent"] * 0.9
            saving = cat["spent"] - limit
            tips.append({
                "category": cat["category"],
                "current_spend": cat["spent"],
                "suggested_limit": round(limit),
                "potential_saving": round(saving),
                "tip": f"Cân nhắc giảm nhẹ chi tiêu {cat['category']} khoảng 10%."
            })
            total_saving += saving
    income = ctx["total_income"]
    savings_rate = (income - total_expense) / income * 100 if income > 0 else 0
    return {
        "summary": (
            f"Tỷ lệ tiết kiệm hiện tại: {savings_rate:.1f}%. "
            + ("Rất tốt! Hãy duy trì." if savings_rate > 20 else
               "Cần cải thiện để đạt mục tiêu tiết kiệm 20%.")
        ),
        "tips": tips,
        "total_potential_saving": round(total_saving),
        "general_advice": [
            "Gộp mua sắm vào 1-2 lần/tuần để kiểm soát phát sinh.",
            "Đặt hạn mức ngân sách cho từng danh mục chi tiêu.",
            "Ưu tiên thanh toán tự động để tránh phát sinh phí phạt."
        ],
    }


# Mapping từ tên danh mục tiếng Anh (AI trả về) sang tiếng Việt (tên trong DB)
_EN_TO_VI_CATEGORY: dict[str, str] = {
    "food": "Ăn uống",
    "food & drink": "Ăn uống",
    "food and drink": "Ăn uống",
    "eating": "Ăn uống",
    "dining": "Ăn uống",
    "meal": "Ăn uống",
    "coffee": "Ăn uống",
    "drinks": "Ăn uống",
    "transport": "Di chuyển",
    "transportation": "Di chuyển",
    "travel": "Di chuyển",
    "commute": "Di chuyển",
    "fuel": "Di chuyển",
    "gas": "Di chuyển",
    "taxi": "Di chuyển",
    "shopping": "Mua sắm",
    "clothes": "Mua sắm",
    "clothing": "Mua sắm",
    "fashion": "Mua sắm",
    "bills": "Hóa đơn",
    "utilities": "Hóa đơn",
    "bill": "Hóa đơn",
    "electricity": "Hóa đơn",
    "water": "Hóa đơn",
    "internet": "Hóa đơn",
    "entertainment": "Giải trí",
    "fun": "Giải trí",
    "game": "Giải trí",
    "games": "Giải trí",
    "music": "Giải trí",
    "movie": "Giải trí",
    "health": "Sức khỏe",
    "healthcare": "Sức khỏe",
    "medical": "Sức khỏe",
    "medicine": "Sức khỏe",
    "gym": "Sức khỏe",
    "housing": "Nhà cửa",
    "rent": "Nhà cửa",
    "home": "Nhà cửa",
    "house": "Nhà cửa",
    "education": "Giáo dục",
    "school": "Giáo dục",
    "tuition": "Giáo dục",
    "course": "Giáo dục",
    "learning": "Giáo dục",
    "salary": "Lương",
    "wage": "Lương",
    "income": "Thu nhập khác",
    "bonus": "Thưởng",
    "investment": "Đầu tư",
    "freelance": "Freelance",
    "refund": "Hoàn tiền",
    "delivery": "Mua sắm",
    "technology": "Công nghệ",
    "tech": "Công nghệ",
    "software": "Công nghệ",
}


def _resolve_category(
    db: Session,
    current_user: User,
    category_name: str | None,
    auto_create: bool,
) -> tuple[int | None, str | None]:
    if not category_name:
        return None, None

    normalized_target = _normalize_text(category_name)

    # Bước 1: Thử map từ tiếng Anh sang tiếng Việt trước khi tìm kiếm
    vi_name = _EN_TO_VI_CATEGORY.get(category_name.lower().strip()) or _EN_TO_VI_CATEGORY.get(normalized_target)

    existing = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .all()
    )

    # Bước 2: Tìm chính xác theo tên gốc hoặc tên đã map
    for item in existing:
        item_norm = _normalize_text(item.name)
        if item_norm == normalized_target:
            return item.id, item.name
        if vi_name and item_norm == _normalize_text(vi_name):
            return item.id, item.name

    # Bước 3: Fuzzy match - tìm category chứa keyword
    for item in existing:
        item_norm = _normalize_text(item.name)
        if normalized_target in item_norm or item_norm in normalized_target:
            return item.id, item.name

    if not auto_create:
        return None, category_name

    # Bước 4: Tạo mới - ưu tiên dùng tên tiếng Việt nếu có map
    create_name = vi_name if vi_name else category_name
    # Kiểm tra xem tên tiếng Việt đó đã tồn tại chưa (phòng trùng sau map)
    for item in existing:
        if _normalize_text(item.name) == _normalize_text(create_name):
            return item.id, item.name

    created = finance_service.create_category(
        db,
        current_user,
        finance_schemas.CategoryCreate(name=create_name),
    )
    return created.id, created.name


def _normalize_phrase_for_match(text: str) -> str:
    normalized = _normalize_text_basic(text)
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


_BUDGET_CATEGORY_ALIASES: dict[str, str] = {
    "an uong": "Ăn uống",
    "do an": "Ăn uống",
    "do uong": "Ăn uống",
    "ca phe": "Ăn uống",
    "tra sua": "Ăn uống",
    "coffee": "Ăn uống",
    "food": "Ăn uống",
    "mua sam": "Mua sắm",
    "shopping": "Mua sắm",
    "fashion": "Mua sắm",
    "di chuyen": "Di chuyển",
    "xang xe": "Di chuyển",
    "transport": "Di chuyển",
    "hoa don": "Hóa đơn",
    "bill": "Hóa đơn",
    "giai tri": "Giải trí",
    "entertainment": "Giải trí",
    "suc khoe": "Sức khỏe",
    "health": "Sức khỏe",
    "nha cua": "Nhà cửa",
    "housing": "Nhà cửa",
    "giao duc": "Giáo dục",
    "education": "Giáo dục",
    "cong nghe": "Công nghệ",
    "technology": "Công nghệ",
    "du lich": "Du lịch",
    "travel": "Du lịch",
}


def _extract_budget_category_from_text(
    db: Session,
    current_user: User,
    text: str,
) -> str | None:
    normalized_text = _normalize_phrase_for_match(text)
    haystack = f" {normalized_text} "

    existing_categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .all()
    )
    ranked_existing = sorted(
        existing_categories,
        key=lambda item: len(_normalize_phrase_for_match(item.name)),
        reverse=True,
    )
    for item in ranked_existing:
        normalized_name = _normalize_phrase_for_match(item.name)
        if normalized_name and f" {normalized_name} " in haystack:
            return item.name

    ranked_aliases = sorted(_BUDGET_CATEGORY_ALIASES.items(), key=lambda item: len(item[0]), reverse=True)
    for alias, category_name in ranked_aliases:
        if f" {alias} " not in haystack:
            continue
        existing = _get_category_by_name(db, current_user, category_name)
        return existing.name if existing else category_name

    return None


# def _resolve_budget_category_name(
#     db: Session,
#     current_user: User,
#     text: str,
#     llm_category: str | None,
#     heuristic_category: str | None,
# ) -> str | None:
#     # Ưu tiên kết quả từ AI (Gemini) vì nó thông minh và linh hoạt hơn
#     if llm_category and llm_category.lower() not in ("unknown", "null", "none"):
#         return llm_category
        
#     # Nếu AI không chắc chắn, mới dùng đến bộ lọc từ khóa (Heuristic)
#     explicit_match = _extract_budget_category_from_text(db, current_user, text)
#     if explicit_match:
#         return explicit_match
        
#     return heuristic_category

def _resolve_budget_category_name(
    db: Session,
    current_user: User,
    text: str,
    llm_category: str | None,
    heuristic_category: str | None,
) -> str | None:

    # Ưu tiên AI trước
    if llm_category and llm_category.lower() not in ("unknown", "null", "none"):
        return llm_category

    # AI fail mới dùng heuristic
    explicit_match = _extract_budget_category_from_text(
        db,
        current_user,
        text,
    )

    if explicit_match:
        return explicit_match

    return heuristic_category

def _resolve_tags(db: Session, current_user: User, tag_names: list[str]) -> list[int]:
    """Tự động map hoặc tạo tag mới."""
    if not tag_names:
        return []
    
    tag_ids = []
    existing_tags = db.query(Tag).filter(Tag.user_id == current_user.id).all()
    existing_map = {_normalize_text(t.name): t for t in existing_tags}

    for name in tag_names:
        norm_name = _normalize_text(name)
        if norm_name in existing_map:
            tag_ids.append(existing_map[norm_name].id)
        else:
            # Tự động tạo tag
            new_tag = finance_service.create_tag(
                db, current_user, finance_schemas.TagCreate(name=name.strip())
            )
            existing_map[norm_name] = new_tag
            tag_ids.append(new_tag.id)
            
    return tag_ids


def _get_category_by_name(
    db: Session, current_user: User, category_name: str
) -> Category | None:
    normalized_target = _normalize_text(category_name)
    items = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .all()
    )
    for item in items:
        if _normalize_text(item.name) == normalized_target:
            return item
    return None


def _resolve_account(db: Session, current_user: User, account_name: str | None) -> Account | None:
    if not account_name:
        accounts = _list_accounts(db, current_user)
        if not accounts:
            return _ensure_account(db, current_user, "Tiền mặt")
        return accounts[0]
    normalized = _normalize_text(account_name)
    # Map common slang to full names or just use as is
    mapping = {
        "vcb": "Vietcombank",
        "tcb": "Techcombank",
        "mb": "MB Bank",
        "momo": "MoMo",
        "zlpay": "ZaloPay",
        "shopeepay": "ShopeePay",
        "tien mat": "Tiền mặt",
    }
    target_name = mapping.get(normalized, account_name)
    
    # Try finding existing account
    acc = _get_account_by_name(db, current_user, target_name)
    if acc:
        return acc
    
    # Auto-create account if it looks like a bank/wallet
    if normalized in mapping or "vi" in normalized or "ngan hang" in normalized:
        return _ensure_account(db, current_user, target_name)
    
    return None


def _list_accounts(db: Session, current_user: User) -> list[Account]:
    return (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.name.asc())
        .all()
    )


def _get_account_by_name(db: Session, current_user: User, account_name: str) -> Account | None:
    normalized_target = _normalize_text(account_name)
    items = _list_accounts(db, current_user)
    for item in items:
        if _normalize_text(item.name) == normalized_target:
            return item
    return None


def _ensure_account(
    db: Session, current_user: User, account_name: str, currency: str = "VND"
) -> Account:
    existing = _get_account_by_name(db, current_user, account_name)
    if existing:
        return existing
    account = Account(
        user_id=current_user.id,
        name=account_name,
        currency=currency,
        opening_balance=0.0,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _get_subscription_by_name(
    db: Session, current_user: User, name: str
) -> Subscription | None:
    normalized_target = _normalize_text(name)
    items = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id, Subscription.is_active.is_(True))
        .all()
    )
    for item in items:
        if _normalize_text(item.name) == normalized_target:
            return item
    return None


def _sum_transfers(
    db: Session,
    current_user: User,
    account_id: int,
    start_date: DateType | None = None,
    end_date: DateType | None = None,
) -> tuple[float, float]:
    query = (
        db.query(Transfer)
        .filter(Transfer.user_id == current_user.id)
    )
    if start_date:
        query = query.filter(Transfer.date >= start_date)
    if end_date:
        query = query.filter(Transfer.date <= end_date)
    incoming = sum(
        item.amount for item in query.filter(Transfer.to_account_id == account_id).all()
    )
    outgoing = sum(
        item.amount for item in query.filter(Transfer.from_account_id == account_id).all()
    )
    return float(incoming or 0.0), float(outgoing or 0.0)


def parse_transaction_text(
    db: Session,
    current_user: User,
    text: str,
    default_date: DateType | None = None,
    auto_create_category: bool = True,
    use_llm: bool = True,
) -> dict:
    warnings: list[str] = []
    description = text.strip() or "NLP transaction"
    amount = None
    parsed_date = None
    transaction_type = None
    category_name = None

    explicit_text_date = _parse_date(text)
    heuristic_amount = _parse_amount(text)
    llm_response = _call_gemini_chat(text) if use_llm else None
    if llm_response:
        intent = llm_response.get("intent")
        data = llm_response.get("data", {})
        
        if intent in ("SAVE_EXPENSE", "SAVE_INCOME", "create_transaction", "update_transaction"):
            amount = _prefer_explicit_amount(
                text,
                _coerce_amount(data.get("amount")),
                heuristic_amount,
            )
            if explicit_text_date:
                parsed_date = explicit_text_date
            
            # Determine type from intent or data
            if intent == "SAVE_INCOME":
                transaction_type = "income"
            elif intent == "SAVE_EXPENSE":
                transaction_type = "expense"
            else:
                transaction_type = data.get("transaction_type")
                
            # Override with keywords if explicit
            if _has_income_keyword(text) and not _has_expense_keyword(text):
                transaction_type = "income"
            elif _has_expense_keyword(text) and not _has_income_keyword(text):
                transaction_type = "expense"

            category_name = data.get("category")
            if data.get("note"):
                description = data.get("note")
            
            tag_ids = _resolve_tags(db, current_user, tag_names)

    if amount is None:
        amount = heuristic_amount
        if amount is None:
            warnings.append("amount_not_found")
    if parsed_date is None:
        parsed_date = explicit_text_date or default_date or _today_local()
    if not transaction_type:
        transaction_type = _parse_transaction_type(text)
    if not category_name:
        category_name = _pick_category_name(text)

    category_id, resolved_name = _resolve_category(
        db,
        current_user,
        category_name,
        auto_create_category,
    )

    confidence = 0.0
    if amount is not None:
        confidence += 0.4
    if parsed_date:
        confidence += 0.2
    if category_id or resolved_name:
        confidence += 0.2
    if transaction_type:
        confidence += 0.2

    return {
        "description": description,
        "amount": amount,
        "transaction_type": transaction_type,
        "category_id": category_id,
        "category_name": resolved_name,
        "tag_ids": tag_ids if 'tag_ids' in locals() else [],
        "date": parsed_date,
        "warnings": warnings,
        "confidence": round(confidence, 2),
    }


def _call_gemini_chat(text: str, history: list[ChatMessage] | None = None) -> dict | None:
    if genai is None or not settings.gemini_api_key:
        return None
    
    genai.configure(api_key=settings.gemini_api_key)
    MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME") or settings.gemini_model_name or "gemini-1.5-flash-latest"

    system_instruction = """Bạn là FoodFast AI - Trợ lý tài chính cá nhân thông minh bậc nhất.
Nhiệm vụ: Phân tích hội thoại và trích xuất dữ liệu tài chính chính xác.

HƯỚNG DẪN XỬ LÝ:
1. ĐA GIAO DỊCH (VÍ DỤ):
   - Nếu trong một câu có nhiều hành động tài chính
     (nhận tiền, chi tiêu, chuyển khoản...)
     thì LUÔN dùng intent: "create_transactions"

   - User: "Mẹ cho 200k, ăn sáng 40k, trà sữa 55k"

   - Output:
     {
       "intent": "create_transactions",
       "transactions": [
         {
           "amount": 200000,
           "transaction_type": "income",
           "category": "Quà tặng",
           "description": "Mẹ cho"
         },
         {
           "amount": 40000,
           "transaction_type": "expense",
           "category": "Ăn uống",
           "description": "Ăn sáng"
         },
         {
           "amount": 55000,
           "transaction_type": "expense",
           "category": "Ăn uống",
           "description": "Trà sữa"
         }
       ]
     }

   - User: "Tôi vừa nhận được 100k từ mẹ và đã tiêu 50k cho nước"

   - Output:
     {
       "intent": "create_transactions",
       "transactions": [
         {
           "amount": 100000,
           "transaction_type": "income",
           "category": "Quà tặng",
           "description": "Nhận tiền từ mẹ"
         },
         {
           "amount": 50000,
           "transaction_type": "expense",
           "category": "Ăn uống",
           "description": "Mua nước"
         }
       ]
     }

2. SỬA LỖI & NGỮ CẢNH: 
   - Dựa vào lịch sử chat để biết user đang nói về giao dịch nào.
   - Hiểu các câu sửa lỗi: "nhầm rồi", "đổi thành", "không phải"...

3. CHÀO HỎI & TÁN GẪU:
   - User: "Helu", "Chào nhé", "Bạn là ai"
   - Output: intent: "greeting" hoặc "chat_general", kèm friendly_response duyên dáng.

4. NGÂN SÁCH:
   - Hiểu bất kỳ danh mục nào user muốn (Du lịch, Nuôi mèo, Đám cưới...).

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "create_transaction" | "create_transactions" | "update_transaction" | "delete_transaction" | "query" | "budget" | "greeting" | "chat_general" | "unknown",
  "transactions": [...],
  "data": { "amount": number, "category": "string", "description": "string" },
  "friendly_response": "Câu trả lời tự nhiên, thân thiện."
}"""

    try:
        model = genai.GenerativeModel(model_name=MODEL_NAME, system_instruction=system_instruction)
        
        gemini_history = []
        if history:
            last_role = None
            for msg in history:
                role = "user" if msg.role == "user" else "model"
                
                # Gemini requires starting with 'user'
                if not gemini_history and role != "user":
                    continue
                
                # Gemini requires alternating roles
                if role == last_role:
                    if gemini_history:
                        gemini_history[-1]["parts"] = [gemini_history[-1]["parts"][0] + f"\n{msg.content}"]
                    continue
                
                gemini_history.append({"role": role, "parts": [msg.content]})
                last_role = role
            
            # Ensure history doesn't end with 'user' if we're about to send a user message
            if gemini_history and gemini_history[-1]["role"] == "user":
                # We can't easily merge here because send_message takes the next text.
                # Just pop the last one or add a dummy model response.
                # Safer: if last is user, just merge it into the current prompt later or skip.
                # For now, let's just pop it to maintain alternation.
                gemini_history.pop()

        chat_session = model.start_chat(history=gemini_history)
        
        generation_config = genai.GenerationConfig(response_mime_type="application/json")
        response = chat_session.send_message(text, generation_config=generation_config)
        
        if not response or not response.text:
            return None
            
        return _extract_json(response.text)
    except Exception as e:
        import traceback
        print(f"Gemini Chat Error: {e}")
        traceback.print_exc()
        return None



def _call_gemini_freeform(text: str, history: list[ChatMessage] | None = None) -> str | None:
    if genai is None or not settings.gemini_api_key:
        return None

    genai.configure(api_key=settings.gemini_api_key)
    model_name = (
        os.environ.get("GEMINI_MODEL_NAME")
        or settings.gemini_model_name
        or settings.gemini_model
        or "gemini-1.5-flash-latest"
    )

    system_instruction = (
        "Ban la tro ly tai chinh than thien cho nguoi dung Viet Nam. "
        "Tra loi ngan gon, ro rang, dung tieng Viet tu nhien. "
        "Neu cau hoi lien quan den giao dich/ngan sach trong he thong, huong dan nguoi dung mo ta ro hon."
    )

    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction,
        )
        
        gemini_history = []
        if history:
            last_role = None
            for msg in history:
                role = "user" if msg.role == "user" else "model"
                if not gemini_history and role != "user":
                    continue
                if role == last_role:
                    if gemini_history:
                        gemini_history[-1]["parts"] = [gemini_history[-1]["parts"][0] + f"\n{msg.content}"]
                    continue
                gemini_history.append({"role": role, "parts": [msg.content]})
                last_role = role
            if gemini_history and gemini_history[-1]["role"] == "user":
                gemini_history.pop()

        chat_session = model.start_chat(history=gemini_history)
        response = chat_session.send_message(text)
        
        if not response:
            return None
        content = getattr(response, "text", None)
        if content and content.strip():
            return content.strip()
        return None
    except Exception as e:
        print(f"Gemini Freeform Error: {e}")
        return None

def _infer_fallback_range(text: str) -> str:
    normalized = _normalize_text(text)
    if "hom nay" in normalized:
        return "today"
    if "tuan nay" in normalized:
        return "current_week"
    if "thang truoc" in normalized:
        return "last_month"
    return "current_month"


def _fallback_chat_intent_payload(
    db: Session,
    current_user: User,
    text: str,
) -> dict:
    normalized = _normalize_text(text)
    normalized_basic = _normalize_text_basic(text)
    heuristic = parse_transaction_text(
    db,
    current_user,
    text,
    auto_create_category=False,
    use_llm=False,
)
    parsed = parse_transaction_text(
        db,
        current_user,
        text,
        auto_create_category=False,
        use_llm=False,
    )
    amount = parsed.get("amount")
    category_name = parsed.get("category_name")

    if any(keyword in normalized for keyword in ("bat thuong", "anomaly", "dot bien")):
        return {
            "intent": "ANOMALY_DETECTION",
            "data": {},
            "friendly_response": "Minh dang kiem tra giao dich bat thuong.",
        }

    if _is_greeting(text):
        return {
            "intent": "GREETING",
            "data": {},
            "friendly_response": "Xin chao! Minh co the giup ban ghi chep chi tieu, kiem tra ngan sach, hoac tim giao dich. Ban can gi?",
        }

    budget_markers = ("ngan sach", "budget", "han muc", "ke hoach chi")
    if any(marker in normalized_basic for marker in budget_markers) or ("con bao nhieu" in normalized_basic and " cho " in f" {normalized_basic} "):
        return {
            "intent": "budget",
            "data": {
                "amount": amount,
                "category": category_name
            },
            "friendly_response": f"Minh da ghi nhan thiet lap ngan sach cho {category_name or 'danh muc này'}." if amount else "Minh kiem tra ngan sach cho ban.",
        }


    if _is_question(text):
        return {
            "intent": "QUERY_HISTORY",
            "data": {"range": _infer_fallback_range(text)},
            "friendly_response": "Duoi day la tong hop thu chi.",
        }

    if any(kw in normalized for kw in ("xoa", "sua", "doi thanh", "huy", "bo qua", "ko phai", "khong phai", "nham", "thanh", "ma la")):
        return {
            "intent": "EDIT",
            "data": {"query": text},
            "friendly_response": "Minh dang thuc hien yeu cau chinh sua hoac xoa giao dich.",
        }

    if amount is not None:
        tx_type = parsed.get("transaction_type") or "expense"
        return {
            "intent": "SAVE_INCOME" if tx_type == "income" else "SAVE_EXPENSE",
            "data": {
                "amount": amount,
                "category": category_name,
                "note": parsed.get("description") or text,
                "date": parsed.get("date"),
            },
            "friendly_response": "Da ghi nhan giao dich.",
        }

    return {
        "intent": "UNKNOWN",
        "data": {},
        "friendly_response": "Xin lỗi, mình chưa hiểu ý bạn lắm. Bạn có thể mô tả rõ hơn về giao dịch hoặc câu hỏi tài chính của bạn không? Ví dụ: 'Ăn sáng 30k' hoặc 'Số dư hiện tại bao nhiêu?'.",
    }


def answer_chat(db: Session, current_user: User, text: str) -> dict:
    # 1. Lấy lịch sử chat để AI hiểu ngữ cảnh
    history = get_chat_history(db, current_user, limit=5)
    
    # 2. GỌI AI (GEMINI) - Đây là bộ não chính xử lý ngôn ngữ tự nhiên
    llm_resp = _call_gemini_chat(text, history=history)
    
    # Chuẩn hóa tin nhắn
    normalized_text = _normalize_text(text)
    normalized_basic = _normalize_text_basic(text)

    heuristic = parse_transaction_text(
    db,
    current_user,
    text,
    auto_create_category=False,
    use_llm=False,
    )

    # 3. KIỂM TRA PHẢN HỒI AI
    if not llm_resp or not isinstance(llm_resp, dict) or llm_resp.get("intent") == "unknown":
        # AI không hiểu hoặc lỗi -> Mới dùng bộ quy tắc (Rule-based) dự phòng
        llm_resp = _fallback_chat_intent_payload(db, current_user, text)

    # --- INTENT CLASSIFICATION ---
    intent = llm_resp.get("intent", "unknown").lower()
    data = llm_resp.get("data", {})
    friendly = llm_resp.get("friendly_response", "Đã nhận thông tin.")

    # 4. XỬ LÝ CHÀO HỎI & TÁN GẪU (Ưu tiên AI)
    if intent == "greeting":
        return {"answer": friendly, "intent": "greeting"}
    if intent == "chat_general":
        freeform = _call_gemini_freeform(text, history=history)
        return {"answer": freeform or friendly, "intent": "chat_general"}

    # 5. XỬ LÝ ĐA GIAO DỊCH
    multi_data = llm_resp.get("transactions")
    # Fallback sang heuristic tách câu nếu AI không bóc tách được danh sách,
    # kể cả khi AI lỡ gắn câu thành một giao dịch đơn.
    if not multi_data:
         multi_data = _extract_multi_transactions(db, current_user, text)

    if intent == "create_transactions" or multi_data:
        txs_created = []
        for item in multi_data:
            amt = _coerce_amount(item.get("amount"))
            if not amt:
                continue
            desc = item.get("description") or item.get("note") or text
            raw_type = item.get("transaction_type")
            normalized_type = _normalize_transaction_type(raw_type)
            parsed_segment_type = _normalize_transaction_type(
                parse_transaction_text(
                    db,
                    current_user,
                    desc,
                    auto_create_category=False,
                    use_llm=False,
                ).get("transaction_type")
            )
            tx_type = _infer_transaction_type(
                desc,
                fallback=normalized_type or parsed_segment_type,
            )
            cat_name = item.get("category") or item.get("category_name")
            cat_id, res_name = _resolve_category(db, current_user, cat_name, True)
            item_date = _coerce_date_value(item.get("date")) or _parse_date(desc) or _parse_date(text) or _today_local()

            new_tx = finance_service.create_transaction(
                db, current_user,
                finance_schemas.TransactionCreate(
                    description=desc,
                    amount=amt,
                    transaction_type=tx_type,
                    category_id=cat_id,
                    date=item_date
                )
            )
            txs_created.append(new_tx)
        
        if txs_created:
            response = {
                "answer": friendly if intent == "create_transactions" else f"Đã ghi nhận {len(txs_created)} giao dịch cho bạn.",
                "intent": "create_transactions",
                "total": sum(
                    t.amount if t.transaction_type == "income"
                    else -t.amount
                    for t in txs_created
                )
            }
            _persist_chat_messages(db, current_user, text, response)
            return response

    # 4. Ánh xạ Intent AI sang Logic Backend
    intent_map = {
        "create_transaction": "expense",
        "update_transaction": "edit",
        "delete_transaction": "edit",
        "save_expense": "expense",
        "save_income": "income",
        "query_history": "query",
        "check_budget": "budget",
        "budget": "budget"
    }
    
    # Chỉ dùng Heuristic Fallback khi AI thực sự không biết làm gì
    if intent == "unknown":
        h_fallback = parse_transaction_text(db, current_user, text, auto_create_category=False, use_llm=False)
        if any(kw in normalized_text for kw in ["xoa", "huy", "bo qua"]):
            intent = "edit"
        elif h_fallback.get("amount"):
            intent = "expense"
        elif any(kw in normalized_basic for kw in ["ngan sach", "budget"]):
            intent = "budget"

    # Refine singular creation type
    if intent == "create_transaction":
        if _has_income_keyword(text) or data.get("transaction_type") == "income":
            intent = "income"
        else:
            intent = "expense"
            
    intent = intent_map.get(intent, intent)
    
    # 3. Xử lý các Intent cụ thể

    # --- EXPENSE & INCOME ---
    if intent in ("expense", "income"):
        tx_type = "expense" if intent == "expense" else "income"
        amount = _prefer_explicit_amount(
            text,
            _coerce_amount(data.get("amount")),
            heuristic.get("amount"),
        )
        if not amount:
            return {
                "answer": "Bạn vui lòng cho biết số tiền cụ thể để mình ghi chép nhé.",
                "intent": "ask_amount",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }

        cat_name = (
            _extract_budget_category_from_text(db, current_user, text)
            or data.get("category")
            or heuristic.get("category_name")
        )
        cat_id, res_name = _resolve_category(db, current_user, cat_name, True)
        
        acc_name = data.get("account")
        account = _resolve_account(db, current_user, acc_name)
        
        explicit_date = _parse_date(text)

        dt = explicit_date or _today_local()

        tag_names = data.get("tags") or []
        tag_ids = _resolve_tags(db, current_user, tag_names)

        tx = finance_service.create_transaction(
            db,
            current_user,
            finance_schemas.TransactionCreate(
                description=data.get("description") or data.get("note") or heuristic.get("description") or text,
                amount=amount,
                transaction_type=tx_type,
                category_id=cat_id,
                account_id=account.id if account else None,
                date=dt,
                tag_ids=tag_ids,
            ),
        )

        budget_warning = ""

        if tx_type == "expense":

            budget_obj = (
                db.query(Budget)
                .filter(
                    Budget.user_id == current_user.id,
                    Budget.category_id == cat_id,
                )
                .first()
            )

            if budget_obj:

                spent = _sum_by_category(
                    db,
                    current_user,
                    budget_obj.period_start,
                    budget_obj.period_end,
                    cat_id,
                    "expense",
                )

                remain = budget_obj.amount - spent

                budget_warning = (
                    f"\nNgân sách '{res_name}' còn lại: {remain:,.0f}đ"
                )

        response = {
            "answer": friendly + budget_warning, 
            "intent": f"create_{tx_type}",
            "start_date": tx.date,
            "end_date": tx.date,
            "category_name": res_name,
            "total": tx.amount,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    # --- TRANSFER ---
    if intent == "transfer":
        amount = _coerce_amount(data.get("amount"))
        acc_name = data.get("account")
        account = _resolve_account(db, current_user, acc_name)
        explicit_date = _parse_date(text)

        dt = explicit_date or _today_local()
        
        # Với transfer trong chat đơn giản, ta ghi nhận như một giao dịch chi tiêu từ tài khoản nguồn
        tx = finance_service.create_transaction(
            db,
            current_user,
            finance_schemas.TransactionCreate(
                description=data.get("description") or text,
                amount=amount or 0,
                transaction_type="expense",
                category_id=None,
                account_id=account.id if account else None,
                date=dt,
            ),
        )
        response = {
            "answer": friendly,
            "intent": "transfer",
            "start_date": tx.date,
            "end_date": tx.date,
            "category_name": None,
            "total": tx.amount,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    # --- QUERY ---
    if intent == "query":
        # Mặc định truy vấn tháng này
        today = _today_local()
        s, e = _month_range_for_date(today)
        
        # Nếu AI có gợi ý range
        range_v = data.get("range")
        if range_v == "today":
            s, e = today, today
        elif range_v == "current_week":
            s, e = _week_range_for_date(today)
        elif range_v == "last_month":
            last_month_day = today.replace(day=1) - timedelta(days=1)
            s, e = _month_range_for_date(last_month_day)

        sum_data = finance_service.get_summary(db, current_user, start_date=s, end_date=e)
        response = {
            "answer": (
                f"{friendly}\n"
                f"- Tổng thu: {sum_data.total_income:,.0f}đ\n"
                f"- Tổng chi: {sum_data.total_expense:,.0f}đ\n"
                f"- Số dư kỳ này: {(sum_data.total_income - sum_data.total_expense):,.0f}đ"
            ),
            "intent": "summary",
            "start_date": s,
            "end_date": e,
            "category_name": None,
            "total": sum_data.total_expense,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response


    # --- BUDGET ---
    if intent == "budget":

        cat_name = data.get("category")

        normalized = _normalize_text_basic(text)

        for alias, mapped in _BUDGET_CATEGORY_ALIASES.items():
            if alias in normalized:
                cat_name = mapped
                break

        cat_name = _resolve_budget_category_name(
            db,
            current_user,
            text,
            cat_name,
            None,
        )
        amount = _coerce_amount(data.get("amount")) or heuristic.get("amount")
        
        if not cat_name:
            return {"answer": "Bạn muốn đặt hoặc kiểm tra ngân sách cho mục nào? Ví dụ: 'Đặt ngân sách ăn uống 2tr'", "intent": "ask_category"}

        explicit_budget_category = _extract_budget_category_from_text(db, current_user, text)
        if (
            amount
            and explicit_budget_category is None
            and data.get("category")
            and heuristic.get("category_name")
            and data.get("category") != heuristic.get("category_name")
        ):
            return {
                "answer": "Minh chua chac danh muc ngan sach ban muon tao. Hay noi ro theo mau: 'Tao ngan sach an uong 1 trieu'.",
                "intent": "ask_category",
            }

        cat_id, res_name = _resolve_category(db, current_user, cat_name, True)
        
        today = _today_local()
        s, e = _month_range_for_date(today)

        # Nếu có số tiền -> Thiết lập/Cập nhật ngân sách cho tháng hiện tại
        if amount:
            budget_payload = finance_schemas.BudgetCreate(
                category_id=cat_id,
                amount=float(amount),
                period_start=s,
                period_end=e,
            )
            finance_service.create_budget(db, current_user, budget_payload)
            
            response = {
                "answer": f"Đã thiết lập ngân sách cho '{res_name}' là {amount:,.0f}đ mỗi tháng.",
                "intent": "set_budget",
                "total": amount,
                "start_date": s,
                "end_date": e,
            }
        else:
            # Nếu không có số tiền -> Kiểm tra trạng thái ngân sách hiện tại
            spent = _sum_by_category(db, current_user, s, e, cat_id, "expense")
            
            budget_obj = (
                db.query(Budget)
                .filter(
                    Budget.user_id == current_user.id,
                    Budget.category_id == cat_id,
                    Budget.period_start == s,
                    Budget.period_end == e,
                )
                .first()
            )
            if budget_obj:
                remain = max(0, budget_obj.amount - spent)
                percent = (spent / budget_obj.amount * 100) if budget_obj.amount > 0 else 0
                response = {
                    "answer": (
                        f"{friendly}\n"
                        f"- Ngân sách {res_name}: {budget_obj.amount:,.0f}đ\n"
                        f"- Đã dùng: {spent:,.0f}đ ({percent:.1f}%)\n"
                        f"- Còn lại: {remain:,.0f}đ"
                    ),
                    "intent": "budget_status",
                    "total": spent,
                    "start_date": s,
                    "end_date": e,
                }
            else:
                response = {
                    "answer": f"Bạn đã chi {spent:,.0f}đ cho {res_name} tháng này (Chưa đặt ngân sách). Bạn có muốn đặt ngân sách cho mục này không?",
                    "intent": "category_status",
                    "start_date": s,
                    "end_date": e,
                }
        
        _persist_chat_messages(db, current_user, text, response)
        return response

    # --- EDIT ---
    if intent == "edit":
        last_tx = db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.id.desc()).first()
        if not last_tx:
            return {"answer": "Mình không tìm thấy giao dịch nào gần đây để sửa.", "intent": "not_found"}
        
        action = data.get("edit_action", "update")
        if action == "delete" or "xóa" in text.lower():
            desc = last_tx.description
            amt = last_tx.amount
            finance_service.delete_transaction(db, current_user, last_tx.id)
            response = {"answer": f"Đã xóa giao dịch '{desc}' ({amt:,.0f}đ) vừa rồi.", "intent": "delete_transaction"}
        else:
            # Update last transaction
            update_payload = {}
            
            # Ưu tiên lấy từ data (LLM), nếu không có thì lấy từ heuristic (fallback)
            new_amount = _coerce_amount(data.get("amount")) or heuristic.get("amount")
            new_cat = data.get("category") or heuristic.get("category_name")
            new_desc = data.get("description") or heuristic.get("description")
            
            if new_amount:
                update_payload["amount"] = new_amount
            if new_cat:
                cid, _ = _resolve_category(db, current_user, new_cat, True)
                update_payload["category_id"] = cid
            if new_desc and new_desc != text:
                update_payload["description"] = new_desc
            
            if update_payload:
                # Use TransactionUpdate to allow partial updates (Pydantic validation won't fail for missing fields)
                update_data = finance_schemas.TransactionUpdate(**update_payload)
                finance_service.update_transaction(db, current_user, last_tx.id, update_data)
                
                # Cập nhật friendly response để thông báo rõ ràng hơn
                fields_map = {"amount": "số tiền", "category_id": "danh mục", "description": "mô tả"}
                updated_fields = [fields_map.get(k, k) for k in update_payload.keys()]
                friendly = f"Đã cập nhật {' và '.join(updated_fields)} cho giao dịch '{last_tx.description}' rồi nhé!"
                
                response = {"answer": friendly, "intent": "update_transaction"}
            else:
                response = {"answer": "Bạn muốn sửa thông tin gì của giao dịch vừa rồi?", "intent": "ask_edit"}

        
        _persist_chat_messages(db, current_user, text, response)
        return response

    # --- ADJUST ---
    if intent == "adjust":
        target_amount = _coerce_amount(data.get("amount"))
        if target_amount is None:
            # Nếu người dùng nói "về 0" thì target_amount có thể là 0
            if " 0" in text or " không" in text.lower() or " trắng" in text.lower():
                target_amount = 0.0
            else:
                return {"answer": "Bạn muốn điều chỉnh số dư thành bao nhiêu?", "intent": "ask_amount"}
        
        acc_name = data.get("account")
        account = _resolve_account(db, current_user, acc_name)
        
        if not account:
            # Nếu không chỉ định account, lấy account đầu tiên hoặc mặc định
            accounts = _list_accounts(db, current_user)
            if not accounts:
                account = _ensure_account(db, current_user, "Tiền mặt")
            else:
                account = accounts[0]
        
        # Tính toán chênh lệch để tạo giao dịch điều chỉnh
        current_balance = account.balance
        diff = target_amount - current_balance
        
        if diff != 0:
            tx_type = "income" if diff > 0 else "expense"
            # Tìm hoặc tạo category "Điều chỉnh số dư"
            cat_id, _ = _resolve_category(db, current_user, "Số dư đầu kỳ" if current_balance == 0 else "Điều chỉnh số dư", True)
            
            finance_service.create_transaction(
                db,
                current_user,
                finance_schemas.TransactionCreate(
                    description=f"Điều chỉnh số dư (Từ {current_balance:,.0f}đ lên {target_amount:,.0f}đ)" if diff > 0 else f"Điều chỉnh số dư (Từ {current_balance:,.0f}đ xuống {target_amount:,.0f}đ)",
                    amount=abs(diff),
                    transaction_type=tx_type,
                    category_id=cat_id,
                    account_id=account.id,
                    date=_today_local(),
                )
            )
        else:
            # Nếu số dư không đổi, vẫn bắn sự kiện để UI refresh nếu cần
            from app.realtime import emit_finance_update
            emit_finance_update("accounts", current_user.id, account.id)
        
        response = {
            "answer": f"Đã điều chỉnh số dư tài khoản '{account.name}' về {target_amount:,.0f}đ theo yêu cầu.",
            "intent": "adjust_balance",
            "total": target_amount,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    # --- UNKNOWN / FALLBACK ---
    freeform = _call_gemini_freeform(text, history=history)
    response = {
        "answer": freeform or friendly,
        "intent": "chat_general",
        "start_date": None,
        "end_date": None,
        "category_name": None,
        "total": None,
    }
    _persist_chat_messages(db, current_user, text, response)
    return response


def _persist_chat_messages(db: Session, current_user: User, user_text: str, response: dict) -> None:
    if not user_text:
        return
    try:
        db.add_all(
            [
                ChatMessage(
                    user_id=current_user.id,
                    role="user",
                    content=user_text,
                ),
                ChatMessage(
                    user_id=current_user.id,
                    role="assistant",
                    content=str(response.get("answer") or ""),
                    intent=response.get("intent"),
                ),
            ]
        )
        db.commit()
    except Exception:
        db.rollback()


def get_chat_history(db: Session, current_user: User, limit: int = 50) -> list[ChatMessage]:
    items = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(desc(ChatMessage.created_at), desc(ChatMessage.id))
        .limit(max(1, min(limit, 200)))
        .all()
    )
    items.reverse()
    return items

def _otsu_threshold(image: Image.Image) -> int:
    histogram = image.histogram()
    total = sum(histogram)
    sum_total = sum(i * histogram[i] for i in range(256))

    sum_background = 0
    weight_background = 0
    max_variance = -1.0
    threshold = 128
    for i in range(256):
        weight_background += histogram[i]
        if weight_background == 0:
            continue
        weight_foreground = total - weight_background
        if weight_foreground == 0:
            break
        sum_background += i * histogram[i]
        mean_background = sum_background / weight_background
        mean_foreground = (sum_total - sum_background) / weight_foreground
        variance = weight_background * weight_foreground * (mean_background - mean_foreground) ** 2
        if variance > max_variance:
            max_variance = variance
            threshold = i
    return threshold


def _auto_rotate(image: Image.Image) -> Image.Image:
    try:
        osd = pytesseract.image_to_osd(image)
    except Exception:
        return image
    match = re.search(r"Rotate:\s+(?P<deg>\d+)", osd)
    if not match:
        return image
    degrees = int(match.group("deg"))
    if degrees in (90, 180, 270):
        return image.rotate(360 - degrees, expand=True)
    return image


def _preprocess_ocr_image(image: Image.Image) -> Image.Image:
    gray = image.convert("L")

    width, height = gray.size
    if max(width, height) < 1200:
        scale = 2
        gray = gray.resize((width * scale, height * scale), resample=Image.LANCZOS)

    gray = ImageOps.autocontrast(gray)
    gray = gray.filter(ImageFilter.MedianFilter(size=3))
    gray = ImageEnhance.Contrast(gray).enhance(1.6)
    gray = gray.filter(ImageFilter.SHARPEN)

    threshold = _otsu_threshold(gray)
    binary = gray.point(lambda p: 255 if p > threshold else 0, mode="1")
    return binary.convert("L")


def _preprocess_ocr_image_cv(image: Image.Image) -> Image.Image | None:
    if cv2 is None or np is None:
        return None
    data = np.array(image.convert("RGB"))
    bgr = cv2.cvtColor(data, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Contrast enhancement (CLAHE) + denoise.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.fastNlMeansDenoising(gray, h=20)

    # Attempt document detection (perspective correction).
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 75, 200)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    doc = None
    for contour in contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4:
            doc = approx
            break
    if doc is not None:
        pts = doc.reshape(4, 2).astype("float32")
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1)
        ordered = np.array(
            [
                pts[np.argmin(s)],
                pts[np.argmin(diff)],
                pts[np.argmax(s)],
                pts[np.argmax(diff)],
            ],
            dtype="float32",
        )
        (tl, tr, br, bl) = ordered
        width_a = np.linalg.norm(br - bl)
        width_b = np.linalg.norm(tr - tl)
        height_a = np.linalg.norm(tr - br)
        height_b = np.linalg.norm(tl - bl)
        max_width = max(int(width_a), int(width_b))
        max_height = max(int(height_a), int(height_b))
        if max_width > 0 and max_height > 0:
            dst = np.array(
                [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
                dtype="float32",
            )
            matrix = cv2.getPerspectiveTransform(ordered, dst)
            gray = cv2.warpPerspective(gray, matrix, (max_width, max_height))

    # Binarize to detect skew.
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh < 255))
    if coords.size > 0:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) > 0.1:
            (h, w) = gray.shape[:2]
            matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
            gray = cv2.warpAffine(
                gray,
                matrix,
                (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )

    # Sharpen for OCR.
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp = cv2.filter2D(gray, -1, kernel)
    return Image.fromarray(sharp)


def _rotate_image(image: Image.Image, degrees: int) -> Image.Image:
    if degrees % 360 == 0:
        return image
    return image.rotate(degrees, expand=True)


def _choose_tesseract_lang() -> str:
    try:
        langs = pytesseract.get_languages(config="")
    except Exception:
        return "eng"
    if "vie" in langs and "eng" in langs:
        return "vie+eng"
    if "vie" in langs:
        return "vie"
    return "eng"


def _ocr_to_text(image: Image.Image, psm: int = 6) -> str:
    lang = _choose_tesseract_lang()
    config = f"--oem 3 --psm {psm}"
    return pytesseract.image_to_string(image, lang=lang, config=config) or ""


def _call_gemini_ocr(image_bytes: bytes) -> dict | None:
    if genai is None or not settings.gemini_api_key:
        return None
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model_name = (
            os.environ.get("GEMINI_MODEL_NAME")
            or settings.gemini_model_name
            or settings.gemini_model
            or "gemini-1.5-flash-latest"
        )
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=(
                "Bạn là chuyên gia OCR hóa đơn tài chính chuyên nghiệp tại Việt Nam. "
                "Nhiệm vụ của bạn là trích xuất thông tin từ ảnh hóa đơn sang định dạng JSON chuẩn xác.\n\n"
                "Quy tắc trích xuất:\n"
                "- date: Ngày hóa đơn (YYYY-MM-DD). Nếu không thấy năm, giả định năm hiện tại 2026. Nếu không có ngày, trả về null.\n"
                "- merchant: Tên cửa hàng/siêu thị/nhà cung cấp. Bỏ qua địa chỉ chi tiết, chỉ lấy tên thương hiệu (VD: 'WinMart', 'Highlands Coffee').\n"
                "- total: Tổng số tiền cuối cùng khách phải trả (kiểu số nguyên). Lưu ý các hóa đơn Việt Nam thường dùng dấu chấm '.' làm phân cách hàng nghìn (VD: 100.000 -> 100000).\n"
                "- vat: Tiền thuế GTGT nếu có (số nguyên).\n"
                "- estimated: Giá trị hàng hóa trước thuế hoặc trước khi giảm giá (số nguyên).\n"
                "- items: Danh sách các mặt hàng (nếu có thể đọc được), mỗi item có {name, price, qty}.\n"
                "- note: Tóm tắt ngắn gọn nội dung hóa đơn (VD: 'Mua nhu yếu phẩm', 'Uống cafe').\n"
                "- text: Các ký tự thô nhận diện được.\n\n"
                "TRẢ VỀ DUY NHẤT JSON, KHÔNG GIẢI THÍCH, KHÔNG MARKDOWN."
            )
        )
        response = model.generate_content(
            [{"mime_type": "image/jpeg", "data": image_bytes}]
        )
        text_val = getattr(response, "text", "")
        if not text_val:
            return None
        return _extract_json(text_val) or {"text": text_val}
    except Exception as e:
        print(f"Gemini OCR Failed: {e}")
        return None


def _score_ocr_text(text: str) -> float:
    if not text or not text.strip():
        return -1.0
    normalized = _normalize_text(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    score = 0.0
    total = _extract_total_from_lines(lines)
    if total is not None:
        score += 6.0
    if _extract_date_from_lines(lines):
        score += 3.0
    if any(keyword in normalized for keyword in OCR_TOTAL_KEYWORDS):
        score += 2.0
    if any(hint in normalized for hint in CURRENCY_HINTS):
        score += 1.0

    digit_count = len(re.sub(r"\D", "", text))
    score += min(5.0, digit_count / 20.0)
    score += min(5.0, len(lines) / 3.0)
    return score


def _ocr_best_text(image: Image.Image) -> str:
    base = _auto_rotate(image)
    preprocessed = _preprocess_ocr_image_cv(base) or _preprocess_ocr_image(base)

    gray = base.convert("L")
    gray = ImageOps.autocontrast(gray)
    gray = gray.filter(ImageFilter.MedianFilter(size=3))

    candidates: list[tuple[float, str]] = []
    for degrees in (0, 90, 180, 270):
        for variant in (preprocessed, gray):
            rotated = _rotate_image(variant, degrees)
            text = _ocr_to_text(rotated, psm=6)
            score = _score_ocr_text(text)
            candidates.append((score, text))

    if not candidates:
        return ""
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _line_has_any_keyword(normalized: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in normalized for keyword in keywords)


def _extract_total_from_lines(lines: list[str]) -> float | None:
    if not lines:
        return None
    candidates: list[tuple[float, float]] = []
    last_index = max(1, len(lines) - 1)
    for idx, raw_line in enumerate(lines):
        normalized = _normalize_text(raw_line)
        fixed_line = _normalize_ocr_numeric_tokens(raw_line)
        amount = _parse_amount(fixed_line)

        has_total = _line_has_any_keyword(normalized, OCR_TOTAL_KEYWORDS)
        has_subtotal = _line_has_any_keyword(normalized, OCR_SUBTOTAL_KEYWORDS)
        has_pretax = _line_has_any_keyword(normalized, OCR_PRETAX_KEYWORDS)
        if has_pretax:
            has_subtotal = True
            has_total = False

        if has_total and amount is None:
            for j in range(idx + 1, min(idx + 3, len(lines))):
                next_line = lines[j]
                normalized_next = _normalize_text(next_line)
                fixed_next = _normalize_ocr_numeric_tokens(next_line)
                amount_next = _parse_amount(fixed_next)
                if amount_next is None:
                    continue
                score = 5.0 + (j / last_index)
                if _amount_has_unit(fixed_next):
                    score += 1.0
                if _line_has_any_keyword(normalized_next, OCR_SUBTOTAL_KEYWORDS):
                    score -= 2.0
                candidates.append((score, amount_next))
                break

        if amount is None:
            continue

        score = idx / last_index
        if has_total:
            score += 5.0
        if has_subtotal:
            score -= 3.0
        if _amount_has_unit(fixed_line):
            score += 1.0
        if _line_has_any_keyword(normalized, ("sdt", "phone", "tel", "tax", "mst", "ma so thue")):
            score -= 4.0
        if not has_total and not _amount_has_unit(fixed_line):
            digit_count = len(re.sub(r"\D", "", fixed_line))
            if digit_count >= 9:
                score -= 2.0
        candidates.append((score, amount))

    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][1]


def _extract_amount_for_keywords(lines: list[str], keywords: tuple[str, ...]) -> float | None:
    if not lines:
        return None
    for idx, line in enumerate(lines):
        normalized = _normalize_text(line)
        if not _line_has_any_keyword(normalized, keywords):
            continue
        fixed_line = _normalize_ocr_numeric_tokens(line)
        amount = _parse_amount(fixed_line)
        if amount is not None:
            return amount
        for j in range(idx + 1, min(idx + 3, len(lines))):
            next_line = _normalize_ocr_numeric_tokens(lines[j])
            amount = _parse_amount(next_line)
            if amount is not None:
                return amount
    return None


def _extract_note_from_lines(lines: list[str]) -> str | None:
    for line in lines:
        normalized = _normalize_text(line)
        if not _line_has_any_keyword(normalized, OCR_NOTE_KEYWORDS):
            continue
        if ":" in line:
            value = line.split(":", 1)[1].strip()
            return value or None
        cleaned = normalized
        for keyword in OCR_NOTE_KEYWORDS:
            cleaned = cleaned.replace(keyword, "").strip()
        return cleaned or None
    return None


def _validate_ocr_totals(total: float | None, estimated: float | None, vat: float | None) -> tuple[float | None, float | None, bool | None, list[str]]:
    if total is None:
        return None, None, None, []
    computed_total = None
    if estimated is not None and vat is not None:
        computed_total = estimated + vat
    elif estimated is not None:
        computed_total = estimated

    if computed_total is None:
        return None, None, None, []

    delta = abs(total - computed_total)
    tolerance = max(1000.0, total * 0.01)
    is_ok = delta <= tolerance
    warnings = []
    if not is_ok:
        warnings.append(
            f"Tong tien lech {delta:.0f} (expected {computed_total:.0f}, actual {total:.0f})."
        )
    return computed_total, delta, is_ok, warnings


def _extract_date_from_lines(lines: list[str]) -> DateType | None:
    if not lines:
        return None
    candidates: list[tuple[float, DateType]] = []
    last_index = max(1, len(lines) - 1)
    for idx, line in enumerate(lines):
        date_value = _parse_date(line)
        if not date_value:
            continue
        normalized = _normalize_text(line)
        score = 0.5 - (idx / last_index)
        if _line_has_any_keyword(normalized, OCR_DATE_HINTS):
            score += 1.0
        if "hoa don" in normalized or "invoice" in normalized or "bill" in normalized:
            score += 1.5
        if _line_has_any_keyword(normalized, OCR_DUE_DATE_HINTS):
            score -= 2.0
        candidates.append((score, date_value))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _extract_merchant_from_lines(lines: list[str]) -> str | None:
    for line in lines:
        normalized = _normalize_text(line)
        if _line_has_any_keyword(normalized, OCR_MERCHANT_IGNORE):
            continue
        if _line_has_any_keyword(normalized, OCR_MERCHANT_HINTS):
            if ":" in line:
                value = line.split(":", 1)[1].strip()
                if value:
                    return value
            cleaned = normalized
            for keyword in OCR_MERCHANT_HINTS:
                cleaned = cleaned.replace(keyword, "")
            if cleaned:
                return line.strip()

    for line in lines:
        normalized = _normalize_text(line)
        if re.search(r"\d", normalized):
            continue
        if not re.search(r"[a-z]", normalized):
            continue
        if _line_has_any_keyword(normalized, OCR_MERCHANT_SKIP_KEYWORDS):
            continue
        word_count = len([token for token in normalized.split() if token])
        if word_count >= 2:
            return line.strip()
        if _parse_amount(line) is not None and len(normalized) < 6:
            continue
        return line.strip()
    return None


def extract_ocr(image_bytes: bytes) -> dict:
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode == "RGBA":
        image = image.convert("RGB")

    gemini_result = None
    if settings.ocr_provider.lower() == "gemini" or settings.gemini_api_key:
        gemini_result = _call_gemini_ocr(image_bytes)

    text = ""
    merchant = None
    total = None
    date_value = None
    vat_amount = None
    estimated = None
    note = None

    if gemini_result:
        text = gemini_result.get("text") or ""
        merchant = gemini_result.get("merchant")
        total = _coerce_amount(gemini_result.get("total"))
        date_value = _coerce_date_value(gemini_result.get("date"))
        vat_amount = _coerce_amount(gemini_result.get("vat"))
        estimated = _coerce_amount(gemini_result.get("estimated"))
        note = gemini_result.get("note")

    if not text.strip():
        try:
            from app.ai_agent.ocr_preprocessing import OCRProcessor
            np_arr = np.frombuffer(image_bytes, np.uint8)
            cv_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if cv_img is not None:
                processor = OCRProcessor()
                processed_cv = processor.process(cv_img)
                lang = _choose_tesseract_lang()
                custom_config = r'--oem 3 --psm 6'
                text = pytesseract.image_to_string(processed_cv, lang=lang, config=custom_config)
        except Exception as e:
            print(f"OCR Pipeline failed: {e}")

        if not text.strip():
            text = _ocr_best_text(image)
        if not text.strip():
            text = _ocr_to_text(image.convert("L"), psm=6)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if merchant is None:
        merchant = _extract_merchant_from_lines(lines) or (lines[0] if lines else None)
    if total is None:
        total = _extract_total_from_lines(lines)
        if total is None:
            total = _parse_amount(_normalize_ocr_numeric_tokens(text))
    if date_value is None:
        date_value = _extract_date_from_lines(lines) or _parse_date(text)
    if vat_amount is None:
        vat_amount = _extract_amount_for_keywords(lines, OCR_VAT_KEYWORDS)
    if estimated is None:
        estimated = _extract_amount_for_keywords(lines, OCR_ESTIMATE_KEYWORDS)
    if note is None:
        note = _extract_note_from_lines(lines)

    computed_total, total_delta, is_total_consistent, warnings = _validate_ocr_totals(
        total, estimated, vat_amount
    )
    return {
        "merchant": merchant,
        "total": total,
        "date": date_value,
        "vat": vat_amount,
        "estimated": estimated,
        "note": note,
        "computed_total": computed_total,
        "total_delta": total_delta,
        "is_total_consistent": is_total_consistent,
        "warnings": warnings,
        "text": text,
    }




