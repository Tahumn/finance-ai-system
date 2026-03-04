from __future__ import annotations

from datetime import date as DateType, timedelta
import json
import re
import unicodedata
import urllib.error
import urllib.request

from sqlalchemy.orm import Session

from app.auth.models import User
from app.core.config import settings
from app.finance import schemas as finance_schemas
from app.finance import service as finance_service
from app.finance.models import Category, Transaction

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

CHAT_INTENT_SCHEMA = {
    "name": "chat_intent",
    "schema": {
        "type": "object",
        "properties": {
            "intent": {
                "type": "string",
                "enum": ["summary", "expense_total", "income_total", "category_breakdown"],
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
    match = MONTH_REGEX.search(normalized)
    if not match:
        return None
    month = int(match.group("month"))
    if month < 1 or month > 12:
        return None
    year_match = YEAR_REGEX.search(normalized)
    year = DateType.today().year
    if year_match:
        year = int(year_match.group("year"))
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
    intent = None
    category_name = _pick_category_name(text)
    start_date = None
    end_date = None

    llm_response = _call_dify(text, current_user.id, json_schema=CHAT_INTENT_SCHEMA)
    if llm_response:
        answer = llm_response.get("answer")
        parsed = _extract_json(answer) if isinstance(answer, str) else None
        if parsed:
            if isinstance(parsed.get("intent"), str):
                intent = _normalize_text(parsed.get("intent"))
            if isinstance(parsed.get("category_name"), str):
                category_name = parsed.get("category_name")
            if isinstance(parsed.get("start_date"), str):
                start_date = _parse_iso_date(parsed.get("start_date"))
            if isinstance(parsed.get("end_date"), str):
                end_date = _parse_iso_date(parsed.get("end_date"))

    if not start_date or not end_date:
        range_tuple = _parse_month_range(text)
        if range_tuple:
            start_date, end_date = range_tuple
        else:
            start_date, end_date = _default_month_range()

    wants_breakdown = any(
        phrase in normalized
        for phrase in (
            "dung cho viec gi",
            "tieu vao dau",
            "chi vao dau",
            "chi nhung gi",
            "chi vao gi",
            "danh muc",
            "hang muc",
            "breakdown",
            "category",
        )
    )
    if wants_breakdown:
        intent = "category_breakdown"

    if intent is None:
        if "chi" in normalized and ("bao nhieu" in normalized or "tong" in normalized):
            intent = "expense_total"
        elif "thu" in normalized and ("bao nhieu" in normalized or "tong" in normalized):
            intent = "income_total"
        elif "chi" in normalized:
            intent = "expense_total"
        elif "thu" in normalized:
            intent = "income_total"
        else:
            intent = "summary"

    category_id, resolved_name = _resolve_category(
        db, current_user, category_name, auto_create=False
    )
    category_name = resolved_name or category_name
    if category_name and not category_id:
        # Do not hard-fail on hallucinated categories; answer without category filter.
        category_name = None

    if intent in ("category_breakdown",):
        items = finance_service.get_category_breakdown(
            db, current_user, start_date=start_date, end_date=end_date
        )
        if not items:
            return {
                "answer": f"Khong co giao dich chi tieu tu {start_date} den {end_date}.",
                "intent": intent,
                "start_date": start_date,
                "end_date": end_date,
                "category_name": category_name,
                "total": 0.0,
            }
        top = sorted(items, key=lambda item: item.spent, reverse=True)[:5]
        lines = [f"- {item.category}: {item.spent}" for item in top]
        total_spent = float(sum(item.spent for item in items) or 0.0)
        answer = (
            f"Ban da chi theo danh muc (tu {start_date} den {end_date}):\n"
            + "\n".join(lines)
        )
        return {
            "answer": answer,
            "intent": intent,
            "start_date": start_date,
            "end_date": end_date,
            "category_name": category_name,
            "total": total_spent,
        }

    if intent in ("expense_total", "income_total", "expense", "income"):
        intent = "expense_total" if intent in ("expense_total", "expense") else "income_total"
        transaction_type = "expense" if intent == "expense_total" else "income"
        total = _sum_by_category(
            db,
            current_user,
            start_date,
            end_date,
            category_id,
            transaction_type,
        )
        label = category_name or "tat ca danh muc"
        answer = f"Tong {transaction_type} cho {label} tu {start_date} den {end_date}: {total}"
        return {
            "answer": answer,
            "intent": intent,
            "start_date": start_date,
            "end_date": end_date,
            "category_name": category_name,
            "total": total,
        }

    summary = finance_service.get_summary(
        db, current_user, start_date=start_date, end_date=end_date
    )
    answer = (
        f"Tom tat tu {start_date} den {end_date}: "
        f"thu={summary.total_income}, chi={summary.total_expense}, so du={summary.balance}"
    )
    return {
        "answer": answer,
        "intent": "summary",
        "start_date": start_date,
        "end_date": end_date,
        "category_name": category_name,
        "total": summary.total_expense,
    }

