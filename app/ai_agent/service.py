from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List, Dict
from datetime import date as DateType, datetime, timedelta
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
    import google.generativeai as genai  # type: ignore
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
)

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except Exception:
    cv2 = None
    np = None


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



AMOUNT_REGEX = re.compile(
    r"(?P<num>\d+(?:[.,]\d+)*)\s*(?P<unit>k|nghin|ngan|tr|trieu|m|million|ty|ti)?\s*(?:đ|d|vnd|\$|eur)?(?=\s|\W|$)", 
    re.IGNORECASE
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
    "xi": 10_000,
}

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
    "thu",
    "luong",
    "lanh",  # "lanh luong"
    "bonus",
    "lai",
    "nhan",
    "refund",
    "hoan tien",
    "thuong",
]
EXPENSE_KEYWORDS = [
    "chi",
    "mua",
    "tra",
    "thanh toan",
    "phi",
    "hoa don",
    "an",
    "uong",
    "di lai",
    "xang",
    "taxi",
]

def _has_income_keyword(text: str) -> bool:
    normalized = _normalize_text(text)
    for kw in INCOME_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    return False


def _has_expense_keyword(text: str) -> bool:
    normalized = _normalize_text(text)
    for kw in EXPENSE_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    return False

CATEGORY_KEYWORDS = {
    "an uong": "Food",
    "cafe": "Coffee",
    "ca phe": "Coffee",
    "di lai": "Transport",
    "xang": "Transport",
    "taxi": "Transport",
    "mua sam": "Shopping",
    "mua": "Shopping",
    "nha": "Housing",
    "suc khoe": "Health",
    "y te": "Health",
    "giai tri": "Entertainment",
    "hoc": "Education",
    "luong": "Salary",
    "dau tu": "Investment",
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
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return normalized.lower().strip()


def _strip_date_fragments(text: str) -> str:
    text = DATE_ISO_REGEX.sub(" ", text)
    text = DATE_DDMM_REGEX.sub(" ", text)
    text = DATE_TEXT_REGEX.sub(" ", text)
    text = re.sub(r"thang\s*\d{1,2}", " ", text)
    text = re.sub(r"nam\s*\d{4}", " ", text)
    return text


def _parse_date(text: str) -> DateType | None:
    normalized = _normalize_text(text)
    today = DateType.today()
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
        # Loại bỏ sạch dấu chấm còn sót lại (nếu có) trước khi ép kiểu
        clean_num = raw_num.replace(".", "").replace(",", ".")
        try:
            value = float(clean_num)
        except ValueError:
            continue
        unit = match.group("unit")
        if unit:
            multiplier = UNIT_MULTIPLIER.get(unit, 1)
            value *= multiplier
        matches.append(value)

    matches.extend(_extract_colloquial_amount_candidates(normalized))

    if not matches:
        return None
    return max(matches)


def _amount_has_unit(text: str) -> bool:
    normalized = _normalize_text(text)
    if any(hint in normalized for hint in CURRENCY_HINTS):
        return True
    unit_match = re.search(r"\d+(?:[.,]\d+)?\s*(k|nghin|ngan|tr|trieu|m|million|ty|ti|cu|lit|xi)\b", normalized)
    return unit_match is not None


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


def _extract_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


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
    date_value = date_value or DateType.today()
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


def _call_dify(
    text: str,
    user_id: int,
    json_schema: dict | None = None,
) -> dict | None:
    if not settings.dify_api_base or not settings.dify_api_key:
        return None
    base = settings.dify_api_base.rstrip("/")
    url = f"{base}/chat-messages"
    query = text
    if settings.dify_force_json and json_schema:
        query = (
            "Return JSON only. Use the schema. If missing, use null. "
            f"Input: {text}"
        )
    payload = {
        "inputs": {},
        "query": query,
        "response_mode": "blocking",
        "user": str(user_id),
    }
    if json_schema:
        payload["response_format"] = {"type": "json_schema", "json_schema": json_schema}
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {settings.dify_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.dify_timeout_seconds) as response:
            body = response.read().decode("utf-8")
    except urllib.error.URLError:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
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
        if keyword in normalized:
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
        year = int(short_match.group("year")) if short_match.group("year") else DateType.today().year
    else:
        match = MONTH_REGEX.search(normalized)
        if not match:
            return None
        month = int(match.group("month"))
        year = DateType.today().year

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
    today = DateType.today()
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
    today = DateType.today()
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
    totals = _daily_expense_totals(transactions)
    values = list(totals.values())
    if len(values) < 5:
        return []
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    std = math.sqrt(variance)
    threshold = mean + 2 * std
    anomalies = [(day, amount) for day, amount in totals.items() if amount > threshold]
    anomalies.sort(key=lambda item: item[1], reverse=True)
    return anomalies


def get_spending_anomalies(db: Session, current_user: User) -> list[finance_schemas.AnomalyAlert]:
    # Lấy giao dịch 30 ngày qua để tính trung bình
    today = DateType.today()
    start = today - timedelta(days=30)
    txs = finance_service.list_transactions(db, current_user, start_date=start, end_date=today, transaction_type="expense", limit=500)[0]
    
    anomalies = _detect_spend_anomalies(txs)
    alerts = []
    for day, amount in anomalies:
        # Try to get AI-enhanced explanation
        day_txs = [tx for tx in txs if tx.date == day]
        categories = list({tx.category_id for tx in day_txs if tx.category_id})
        cat_names_raw = (
            db.query(Category)
            .filter(Category.id.in_(categories), Category.user_id == current_user.id)
            .all()
        ) if categories else []
        cat_label = ", ".join(c.name for c in cat_names_raw) if cat_names_raw else "nhiều danh mục"
        
        alerts.append(finance_schemas.AnomalyAlert(
            id=f"anomaly-{day}",
            date=day,
            amount=amount,
            description=f"Chi tiêu ngày {day} cao bất thường ({cat_label})",
            reason=f"Vượt ngưỡng trung bình 30 ngày qua (> 2 độ lệch chuẩn), các danh mục: {cat_label}",
            severity="high" if amount > 1_000_000 else "medium"
        ))
    return alerts


def _get_user_financial_context(
    db: Session,
    current_user: User,
    months: int = 6,
) -> dict:
    """Build a financial context dict for AI prompts."""
    today = DateType.today()
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

    today = DateType.today()
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
                or "gemini-1.5-flash"
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
                or "gemini-1.5-flash"
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


def _resolve_category(
    db: Session,
    current_user: User,
    category_name: str | None,
    auto_create: bool,
) -> tuple[int | None, str | None]:
    if not category_name:
        return None, None
    normalized_target = _normalize_text(category_name)
    existing = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .all()
    )
    for item in existing:
        if _normalize_text(item.name) == normalized_target:
            return item.id, item.name
    if not auto_create:
        return None, category_name
    created = finance_service.create_category(
        db,
        current_user,
        finance_schemas.CategoryCreate(name=category_name),
    )
    return created.id, created.name


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

    llm_response = _call_gemini_chat(text) if use_llm else None
    if llm_response:
        intent = llm_response.get("intent")
        data = llm_response.get("data", {})
        
        if intent in ("SAVE_EXPENSE", "SAVE_INCOME"):
            amount = _coerce_amount(data.get("amount"))
            date_value = data.get("date")
            if isinstance(date_value, str):
                parsed_date = _parse_iso_date(date_value) or _parse_date(date_value)
            
            transaction_type = "expense" if intent == "SAVE_EXPENSE" else "income"
            if _has_income_keyword(text) and not _has_expense_keyword(text):
                transaction_type = "income"
            elif _has_expense_keyword(text) and not _has_income_keyword(text):
                transaction_type = "expense"
            category_name = data.get("category")
            if data.get("note"):
                description = data.get("note")

    if amount is None:
        amount = _parse_amount(text)
        if amount is None:
            warnings.append("amount_not_found")
    if parsed_date is None:
        parsed_date = _parse_date(text) or default_date or DateType.today()
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
        "date": parsed_date,
        "warnings": warnings,
        "confidence": round(confidence, 2),
    }


