from __future__ import annotations

from dataclasses import dataclass
from datetime import date as DateType, datetime, timedelta
import io
import json
import math
import re
import unicodedata
import urllib.error
import urllib.request

import pytesseract
from PIL import Image
from sqlalchemy.orm import Session

from app.auth.models import User
from app.core.config import settings
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service
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

AMOUNT_REGEX = re.compile(
    r"(?P<num>\d+(?:[.,]\d+)?)\s*(?P<unit>k|nghin|ngan|tr|trieu|m|million|ty|ti)?\b"
)
DATE_DDMM_REGEX = re.compile(r"(?P<day>\d{1,2})[/-](?P<month>\d{1,2})(?:[/-](?P<year>\d{2,4}))?")
DATE_ISO_REGEX = re.compile(r"(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})")
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

INCOME_KEYWORDS = [
    "thu",
    "luong",
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
CURRENCY_HINTS = ("vnd", "dong", "usd", "$", "eur", "yen", "jpy")

QUESTION_HINTS = ("bao nhieu", "tong", "co khong", "khong", "bao gio", "?")

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


def _parse_amount(text: str) -> float | None:
    normalized = _strip_date_fragments(_normalize_text(text))
    normalized = re.sub(r"\d{1,3}(?:\.\d{3})+", lambda match: match.group(0).replace(".", ""), normalized)
    matches = []
    for match in AMOUNT_REGEX.finditer(normalized):
        raw_num = match.group("num")
        if not raw_num:
            continue
        value = float(raw_num.replace(",", "."))
        unit = match.group("unit")
        multiplier = UNIT_MULTIPLIER.get(unit, 1)
        value *= multiplier
        matches.append(value)

    if not matches:
        return None
    return max(matches)


def _amount_has_unit(text: str) -> bool:
    normalized = _normalize_text(text)
    if any(hint in normalized for hint in CURRENCY_HINTS):
        return True
    unit_match = re.search(r"\d+(?:[.,]\d+)?\s*(k|nghin|ngan|tr|trieu|m|million|ty|ti)\b", normalized)
    return unit_match is not None


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
    normalized = _normalize_text(text)
    is_income = any(keyword in normalized for keyword in INCOME_KEYWORDS)
    is_expense = any(keyword in normalized for keyword in EXPENSE_KEYWORDS)
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
) -> dict:
    warnings: list[str] = []
    description = text.strip() or "NLP transaction"
    amount = None
    parsed_date = None
    transaction_type = None
    category_name = None

    llm_response = _call_dify(text, current_user.id, json_schema=TRANSACTION_SCHEMA)
    if llm_response:
        answer = llm_response.get("answer")
        if isinstance(answer, str):
            parsed = _extract_json(answer)
        else:
            parsed = answer if isinstance(answer, dict) else None
        if parsed:
            amount = _coerce_amount(parsed.get("amount"))
            date_value = parsed.get("date")
            if isinstance(date_value, str):
                parsed_date = _parse_iso_date(date_value) or _parse_date(date_value)
            transaction_type = _coerce_transaction_type(parsed.get("transaction_type"))
            category_name = parsed.get("category_name") if isinstance(
                parsed.get("category_name"), str
            ) else None
            if isinstance(parsed.get("description"), str) and parsed.get("description").strip():
                description = parsed.get("description").strip()

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


def answer_chat(
    db: Session,
    current_user: User,
    text: str,
) -> dict:
    normalized = _normalize_text(text)
    user_id = current_user.id

    pending_action = _peek_pending_action(user_id)
    if pending_action:
        if text.strip().isdigit():
            pending_action = _pop_pending_action(user_id)
            index = int(text.strip()) - 1
            candidates = pending_action.candidate_ids or []
            if index < 0 or index >= len(candidates):
                _set_pending_action(
                    user_id,
                    pending_action.action,
                    candidate_ids=candidates,
                    payload=pending_action.payload,
                )
                return {
                    "answer": "Ban hay chon dung so thu tu trong danh sach vua gui.",
                    "intent": "clarify_selection",
                    "start_date": None,
                    "end_date": None,
                    "category_name": None,
                    "total": None,
                }
            tx_id = candidates[index]
            tx = (
                db.query(Transaction)
                .filter(Transaction.id == tx_id, Transaction.user_id == user_id)
                .first()
            )
            if not tx:
                return {
                    "answer": "Khong tim thay giao dich de xu ly.",
                    "intent": pending_action.action,
                    "start_date": None,
                    "end_date": None,
                    "category_name": None,
                    "total": None,
                }
            if pending_action.action == "delete":
                finance_service.delete_transaction(db, current_user, tx_id)
                return {
                    "answer": f"Da xoa giao dich: {_format_tx_line(tx)}.",
                    "intent": "delete_transaction",
                    "start_date": tx.date,
                    "end_date": tx.date,
                    "category_name": None,
                    "total": None,
                }
            if pending_action.action == "update":
                payload = pending_action.payload or {}
                new_amount = payload.get("new_amount")
                if new_amount is None:
                    return {
                        "answer": "Ban muon sua so tien thanh bao nhieu?",
                        "intent": "update_transaction",
                        "start_date": tx.date,
                        "end_date": tx.date,
                        "category_name": None,
                        "total": None,
                    }
                update_payload = finance_schemas.TransactionUpdate(amount=new_amount)
                updated = finance_service.update_transaction(
                    db, current_user, tx_id, update_payload
                )
                return {
                    "answer": f"Da cap nhat giao dich: {_format_tx_line(updated)}.",
                    "intent": "update_transaction",
                    "start_date": updated.date,
                    "end_date": updated.date,
                    "category_name": None,
                    "total": updated.amount,
                }

        if pending_action.action == "create":
            pending_action = _pop_pending_action(user_id)
            payload = pending_action.payload or {}
            missing_fields = payload.get("missing_fields", [])
            if "amount" in missing_fields:
                amount = _parse_amount(text)
                if amount is None or _needs_amount_clarification(text, amount):
                    _set_pending_action(user_id, "create", payload=payload)
                    return {
                        "answer": "Ban muon ghi so tien bao nhieu? (vd: 50k, 1.5tr)",
                        "intent": "create_transaction",
                        "start_date": None,
                        "end_date": None,
                        "category_name": payload.get("category_name"),
                        "total": None,
                    }
                payload["amount"] = amount
                missing_fields.remove("amount")
            if "date" in missing_fields:
                date_value = _parse_date(text)
                if not date_value:
                    range_value = _parse_month_range(text) or _parse_relative_range(text)
                    if range_value:
                        date_value = range_value[0]
                if not date_value:
                    _set_pending_action(user_id, "create", payload=payload)
                    return {
                        "answer": "Ban muon ghi ngay nao? Vi du: 2026-03-06.",
                        "intent": "create_transaction",
                        "start_date": None,
                        "end_date": None,
                        "category_name": payload.get("category_name"),
                        "total": None,
                    }
                payload["date"] = date_value
                missing_fields.remove("date")

            if missing_fields:
                payload["missing_fields"] = missing_fields
                _set_pending_action(user_id, "create", payload=payload)
                return {
                    "answer": "Ban cho minh them thong tin de ghi giao dich nhe.",
                    "intent": "create_transaction",
                    "start_date": None,
                    "end_date": None,
                    "category_name": payload.get("category_name"),
                    "total": None,
                }

            category_id = payload.get("category_id")
            category_name = payload.get("category_name")
            if not category_id and category_name:
                category_id, resolved = _resolve_category(
                    db, current_user, category_name, auto_create=True
                )
                category_name = resolved or category_name

            tx_payload = finance_schemas.TransactionCreate(
                description=payload.get("description") or "NLP transaction",
                amount=payload.get("amount"),
                transaction_type=payload.get("transaction_type") or "expense",
                category_id=category_id,
                account_id=payload.get("account_id"),
                date=payload.get("date") or DateType.today(),
            )
            created = finance_service.create_transaction(db, current_user, tx_payload)
            return {
                "answer": (
                    f"Da ghi giao dich: {_format_tx_line(created)} "
                    f"(loai={created.transaction_type}, danh muc={category_name or 'Uncategorized'})."
                ),
                "intent": "create_transaction",
                "start_date": created.date,
                "end_date": created.date,
                "category_name": category_name,
                "total": created.amount,
            }

    if any(phrase in normalized for phrase in ONBOARDING_USAGE_PHRASES):
        return {
            "answer": (
                "Theo doi thu/chi, danh muc, bao cao theo thang/khoang thoi gian, "
                "tim giao dich, xuat du lieu; co the nhap nhanh bang cau tu nhien/anh hoa don (neu bat)."
            ),
            "intent": "onboarding",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }
    if any(phrase in normalized for phrase in ONBOARDING_START_PHRASES):
        return {
            "answer": "1) Tao danh muc 2) Them vi/tai khoan (neu co) 3) Nhap giao dich 4) Xem bao cao.",
            "intent": "onboarding",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }
    if any(phrase in normalized for phrase in ONBOARDING_RECORD_PHRASES):
        return {
            "answer": (
                "Vi du: 'Hom nay chi 50k an sang', '02/03 thu luong 20tr', "
                "'chuyen 500k tu vi A sang vi B', 'hom qua mua ca phe 45k'."
            ),
            "intent": "onboarding",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }

    if any(keyword in normalized for keyword in ACCOUNT_CREATE_KEYWORDS):
        name = _extract_account_name(text)
        if not name:
            return {
                "answer": "Ban muon dat ten vi/tai khoan nao?",
                "intent": "transfer",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        existing = _get_account_by_name(db, current_user, name)
        if existing:
            return {
                "answer": f"Vi/tai khoan '{name}' da ton tai.",
                "intent": "transfer",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        account = Account(
            user_id=current_user.id,
            name=name,
            currency="VND",
            opening_balance=0.0,
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return {
            "answer": f"Da them vi/tai khoan '{name}'.",
            "intent": "transfer",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }

    if "doi ten danh muc" in normalized:
        pair = _extract_category_rename(text)
        if not pair:
            return {
                "answer": "Ban muon doi ten danh muc nao thanh ten gi?",
                "intent": "category_rename",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        old_name, new_name = pair
        category = _get_category_by_name(db, current_user, old_name)
        if not category:
            return {
                "answer": f"Khong tim thay danh muc '{old_name}'.",
                "intent": "category_rename",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        if _get_category_by_name(db, current_user, new_name):
            return {
                "answer": f"Danh muc '{new_name}' da ton tai.",
                "intent": "category_rename",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        category.name = new_name
        db.commit()
        db.refresh(category)
        return {
            "answer": f"Da doi ten danh muc '{old_name}' thanh '{new_name}'. Thong ke se cap nhat theo ten moi.",
            "intent": "category_rename",
            "start_date": None,
            "end_date": None,
            "category_name": new_name,
            "total": None,
        }

    if "gop danh muc" in normalized:
        pair = _extract_category_merge(text)
        if not pair:
            return {
                "answer": "Ban muon gop danh muc nao vao danh muc nao?",
                "intent": "category_merge",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        src_name, dst_name = pair
        if _normalize_text(src_name) == _normalize_text(dst_name):
            return {
                "answer": "Hai danh muc trung nhau, khong the gop.",
                "intent": "category_merge",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        src_category = _get_category_by_name(db, current_user, src_name)
        dst_category = _get_category_by_name(db, current_user, dst_name)
        if not src_category or not dst_category:
            return {
                "answer": "Khong tim thay danh muc can gop.",
                "intent": "category_merge",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        moved = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.category_id == src_category.id,
            )
            .update({Transaction.category_id: dst_category.id})
        )
        db.delete(src_category)
        db.commit()
        return {
            "answer": (
                f"Da gop danh muc '{src_name}' vao '{dst_name}'. "
                f"Da chuyen {moved or 0} giao dich."
            ),
            "intent": "category_merge",
            "start_date": None,
            "end_date": None,
            "category_name": dst_name,
            "total": None,
        }

    if "xuat" in normalized and ("csv" in normalized or "excel" in normalized or "xuat du lieu" in normalized):
        start_date, end_date, _ = _resolve_time_range(text)
        export_dir = "app/exports"
        try:
            import os
            import csv

            os.makedirs(export_dir, exist_ok=True)
            filename = f"export_{user_id}_{start_date}_{end_date}.csv"
            path = os.path.join(export_dir, filename)
            transactions = _list_transactions(db, current_user, start_date, end_date)
            with open(path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(["date", "description", "amount", "type", "category_id"])
                for tx in transactions:
                    writer.writerow(
                        [tx.date, tx.description, tx.amount, tx.transaction_type, tx.category_id]
                    )
            return {
                "answer": f"Da tao file xuat du lieu {start_date} den {end_date}: {path}.",
                "intent": "export_data",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": float(len(transactions)),
            }
        except OSError:
            return {
                "answer": "Khong the tao file xuat du lieu luc nay.",
                "intent": "export_data",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": None,
            }

    if "nhap" in normalized and "file" in normalized:
        return {
            "answer": (
                "Hay tai len file CSV tu ngan hang theo format: date, description, amount, type, category. "
                "Sau do minh se map danh muc va nhap vao he thong."
            ),
            "intent": "import_data",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": None,
        }

    if any(keyword in normalized for keyword in TRANSFER_KEYWORDS):
        amount, source, target, date_value = _parse_transfer(text)
        if amount is None or _needs_amount_clarification(text, amount):
            return {
                "answer": "Ban muon chuyen so tien bao nhieu? (vd: 500k, 2tr)",
                "intent": "transfer",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        if not source or not target:
            return {
                "answer": "Ban muon chuyen tu vi/tai khoan nao sang vi/tai khoan nao?",
                "intent": "transfer",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        source_account = _ensure_account(db, current_user, source)
        target_account = _ensure_account(db, current_user, target)
        transfer = Transfer(
            user_id=user_id,
            from_account_id=source_account.id,
            to_account_id=target_account.id,
            amount=float(amount),
            date=date_value or DateType.today(),
            note=text.strip() or None,
        )
        db.add(transfer)
        db.commit()
        return {
            "answer": (
                f"Da ghi chuyen {amount} tu {source} sang {target} ngay {date_value}."
            ),
            "intent": "transfer",
            "start_date": date_value,
            "end_date": date_value,
            "category_name": None,
            "total": float(amount),
        }

    if any(keyword in normalized for keyword in TRANSACTION_UPDATE_KEYWORDS):
        new_amount = _parse_amount(text)
        if new_amount is None or _needs_amount_clarification(text, new_amount):
            return {
                "answer": "Ban muon sua so tien thanh bao nhieu? (vd: 55k, 2tr)",
                "intent": "update_transaction",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        if _is_recent_reference(text):
            latest = _latest_transaction(db, current_user, None)
            if not latest:
                return {
                    "answer": "Chua co giao dich gan nhat de sua.",
                    "intent": "update_transaction",
                    "start_date": None,
                    "end_date": None,
                    "category_name": None,
                    "total": None,
                }
            update_payload = finance_schemas.TransactionUpdate(amount=new_amount)
            updated = finance_service.update_transaction(db, current_user, latest.id, update_payload)
            return {
                "answer": f"Da cap nhat giao dich gan nhat: {_format_tx_line(updated)}.",
                "intent": "update_transaction",
                "start_date": updated.date,
                "end_date": updated.date,
                "category_name": None,
                "total": updated.amount,
            }
        start_date, end_date, _ = _resolve_time_range(text)
        category_name = _pick_category_name(text)
        category_id, _ = _resolve_category(db, current_user, category_name, auto_create=False)
        matches = _find_transactions_by_text(
            db, current_user, text, start_date, end_date, category_id
        )
        if not matches:
            return {
                "answer": "Chua tim thay giao dich de sua.",
                "intent": "update_transaction",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": category_name,
                "total": None,
            }
        if len(matches) == 1:
            tx = matches[0]
            update_payload = finance_schemas.TransactionUpdate(amount=new_amount)
            updated = finance_service.update_transaction(db, current_user, tx.id, update_payload)
            return {
                "answer": f"Da cap nhat giao dich: {_format_tx_line(updated)}.",
                "intent": "update_transaction",
                "start_date": updated.date,
                "end_date": updated.date,
                "category_name": category_name,
                "total": updated.amount,
            }
        candidates = matches[:3]
        _set_pending_action(
            user_id,
            "update",
            candidate_ids=[tx.id for tx in candidates],
            payload={"new_amount": new_amount},
        )
        lines = [f"{idx}. {_format_tx_line(tx)}" for idx, tx in enumerate(candidates, start=1)]
        return {
            "answer": "Tim thay nhieu giao dich, ban chon 1 muc:\n" + "\n".join(lines),
            "intent": "update_transaction",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": category_name,
            "total": None,
        }

    if any(keyword in normalized for keyword in TRANSACTION_DELETE_KEYWORDS):
        if _is_recent_reference(text):
            latest = _latest_transaction(db, current_user, None)
            if not latest:
                return {
                    "answer": "Chua co giao dich gan nhat de xoa.",
                    "intent": "delete_transaction",
                    "start_date": None,
                    "end_date": None,
                    "category_name": None,
                    "total": None,
                }
            finance_service.delete_transaction(db, current_user, latest.id)
            return {
                "answer": f"Da xoa giao dich gan nhat: {_format_tx_line(latest)}.",
                "intent": "delete_transaction",
                "start_date": latest.date,
                "end_date": latest.date,
                "category_name": None,
                "total": None,
            }
        start_date, end_date, _ = _resolve_time_range(text)
        category_name = _pick_category_name(text)
        category_id, _ = _resolve_category(db, current_user, category_name, auto_create=False)
        matches = _find_transactions_by_text(
            db, current_user, text, start_date, end_date, category_id
        )
        if not matches:
            return {
                "answer": "Chua tim thay giao dich de xoa.",
                "intent": "delete_transaction",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": category_name,
                "total": None,
            }
        if len(matches) == 1:
            tx = matches[0]
            finance_service.delete_transaction(db, current_user, tx.id)
            return {
                "answer": f"Da xoa giao dich: {_format_tx_line(tx)}.",
                "intent": "delete_transaction",
                "start_date": tx.date,
                "end_date": tx.date,
                "category_name": category_name,
                "total": None,
            }
        candidates = matches[:3]
        _set_pending_action(
            user_id,
            "delete",
            candidate_ids=[tx.id for tx in candidates],
        )
        lines = [f"{idx}. {_format_tx_line(tx)}" for idx, tx in enumerate(candidates, start=1)]
        return {
            "answer": "Tim thay nhieu giao dich, ban chon 1 muc:\n" + "\n".join(lines),
            "intent": "delete_transaction",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": category_name,
            "total": None,
        }

    parsed_amount = _parse_amount(text)
    is_question = _is_question(text)
    create_signal = any(keyword in normalized for keyword in TRANSACTION_CREATE_KEYWORDS)
    transaction_signal = any(
        keyword in normalized for keyword in ("mua", "chi", "thu", "nhan", "tra", "luong")
    )
    if not is_question and (create_signal or (parsed_amount is not None and transaction_signal)):
        start_date, end_date, _ = _resolve_time_range(text)
        default_date = start_date if start_date != end_date else start_date
        parsed = parse_transaction_text(
            db=db,
            current_user=current_user,
            text=text,
            default_date=default_date,
            auto_create_category=True,
        )
        account_name = _extract_account_from_text(text)
        account_id = None
        if account_name:
            account = _ensure_account(db, current_user, account_name)
            account_id = account.id
        missing_fields: list[str] = []
        if _needs_amount_clarification(text, parsed.get("amount")):
            missing_fields.append("amount")
        if not _parse_date(text) and not _parse_month_range(text) and not _parse_relative_range(text):
            missing_fields.append("date")
        payload = {
            "description": parsed.get("description"),
            "amount": parsed.get("amount"),
            "transaction_type": parsed.get("transaction_type"),
            "category_id": parsed.get("category_id"),
            "category_name": parsed.get("category_name"),
            "account_id": account_id,
            "date": parsed.get("date"),
            "missing_fields": missing_fields,
        }
        if missing_fields:
            _set_pending_action(user_id, "create", payload=payload)
            ask = (
                "Ban muon ghi so tien bao nhieu? (vd: 50k, 1.5tr)"
                if "amount" in missing_fields
                else "Ban muon ghi ngay nao? (vd: 2026-03-06)"
            )
            return {
                "answer": ask,
                "intent": "create_transaction",
                "start_date": None,
                "end_date": None,
                "category_name": parsed.get("category_name"),
                "total": None,
            }

        tx_payload = finance_schemas.TransactionCreate(
            description=parsed.get("description") or "NLP transaction",
            amount=parsed.get("amount"),
            transaction_type=parsed.get("transaction_type") or "expense",
            category_id=parsed.get("category_id"),
            account_id=account_id,
            date=parsed.get("date"),
        )
        created = finance_service.create_transaction(db, current_user, tx_payload)
        return {
            "answer": (
                f"Da ghi giao dich: {_format_tx_line(created)} "
                f"(loai={created.transaction_type}, danh muc={parsed.get('category_name') or 'Uncategorized'})."
            ),
            "intent": "create_transaction",
            "start_date": created.date,
            "end_date": created.date,
            "category_name": parsed.get("category_name"),
            "total": created.amount,
        }

    if "ngan sach" in normalized and "dat" in normalized:
        amount = _parse_amount(text)
        if amount is None:
            return {
                "answer": "Ban muon dat ngan sach bao nhieu?",
                "intent": "budget_set",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        normalized_text = _normalize_text(text)
        category_name = _pick_category_name(text)
        if not category_name:
            try:
                idx = normalized_text.index("ngan sach") + len("ngan sach")
                tail = normalized_text[idx:]
                digit_idx = re.search(r"\d", tail)
                if digit_idx:
                    category_name = tail[: digit_idx.start()].strip()
            except ValueError:
                category_name = None
        category_name = category_name or "tong"
        category_id = None
        if _normalize_text(category_name) != "tong":
            category_id, resolved = _resolve_category(
                db, current_user, category_name, auto_create=True
            )
            category_name = resolved or category_name
        start_of_month = _month_range_for_date(DateType.today())[0]
        existing = (
            db.query(Budget)
            .filter(
                Budget.user_id == user_id,
                Budget.category_id == category_id,
                Budget.period == "monthly",
                Budget.is_active.is_(True),
            )
            .first()
        )
        if existing:
            existing.limit = float(amount)
            existing.start_date = start_of_month
        else:
            db.add(
                Budget(
                    user_id=user_id,
                    category_id=category_id,
                    limit=float(amount),
                    period="monthly",
                    start_date=start_of_month,
                    is_active=True,
                )
            )
        db.commit()
        return {
            "answer": f"Da dat ngan sach {category_name}: {amount}/thang.",
            "intent": "budget_set",
            "start_date": None,
            "end_date": None,
            "category_name": category_name,
            "total": amount,
        }

    if "ngan sach" in normalized and "con" in normalized:
        budgets = (
            db.query(Budget)
            .filter(Budget.user_id == user_id, Budget.is_active.is_(True))
            .all()
        )
        if not budgets:
            return {
                "answer": "Ban chua dat ngan sach nao.",
                "intent": "budget_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        start_date, end_date, _ = _resolve_time_range(text)
        lines = []
        for budget in budgets:
            category_id = budget.category_id
            if category_id is None:
                spent = _sum_by_category(
                    db, current_user, start_date, end_date, None, "expense"
                )
                category_name = "tong"
            else:
                spent = _sum_by_category(
                    db, current_user, start_date, end_date, category_id, "expense"
                )
                category = (
                    db.query(Category)
                    .filter(Category.id == category_id, Category.user_id == user_id)
                    .first()
                )
                category_name = category.name if category else "Uncategorized"
            remaining = float(budget.limit) - float(spent)
            percent = (float(spent) / float(budget.limit) * 100) if budget.limit else 0.0
            status = ""
            if budget.limit and spent >= budget.limit:
                status = "VUOT 100%"
            elif budget.limit and spent >= budget.limit * 0.8:
                status = "GAN 80%"
            lines.append(
                f"- {category_name}: da dung {spent} ({percent:.0f}%), con lai {remaining} "
                f"(gioi han {budget.limit}) {status}".strip()
            )
        return {
            "answer": "Tinh trang ngan sach ({}):\n{}".format(
                _range_label(start_date, end_date), "\n".join(lines)
            ),
            "intent": "budget_status",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": None,
        }

    if "ngan sach" in normalized and "vuot" in normalized:
        budgets = (
            db.query(Budget)
            .filter(Budget.user_id == user_id, Budget.is_active.is_(True))
            .all()
        )
        if not budgets:
            return {
                "answer": "Ban chua dat ngan sach nao.",
                "intent": "budget_overrun",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        start_date, end_date, _ = _resolve_time_range(text)
        want_reason = "vi sao" in normalized or "tai sao" in normalized
        over_lines = []
        for budget in budgets:
            category_id = budget.category_id
            if category_id is None:
                spent = _sum_by_category(
                    db, current_user, start_date, end_date, None, "expense"
                )
                category_name = "tong"
            else:
                spent = _sum_by_category(
                    db, current_user, start_date, end_date, category_id, "expense"
                )
                category = (
                    db.query(Category)
                    .filter(Category.id == category_id, Category.user_id == user_id)
                    .first()
                )
                category_name = category.name if category else "Uncategorized"
            if spent > budget.limit:
                line = f"- {category_name}: vuot {spent - budget.limit} (gioi han {budget.limit})"
                if want_reason:
                    if category_id is None:
                        candidates = _list_transactions(
                            db, current_user, start_date, end_date, None, "expense"
                        )
                    else:
                        candidates = _list_transactions(
                            db, current_user, start_date, end_date, category_id, "expense"
                        )
                    top = candidates[:3]
                    if top:
                        detail = ", ".join(_format_tx_line(tx) for tx in top)
                        line += f" | giao dich lon: {detail}"
                over_lines.append(line)
        if not over_lines:
            return {
                "answer": "Thang nay chua vuot ngan sach.",
                "intent": "budget_overrun",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": None,
            }
        return {
            "answer": "Danh muc vuot ngan sach ({}):\n{}".format(
                _range_label(start_date, end_date), "\n".join(over_lines)
            ),
            "intent": "budget_overrun",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": None,
        }

    if "tiet kiem" in normalized and "thang" in normalized and "trong" in normalized:
        amount = _parse_amount(text)
        months_match = re.search(r"(\d+)\s*thang", normalized)
        if amount is None or not months_match:
            return {
                "answer": "Ban muon tiet kiem bao nhieu trong bao nhieu thang?",
                "intent": "goal_set",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        months = int(months_match.group(1))
        existing_goal = (
            db.query(Goal)
            .filter(Goal.user_id == user_id, Goal.is_active.is_(True))
            .first()
        )
        if existing_goal:
            existing_goal.target = float(amount)
            existing_goal.months = months
            existing_goal.start_date = DateType.today()
        else:
            db.add(
                Goal(
                    user_id=user_id,
                    target=float(amount),
                    months=months,
                    start_date=DateType.today(),
                    is_active=True,
                )
            )
        db.commit()
        per_month = float(amount) / months if months else float(amount)
        per_week = float(amount) / (months * 4.33) if months else float(amount)
        return {
            "answer": (
                f"Da tao muc tieu: {amount} trong {months} thang. "
                f"Can tiet kiem ~{per_month:.0f}/thang (~{per_week:.0f}/tuan)."
            ),
            "intent": "goal_set",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": amount,
        }

    if "tien do" in normalized and "muc tieu" in normalized:
        goal = (
            db.query(Goal)
            .filter(Goal.user_id == user_id, Goal.is_active.is_(True))
            .first()
        )
        if not goal:
            return {
                "answer": "Ban chua tao muc tieu tiet kiem nao.",
                "intent": "goal_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        transactions = _list_transactions(db, current_user, None, None, None, "expense")
        savings = sum(
            tx.amount for tx in transactions if "tiet kiem" in _normalize_text(tx.description)
        )
        progress = (savings / goal.target * 100) if goal.target else 0.0
        start_point = goal.start_date or goal.created_at.date()
        months_passed = _months_between(start_point, DateType.today())
        required_per_month = goal.target / goal.months if goal.months else goal.target
        current_per_month = savings / months_passed if months_passed else savings
        forecast = "du doan DAT" if current_per_month >= required_per_month else "du doan KHONG DAT"
        return {
            "answer": (
                f"Tien do muc tieu: {progress:.1f}% (da tiet kiem {savings} / {goal.target}). "
                f"Toc do hien tai ~{current_per_month:.0f}/thang, {forecast} theo muc tieu."
            ),
            "intent": "goal_status",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": savings,
        }

    if (
        ("them no" in normalized or "ghi no" in normalized or "vay" in normalized)
        and "bao nhieu" not in normalized
    ):
        amount, creditor, due_date = _parse_debt_entry(text)
        if amount is None or _needs_amount_clarification(text, amount):
            return {
                "answer": "Ban dang no bao nhieu? (vd: 5tr, 2.5tr)",
                "intent": "debt_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        if not creditor:
            return {
                "answer": "Ban dang no ai (chu no)?",
                "intent": "debt_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        db.add(
            Debt(
                user_id=user_id,
                creditor=creditor,
                amount=float(amount),
                due_date=due_date,
                is_paid=False,
            )
        )
        db.commit()
        due_text = f", han {due_date}" if due_date else ""
        return {
            "answer": f"Da ghi no {amount} voi {creditor}{due_text}.",
            "intent": "debt_status",
            "start_date": due_date,
            "end_date": due_date,
            "category_name": None,
            "total": float(amount),
        }

    if "dang no" in normalized or ("no" in normalized and "bao nhieu" in normalized):
        debts = (
            db.query(Debt)
            .filter(Debt.user_id == user_id, Debt.is_paid.is_(False))
            .all()
        )
        if not debts:
            return {
                "answer": "Chua co khoan no nao.",
                "intent": "debt_status",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": 0.0,
            }
        total = float(sum(item.amount for item in debts) or 0.0)
        by_creditor: dict[str, float] = {}
        for item in debts:
            key = item.creditor
            by_creditor[key] = by_creditor.get(key, 0.0) + float(item.amount)
        lines = [f"- {name}: {amount}" for name, amount in by_creditor.items()]
        due_dates = [item.due_date for item in debts if item.due_date]
        nearest_due = min(due_dates) if due_dates else None
        due_line = f"Han gan nhat: {nearest_due}." if nearest_due else "Chua co han cu the."
        return {
            "answer": f"Tong no: {total}. {due_line}\n" + "\n".join(lines),
            "intent": "debt_status",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": total,
        }

    if "tra no" in normalized or "tra the" in normalized:
        start_date, end_date, _ = _resolve_time_range(text)
        transactions = _list_transactions(db, current_user, start_date, end_date, None, "expense")
        paid_transactions = [
            tx
            for tx in transactions
            if any(key in _normalize_text(tx.description) for key in ("tra no", "tra the"))
        ]
        paid = sum(tx.amount for tx in paid_transactions)
        history = "\n".join(f"- {_format_tx_line(tx)}" for tx in paid_transactions[:3])
        return {
            "answer": (
                f"Thang nay da tra no: {paid} ({_range_label(start_date, end_date)})."
                + (f"\n{history}" if history else "")
            ),
            "intent": "debt_payment",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": paid,
        }

    if "nhac" in normalized and "tra the" in normalized:
        date_value = _parse_date(text)
        channel = _extract_reminder_channel(text)
        if not date_value and not channel:
            return {
                "answer": "Ban muon nhac vao ngay nao va qua kenh nao (email/push/n8n)?",
                "intent": "reminder_set",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        if not date_value:
            return {
                "answer": "Ban muon nhac vao ngay nao?",
                "intent": "reminder_set",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        if not channel:
            return {
                "answer": "Ban muon nhac qua kenh nao (email/push/n8n)?",
                "intent": "reminder_set",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        db.add(
            Reminder(
                user_id=user_id,
                label="tra the",
                remind_date=date_value,
                channel=channel,
            )
        )
        db.commit()
        return {
            "answer": f"Da nhac lich tra the vao {date_value} qua {channel}.",
            "intent": "reminder_set",
            "start_date": date_value,
            "end_date": date_value,
            "category_name": None,
            "total": None,
        }

    if (
        "subscription" in normalized
        or "dinh ky" in normalized
        or "moi thang" in normalized
    ) and "bao nhieu" not in normalized:
        amount = _parse_amount(text)
        if amount is None:
            return {
                "answer": "Ban muon tao khoan dinh ky bao nhieu?",
                "intent": "subscription_set",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": None,
            }
        day_match = re.search(r"ngay\s*(\d{1,2})", normalized)
        day_of_month = int(day_match.group(1)) if day_match else None
        name = None
        quoted = _extract_quoted(text)
        if quoted:
            name = quoted[0]
        else:
            match = re.search(r"tao khoan\s+(?P<name>.+?)\s+\d", _normalize_text(text))
            if match:
                name = match.group("name").strip()
            else:
                name = "subscription"
        existing_sub = _get_subscription_by_name(db, current_user, name)
        if existing_sub:
            existing_sub.amount = float(amount)
            existing_sub.day_of_month = day_of_month
        else:
            db.add(
                Subscription(
                    user_id=user_id,
                    name=name,
                    amount=float(amount),
                    day_of_month=day_of_month,
                    is_active=True,
                )
            )
        db.commit()
        day_text = f", ngay {day_of_month} hang thang" if day_of_month else ""
        return {
            "answer": f"Da tao khoan dinh ky {name}: {amount}/thang{day_text}.",
            "intent": "subscription_set",
            "start_date": None,
            "end_date": None,
            "category_name": None,
            "total": amount,
        }

    if ("subscription" in normalized or "dinh ky" in normalized) and "bao nhieu" in normalized:
        user_subs = (
            db.query(Subscription)
            .filter(Subscription.user_id == user_id, Subscription.is_active.is_(True))
            .all()
        )
        total = sum(item.amount for item in user_subs)
        if not user_subs:
            return {
                "answer": "Ban chua co khoan subscription nao.",
                "intent": "subscription_total",
                "start_date": None,
                "end_date": None,
                "category_name": None,
                "total": 0.0,
            }
        items = ", ".join(
            f"{item.name} ({item.amount}{'/ngay ' + str(item.day_of_month) if item.day_of_month else ''})"
            for item in user_subs
        )
        current_month = _month_range_for_date(DateType.today())
        return {
            "answer": (
                f"Thang nay ({_range_label(*current_month)}) tong subscription: {total}. "
                f"Danh sach: {items}."
            ),
            "intent": "subscription_total",
            "start_date": current_month[0],
            "end_date": current_month[1],
            "category_name": None,
            "total": total,
        }

    if (
        "tim giao dich" in normalized
        or (
            "giao dich" in normalized
            and ("tren" in normalized or "duoi" in normalized or _extract_search_term(text))
        )
    ):
        start_date, end_date, _ = _resolve_time_range(text)
        term = _extract_search_term(text)
        transactions = _list_transactions(db, current_user, start_date, end_date)
        if term:
            transactions = _filter_transactions_by_keywords(
                transactions, _tokenize_keywords(term)
            )
        threshold = _parse_amount(text)
        if threshold is not None and "tren" in normalized:
            transactions = [tx for tx in transactions if tx.amount >= threshold]
        if threshold is not None and "duoi" in normalized:
            transactions = [tx for tx in transactions if tx.amount <= threshold]
        total = sum(tx.amount for tx in transactions)
        lines = [f"- {_format_tx_line(tx)}" for tx in transactions[:5]]
        answer = (
            f"Tim thay {len(transactions)} giao dich ({_range_label(start_date, end_date)}), tong {total}."
        )
        if lines:
            answer += "\n" + "\n".join(lines)
        return {
            "answer": answer,
            "intent": "search_transactions",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": total,
        }

    start_date, end_date, _ = _resolve_time_range(text)
    range_label = _range_label(start_date, end_date)

    wants_breakdown = any(
        phrase in normalized
        for phrase in (
            "dung cho viec gi",
            "tieu vao dau",
            "chi vao dau",
            "chi nhung gi",
            "chi vao gi",
            "vao muc nao",
            "muc nao",
            "danh muc",
            "hang muc",
            "breakdown",
            "category",
        )
    ) and "bao cao danh muc" not in normalized and "chi nhieu nhat" not in normalized

    if "tuan nay" in normalized and ("chi" in normalized or "chi tieu" in normalized):
        current_week = _week_range_for_date(DateType.today())
        previous_week = _previous_week_range(DateType.today())
        current_total = _sum_by_category(
            db, current_user, current_week[0], current_week[1], None, "expense"
        )
        previous_total = _sum_by_category(
            db, current_user, previous_week[0], previous_week[1], None, "expense"
        )
        change = None
        if previous_total > 0:
            change = (current_total - previous_total) / previous_total * 100
        breakdown = finance_service.get_category_breakdown(
            db, current_user, start_date=current_week[0], end_date=current_week[1]
        )
        top = sorted(breakdown, key=lambda item: item.spent, reverse=True)[:3]
        top_line = ", ".join(f"{item.category} {item.spent}" for item in top) if top else "khong co"
        change_text = "khong co du lieu tuan truoc" if change is None else f"{change:.1f}%"
        return {
            "answer": (
                f"Tuan nay chi {current_total} ({_range_label(*current_week)}), "
                f"so voi tuan truoc {change_text}. Top danh muc: {top_line}."
            ),
            "intent": "expense_total",
            "start_date": current_week[0],
            "end_date": current_week[1],
            "category_name": None,
            "total": current_total,
        }

    if "bat thuong" in normalized or "anomaly" in normalized:
        start_date, end_date, _ = _resolve_time_range(text)
        transactions = _list_transactions(
            db, current_user, start_date, end_date, None, "expense"
        )
        anomalies = _detect_spend_anomalies(transactions)
        if not anomalies:
            return {
                "answer": f"Chua phat hien bat thuong chi tieu trong {_range_label(start_date, end_date)}.",
                "intent": "summary",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": None,
            }
        top = anomalies[:3]
        lines = [f"- {day}: {amount}" for day, amount in top]
        return {
            "answer": (
                f"Phat hien chi tieu bat thuong trong {_range_label(start_date, end_date)}:\n"
                + "\n".join(lines)
            ),
            "intent": "summary",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": float(sum(amount for _, amount in top)),
        }

    if "du doan" in normalized and ("chi" in normalized or "chi tieu" in normalized):
        start_date, end_date = _month_range_for_date(DateType.today())
        transactions = _list_transactions(
            db, current_user, start_date, DateType.today(), None, "expense"
        )
        spent = sum(tx.amount for tx in transactions)
        days_elapsed = max(1, (DateType.today() - start_date).days + 1)
        days_in_month = end_date.day
        forecast = spent / days_elapsed * days_in_month
        return {
            "answer": (
                f"Du doan chi tieu thang nay ({_range_label(start_date, end_date)}): "
                f"{forecast:.0f} (da chi {spent:.0f} trong {days_elapsed} ngay)."
            ),
            "intent": "summary",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": float(forecast),
        }

    if "con bao nhieu tien" in normalized or "so du" in normalized:
        summary = finance_service.get_summary(
            db, current_user, start_date=start_date, end_date=end_date
        )
        accounts = _list_accounts(db, current_user)
        if accounts:
            lines = []
            total_balance = 0.0
            for account in accounts:
                income = sum(
                    tx.amount
                    for tx in _list_transactions(
                        db,
                        current_user,
                        start_date,
                        end_date,
                        None,
                        "income",
                        account_id=account.id,
                    )
                )
                expense = sum(
                    tx.amount
                    for tx in _list_transactions(
                        db,
                        current_user,
                        start_date,
                        end_date,
                        None,
                        "expense",
                        account_id=account.id,
                    )
                )
                incoming, outgoing = _sum_transfers(
                    db, current_user, account.id, start_date, end_date
                )
                balance = float(account.opening_balance or 0.0) + income - expense + incoming - outgoing
                total_balance += balance
                lines.append(f"- {account.name}: {balance}")
            return {
                "answer": (
                    f"So du theo vi/tai khoan ({range_label}): {total_balance}.\n"
                    + "\n".join(lines)
                ),
                "intent": "summary",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": total_balance,
            }
        prefix = "Hien chua co vi/tai khoan, "
        return {
            "answer": (
                f"{prefix}dang tinh theo thu-chi ({range_label}). So du = {summary.balance}."
            ),
            "intent": "summary",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": summary.balance,
        }

    if wants_breakdown:
        items = finance_service.get_category_breakdown(
            db, current_user, start_date=start_date, end_date=end_date
        )
        if not items:
            return {
                "answer": f"Chua co giao dich chi tieu trong {range_label}.",
                "intent": "category_breakdown",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": 0.0,
            }
        top = sorted(items, key=lambda item: item.spent, reverse=True)[:5]
        total_spent = float(sum(item.spent for item in items) or 0.0)
        lines = [f"- {item.category}: {item.spent}" for item in top]
        top_item = top[0] if top else None
        top_line = (
            f"\nLon nhat: {top_item.category} {top_item.spent}."
            if top_item
            else ""
        )
        return {
            "answer": f"Chi theo danh muc ({range_label}):\n" + "\n".join(lines) + top_line,
            "intent": "category_breakdown",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": total_spent,
        }

    if "chi nhieu nhat" in normalized:
        items = finance_service.get_category_breakdown(
            db, current_user, start_date=start_date, end_date=end_date
        )
        if not items:
            return {
                "answer": f"Chua co giao dich chi tieu trong {range_label}.",
                "intent": "category_breakdown",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": 0.0,
            }
        items = sorted(items, key=lambda item: item.spent, reverse=True)
        total_spent = float(sum(item.spent for item in items) or 0.0)
        top = items[0]
        ratio = (top.spent / total_spent * 100) if total_spent else 0.0
        return {
            "answer": (
                f"Danh muc chi nhieu nhat ({range_label}): {top.category} {top.spent} "
                f"({ratio:.1f}%)."
            ),
            "intent": "category_breakdown",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": top.category,
            "total": top.spent,
        }

    if "co chi cho" in normalized or "chi cho" in normalized:
        category_name = _pick_category_name(text)
        if not category_name:
            match = re.search(r"chi cho\s+(?P<name>.+?)(?:\s+khong|\s*$)", normalized)
            if match:
                category_name = match.group("name").strip()
        if not category_name:
            return {
                "answer": "Ban muon xem chi tieu cho danh muc nao?",
                "intent": "expense_total",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": None,
            }
        category_id, _ = _resolve_category(db, current_user, category_name, auto_create=False)
        if category_id is None:
            total, count = _sum_expense_by_keywords(
                db,
                current_user,
                start_date,
                end_date,
                _tokenize_keywords(category_name),
            )
        else:
            total = _sum_by_category(
                db, current_user, start_date, end_date, category_id, "expense"
            )
            count = _count_transactions(
                db, current_user, start_date, end_date, category_id, "expense"
            )
        if total <= 0:
            return {
                "answer": f"Chua co chi tieu {category_name} trong {range_label}.",
                "intent": "expense_total",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": category_name,
                "total": total,
            }
        if category_id is None:
            candidates = _list_transactions(
                db, current_user, start_date, end_date, None, "expense"
            )
            recent = _filter_transactions_by_keywords(
                candidates, _tokenize_keywords(category_name)
            )[:3]
        else:
            recent = _list_transactions(
                db, current_user, start_date, end_date, category_id, "expense"
            )[:3]
        lines = [f"- {_format_tx_line(tx)}" for tx in recent]
        return {
            "answer": (
                f"Co. Tong chi {category_name} {total} ({range_label}), "
                f"so giao dich: {count}.\n" + "\n".join(lines)
            ),
            "intent": "expense_total",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": category_name,
            "total": total,
        }

    if "cua hang" in normalized or "merchant" in normalized:
        transactions = _list_transactions(
            db, current_user, start_date, end_date, None, "expense"
        )
        if not transactions:
            return {
                "answer": f"Chua co giao dich chi tieu trong {range_label}.",
                "intent": "category_breakdown",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": 0.0,
            }
        merchant_totals: dict[str, float] = {}
        for tx in transactions:
            key = _normalize_text(tx.description)
            merchant_totals[key] = merchant_totals.get(key, 0.0) + float(tx.amount or 0.0)
        if len(merchant_totals) < 2:
            return {
                "answer": "Chua du du lieu de tong hop cua hang.",
                "intent": "category_breakdown",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": 0.0,
            }
        top_name = max(merchant_totals, key=merchant_totals.get)
        return {
            "answer": f"Cua hang chi nhieu nhat ({range_label}): {top_name} {merchant_totals[top_name]}.",
            "intent": "category_breakdown",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": merchant_totals[top_name],
        }

    if "tom tat" in normalized and "thang" in normalized:
        summary = finance_service.get_summary(
            db, current_user, start_date=start_date, end_date=end_date
        )
        transactions = _list_transactions(
            db, current_user, start_date, end_date, None, "expense"
        )
        daily = _daily_expense_totals(transactions)
        if daily:
            top_day = max(daily, key=daily.get)
            top_day_amount = daily[top_day]
            top_day_line = f"Ngay chi nhieu nhat: {top_day} ({top_day_amount})."
        else:
            top_day_line = "Khong co giao dich chi tieu."
        count = _count_transactions(db, current_user, start_date, end_date, None, None)
        return {
            "answer": (
                f"Tom tat {range_label}: thu={summary.total_income}, chi={summary.total_expense}, "
                f"so du={summary.balance}. So giao dich: {count}. {top_day_line}"
            ),
            "intent": "report_summary",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": summary.total_expense,
        }

    if "so sanh" in normalized and "thang nay" in normalized and "thang truoc" in normalized:
        current_start, current_end = _month_range_for_date(DateType.today())
        prev_start, prev_end = _month_range_for_date(DateType.today().replace(day=1) - timedelta(days=1))
        current_summary = finance_service.get_summary(
            db, current_user, start_date=current_start, end_date=current_end
        )
        prev_summary = finance_service.get_summary(
            db, current_user, start_date=prev_start, end_date=prev_end
        )
        def _pct_delta(cur: float, prev: float) -> str:
            if prev == 0:
                return "khong co du lieu thang truoc"
            return f"{((cur - prev) / prev * 100):.1f}%"
        return {
            "answer": (
                f"Thang nay ({current_start} den {current_end}) thu={current_summary.total_income}, "
                f"chi={current_summary.total_expense}. Thang truoc ({prev_start} den {prev_end}) "
                f"thu={prev_summary.total_income}, chi={prev_summary.total_expense}. "
                f"Chenh lech thu: {_pct_delta(current_summary.total_income, prev_summary.total_income)}, "
                f"chenh lech chi: {_pct_delta(current_summary.total_expense, prev_summary.total_expense)}."
            ),
            "intent": "compare_months",
            "start_date": current_start,
            "end_date": current_end,
            "category_name": None,
            "total": current_summary.total_expense,
        }

    if "bieu do" in normalized and "theo ngay" in normalized:
        transactions = _list_transactions(
            db, current_user, start_date, end_date, None, "expense"
        )
        daily = _daily_expense_totals(transactions)
        if not daily:
            return {
                "answer": f"Chua co giao dich chi tieu trong {range_label}.",
                "intent": "daily_chart",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": 0.0,
            }
        lines = [f"{day}: {amount}" for day, amount in sorted(daily.items())]
        return {
            "answer": f"Du lieu chi tieu theo ngay ({range_label}):\n" + "\n".join(lines),
            "intent": "daily_chart",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": float(sum(daily.values())),
        }

    if "bao cao danh muc" in normalized:
        items = finance_service.get_category_breakdown(
            db, current_user, start_date=start_date, end_date=end_date
        )
        if not items:
            return {
                "answer": f"Chua co giao dich chi tieu trong {range_label}.",
                "intent": "category_breakdown",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": 0.0,
            }
        items = sorted(items, key=lambda item: item.spent, reverse=True)
        top = items[:5]
        other = float(sum(item.spent for item in items[5:]) or 0.0)
        lines = [f"- {item.category}: {item.spent}" for item in top]
        if other > 0:
            lines.append(f"- Khac: {other}")
        return {
            "answer": f"Bao cao danh muc ({range_label}):\n" + "\n".join(lines),
            "intent": "category_breakdown",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": float(sum(item.spent for item in items) or 0.0),
        }

    if "luong" in normalized and "nam" in normalized:
        year_range = _parse_year_range(text)
        if not year_range:
            year_range = (
                DateType.today().replace(month=1, day=1),
                DateType.today().replace(month=12, day=31),
            )
        transactions = _list_transactions(
            db, current_user, year_range[0], year_range[1], None, "income"
        )
        transactions = [
            tx for tx in transactions if "luong" in _normalize_text(tx.description)
        ]
        monthly: dict[str, float] = {}
        for tx in transactions:
            key = f"{tx.date.year}-{tx.date.month:02d}"
            monthly[key] = monthly.get(key, 0.0) + float(tx.amount or 0.0)
        lines = [f"- {month}: {amount}" for month, amount in sorted(monthly.items())]
        total = sum(monthly.values())
        return {
            "answer": f"Thu luong theo thang ({year_range[0].year}):\n" + "\n".join(lines),
            "intent": "income_total",
            "start_date": year_range[0],
            "end_date": year_range[1],
            "category_name": "Salary",
            "total": total,
        }

    if "co thu nhap" in normalized or ("thu nhap" in normalized and "khong" in normalized):
        total = _sum_by_category(
            db, current_user, start_date, end_date, None, "income"
        )
        count = _count_transactions(
            db, current_user, start_date, end_date, None, "income"
        )
        if total <= 0:
            return {
                "answer": f"Chua co giao dich thu trong {range_label}.",
                "intent": "income_total",
                "start_date": start_date,
                "end_date": end_date,
                "category_name": None,
                "total": total,
            }
        return {
            "answer": f"Co. Tong thu {total} trong {range_label}. So giao dich: {count}.",
            "intent": "income_total",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": total,
        }

    if "thu" in normalized and ("bao nhieu" in normalized or "tong" in normalized):
        total = _sum_by_category(
            db, current_user, start_date, end_date, None, "income"
        )
        count = _count_transactions(
            db, current_user, start_date, end_date, None, "income"
        )
        return {
            "answer": f"Tong thu {total} trong {range_label}. So giao dich: {count}.",
            "intent": "income_total",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": total,
        }

    if "chi" in normalized and ("bao nhieu" in normalized or "tong" in normalized):
        total = _sum_by_category(
            db, current_user, start_date, end_date, None, "expense"
        )
        count = _count_transactions(
            db, current_user, start_date, end_date, None, "expense"
        )
        return {
            "answer": f"Tong chi {total} trong {range_label}. So giao dich: {count}.",
            "intent": "expense_total",
            "start_date": start_date,
            "end_date": end_date,
            "category_name": None,
            "total": total,
        }

    summary = finance_service.get_summary(
        db, current_user, start_date=start_date, end_date=end_date
    )
    total_count = _count_transactions(
        db,
        current_user,
        start_date,
        end_date,
        category_id=None,
        transaction_type=None,
    )
    answer = (
        f"Tom tat {range_label}: thu={summary.total_income}, chi={summary.total_expense}, "
        f"so du={summary.balance}. So giao dich: {total_count}."
    )
    return {
        "answer": answer,
        "intent": "summary",
        "start_date": start_date,
        "end_date": end_date,
        "category_name": None,
        "total": summary.total_expense,
    }


def extract_ocr(image_bytes: bytes) -> dict:
    image = Image.open(io.BytesIO(image_bytes))
    text = pytesseract.image_to_string(image) or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    merchant = lines[0] if lines else None
    total = _parse_amount(text)
    date_value = _parse_date(text)
    return {
        "merchant": merchant,
        "total": total,
        "date": date_value,
        "text": text,
    }