def _call_gemini_chat(text: str) -> dict | None:
    if genai is None or not settings.gemini_api_key:
        return None
    
    # Configure Gemini SDK
    genai.configure(api_key=settings.gemini_api_key)
    
    # Get model name from environment variable (as requested)
    MODEL_NAME = (
        os.environ.get("GEMINI_MODEL_NAME")
        or settings.gemini_model_name
        or settings.gemini_model
        or "gemini-1.5-flash"
    )
    
    # Required print for Docker logs
    print(f"Sử dụng model: {MODEL_NAME}")

    system_instruction = """Bạn là Trợ lý AI Tài chính Cá nhân (Intelligent Financial Assistant) dành cho người Việt.
Nhiệm vụ: Phân tích câu nói của người dùng để trích xuất Ý định (Intent) và Thực thể (Entities).

1. QUY TẮC HIỂU NGÔN NGỮ QUỐC DÂN (VIETNAMESE COLLOQUIAL)
- Tiền mặt/Lóng: 'củ', 'chai', 'm' -> triệu; 'lít', 'xị', 'k' -> nghìn. 
- Ngữ cảnh: Nếu người dùng nói 'ăn bát phở ba mươi' -> hiểu là 30.000đ. Nếu nói 'mua con SH tám mươi' -> hiểu là 80.000.000đ.
- Hành động: 'vừa lãnh', 'mới nhận', '+', 'tăng' -> thường là SAVE_INCOME. 'mất', 'hết', 'chi', '-', 'thanh toán' -> thường là SAVE_EXPENSE.

2. PHÂN LOẠI Ý ĐỊNH (STRATEGIC INTENT)
- SAVE_EXPENSE: Lưu giao dịch chi tiền.
- SAVE_INCOME: Lưu giao dịch nhận tiền (Lương, thưởng, quà...).
- QUERY_HISTORY: Truy vấn lịch sử (Tổng chi, liệt kê giao dịch).
- CHECK_BUDGET: Kiểm tra ngân sách (Còn bao nhiêu tiền cho Ăn uống?).
- ANOMALY_DETECTION: Cảnh báo bất thường.
- UNKNOWN: Khi không hiểu gì cả.

3. ĐỊNH DẠNG PHẢN HỒI (JSON ONLY)
Trả về duy nhất JSON với cấu trúc:
{
  "intent": "string",
  "data": {
    "amount": number | null,
    "category": "string (Tự suy luận danh mục phù hợp)",
    "note": "string (Mô tả ngắn gọn, không dùng từ lặp)",
    "date": "YYYY-MM-DD",
    "range": "today" | "current_week" | "current_month" | "last_month"
  },
  "friendly_response": "Câu trả lời tự nhiên, thân thiện, xác nhận số tiền bằng số cụ thể."
}

4. VÍ DỤ MẪU (FEW-SHOT)
User: 'Hôm qua đi chợ hết hai trăm rưỡi' -> {"intent": "SAVE_EXPENSE", "data": {"amount": 250000, "category": "Shopping", "note": "đi chợ", "date": "yesterday"}, "friendly_response": "Đã ghi nhận! Bạn vừa chi 250.000đ đi chợ hôm qua đúng không?"}
User: 'Mới nhận lương 20 củ' -> {"intent": "SAVE_INCOME", "data": {"amount": 20000000, "category": "Lương", "note": "nhận lương", "date": "today"}, "friendly_response": "Chúc mừng bạn! Đã cộng 20.000.000đ tiền Lương vào tài khoản."}
User: 'Vừa trả tiền điện 500k' -> {"intent": "SAVE_EXPENSE", "data": {"amount": 500000, "category": "Hóa đơn", "note": "tiền điện", "date": "today"}, "friendly_response": "Ghi nhận 500.000đ tiền điện. Đừng quên tiết kiệm điện nhé!"}
User: 'Cà phê với bạn hết 45' -> {"intent": "SAVE_EXPENSE", "data": {"amount": 45000, "category": "Ăn uống", "note": "cà phê", "date": "today"}, "friendly_response": "Đã lưu 45.000đ tiền cà phê."}

Hãy luôn trả về JSON sạch, không kèm markdown."""

    try:
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=system_instruction
        )
        
        # Ensure we request JSON output format
        generation_config = genai.GenerationConfig(
            response_mime_type="application/json"
        )
        
        response = model.generate_content(
            text,
            generation_config=generation_config
        )
        
        if not response or not response.text:
            return None
            
        return _extract_json(response.text)
        
    except Exception as e:
        print(f"Gemini Chat Error: {e}")
        return None


def _call_gemini_freeform(text: str) -> str | None:
    if genai is None or not settings.gemini_api_key:
        return None

    genai.configure(api_key=settings.gemini_api_key)
    model_name = (
        os.environ.get("GEMINI_MODEL_NAME")
        or settings.gemini_model_name
        or settings.gemini_model
        or "gemini-1.5-flash"
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
        response = model.generate_content(text)
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

    if "ngan sach" in normalized or ("con bao nhieu" in normalized and " cho " in f" {normalized} "):
        return {
            "intent": "CHECK_BUDGET",
            "data": {"category": category_name},
            "friendly_response": "Minh kiem tra ngan sach cho ban.",
        }

    if _is_question(text):
        return {
            "intent": "QUERY_HISTORY",
            "data": {"range": _infer_fallback_range(text)},
            "friendly_response": "Duoi day la tong hop thu chi.",
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
        "friendly_response": "Minh chua hieu ro yeu cau. Ban co the noi cu the hon duoc khong?",
    }


def answer_chat(db: Session, current_user: User, text: str) -> dict:
    llm_resp = _call_gemini_chat(text)
    if not isinstance(llm_resp, dict):
        llm_resp = _fallback_chat_intent_payload(db, current_user, text)

    intent = llm_resp.get("intent", "UNKNOWN")
    data = llm_resp.get("data", {})
    friendly = llm_resp.get("friendly_response", "Da nhan thong tin.")

    heuristic = parse_transaction_text(
        db,
        current_user,
        text,
        auto_create_category=False,
        use_llm=False,
    )
    heuristic_amount = heuristic.get("amount")
    heuristic_type = heuristic.get("transaction_type")
    heuristic_category = heuristic.get("category_name")
    heuristic_date = heuristic.get("date")

    if heuristic_amount is not None and intent not in ("QUERY_HISTORY", "CHECK_BUDGET", "ANOMALY_DETECTION"):
        if _has_income_keyword(text) and not _has_expense_keyword(text):
            intent = "SAVE_INCOME"
        elif _has_expense_keyword(text) and not _has_income_keyword(text):
            intent = "SAVE_EXPENSE"
        if not _coerce_amount(data.get("amount")):
            data["amount"] = heuristic_amount
        if not data.get("category") and heuristic_category:
            data["category"] = heuristic_category
        if not data.get("note"):
            data["note"] = heuristic.get("description") or text
        if not data.get("date") and heuristic_date:
            data["date"] = heuristic_date

    if intent in ("SAVE_EXPENSE", "SAVE_INCOME"):
        # Prioritize LLM intent if it's confident (not UNKNOWN)
        # Only fallback to heuristics if LLM intent is missing or vague
        if intent == "UNKNOWN":
            if _has_income_keyword(text) and not _has_expense_keyword(text):
                intent = "SAVE_INCOME"
            elif _has_expense_keyword(text) and not _has_income_keyword(text):
                intent = "SAVE_EXPENSE"

        tx_type = "expense" if intent == "SAVE_EXPENSE" else "income"
        amount = _coerce_amount(data.get("amount"))
        if not amount:
            return {
                "answer": "Vui long cho biet so tien cu the de minh ghi chep nhe.",
                "intent": "ask_amount",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }

        cat_name = data.get("category")
        cat_id, res_name = _resolve_category(db, current_user, cat_name, True)
        dt = _coerce_date_value(data.get("date")) or DateType.today()

        tx = finance_service.create_transaction(
            db,
            current_user,
            finance_schemas.TransactionCreate(
                description=data.get("note") or text,
                amount=amount,
                transaction_type=tx_type,
                category_id=cat_id,
                date=dt,
            ),
        )
        response = {
            "answer": friendly,
            "intent": "create_transaction",
            "start_date": tx.date,
            "end_date": tx.date,
            "category_name": res_name,
            "total": tx.amount,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if intent == "QUERY_HISTORY":
        range_v = data.get("range", "current_month")
        today = DateType.today()
        if range_v == "today":
            s, e = today, today
        elif range_v == "current_week":
            s, e = _week_range_for_date(today)
        elif range_v == "last_month":
            last_month_day = today.replace(day=1) - timedelta(days=1)
            s, e = _month_range_for_date(last_month_day)
        else:
            s, e = _month_range_for_date(today)

        sum_data = finance_service.get_summary(db, current_user, start_date=s, end_date=e)
        response = {
            "answer": (
                f"{friendly}\n"
                f"- Tong thu: {sum_data.total_income:,.0f} VND\n"
                f"- Tong chi: {sum_data.total_expense:,.0f} VND\n"
                f"- So du: {(sum_data.total_income - sum_data.total_expense):,.0f} VND"
            ),
            "intent": "summary",
            "start_date": s,
            "end_date": e,
            "category_name": None,
            "total": sum_data.total_expense,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if intent == "CHECK_BUDGET":
        cat_name = data.get("category")
        if not cat_name:
            return {
                "answer": "Ban muon kiem tra ngan sach cho danh muc nao?",
                "intent": "ask_category",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }

        cat = _get_category_by_name(db, current_user, cat_name)
        if not cat:
            return {
                "answer": f"Chua co du lieu cho danh muc '{cat_name}'.",
                "intent": "not_found",
                "start_date": None,
                "end_date": None,
                "category_name": cat_name,
                "total": None,
            }

        today = DateType.today()
        s, e = _month_range_for_date(today)
        spent = _sum_by_category(db, current_user, s, e, cat.id, "expense")

        budget_obj = (
            db.query(Budget)
            .filter(Budget.user_id == current_user.id, Budget.category_id == cat.id)
            .first()
        )
        if budget_obj:
            remain = max(0, budget_obj.amount - spent)
            percent = (spent / budget_obj.amount * 100) if budget_obj.amount > 0 else 0
            response = {
                "answer": (
                    f"{friendly}\n"
                    f"- Ngan sach: {budget_obj.amount:,.0f} VND\n"
                    f"- Da chi: {spent:,.0f} VND ({percent:.1f}%)\n"
                    f"- Con lai: {remain:,.0f} VND"
                ),
                "intent": "budget_status",
                "start_date": s,
                "end_date": e,
                "category_name": cat.name,
                "total": spent,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response
        response = {
            "answer": f"{friendly}\nBan da chi {spent:,.0f} VND cho {cat.name} trong thang nay.",
            "intent": "category_status",
            "start_date": s,
            "end_date": e,
            "category_name": cat.name,
            "total": spent,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if intent == "ANOMALY_DETECTION":
        anomalies = get_spending_anomalies(db, current_user)
        if not anomalies:
            response = {
                "answer": "Chi tieu 30 ngay qua on dinh, chua co diem bat thuong.",
                "intent": "anomaly_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response

        msg = [friendly, f"Phat hien {len(anomalies)} diem can luu y:"]
        for item in anomalies:
            msg.append(f"- {item.date}: {item.amount:,.0f} VND ({item.reason})")
        response = {
            "answer": "\n".join(msg),
            "intent": "anomaly_alert",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }
        _persist_chat_messages(db, current_user, text, response)
        return response

    if intent == "UNKNOWN":
        freeform = _call_gemini_freeform(text)
        if freeform:
            response = {
                "answer": freeform,
                "intent": "chat_general",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
            _persist_chat_messages(db, current_user, text, response)
            return response

    response = {
        "answer": friendly,
        "intent": intent,
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
            or "gemini-1.5-flash"
        )
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=(
                "Bạn là hệ thống nhận diện hóa đơn OCR tài chính. "
                "Trích xuất thông tin thành JSON chuẩn xác. Yêu cầu:\n"
                "- date: Ngày trên hóa đơn có định dạng 'YYYY-MM-DD', nếu không có trả về null.\n"
                "- merchant: Tên cửa hàng, siêu thị. Ngắn gọn, chuẩn hóa, bỏ bớt địa chỉ.\n"
                "- total: Tổng tiền thanh toán cuối cùng (kiểu số nguyên).\n"
                "- vat: Tiền thuế (nếu có, kiểu số nguyên).\n"
                "- estimated: Tiền hàng trước thuế hoặc giảm giá (nếu có, kiểu số nguyên).\n"
                "- note: Ghi chú mô tả ngắn về hóa đơn.\n"
                "- text: Các chi tiết chữ thô nhận diện được.\n"
                "TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON, KHÔNG XUẤT MARKDOWN, KHÔNG GIẢI THÍCH."
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


