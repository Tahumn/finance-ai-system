from __future__ import annotations

import argparse
import random
from datetime import date, timedelta

from sqlalchemy import func

from app.auth.models import User
from app.auth.security import hash_password
from app.database import SessionLocal
from app.finance.models import Account, Bill, Budget, Category, Goal, SavingsGoal, Tag, Transaction


INCOME_CATEGORIES = [
    "Lương",
    "Freelance",
    "Đầu tư",
    "Thưởng",
    "Hoàn tiền",
    "Thu nhập khác",
]

EXPENSE_CATEGORIES = [
    "Ăn uống",
    "Di chuyển",
    "Mua sắm",
    "Hóa đơn",
    "Giải trí",
    "Sức khỏe",
    "Nhà cửa",
    "Giáo dục",
    "Du lịch",
    "Công nghệ",
]

PAYMENT_TAG_DEFS = [
    ("Tiền mặt", "#22c55e"),
    ("Ngân hàng", "#3b82f6"),
    ("Ví điện tử", "#a855f7"),
]

CATEGORY_TAG_POOL = {
    "Ăn uống": ["Dookki", "Lotteria", "Circle K", "Highlands", "Bún bò", "Trà sữa", "Cơm văn phòng"],
    "Di chuyển": ["Máy bay", "Grab", "Be", "Xanh SM", "Taxi", "Vé xe bus", "Gửi xe"],
    "Mua sắm": ["Shopee", "Lazada", "Tiki", "Uniqlo", "Mỹ phẩm", "Gia dụng"],
    "Hóa đơn": ["Điện", "Nước", "Internet", "Điện thoại", "Thuê bao app", "Cloud"],
    "Giải trí": ["Netflix", "CGV", "Game", "Karaoke", "Concert"],
    "Sức khỏe": ["Nhà thuốc", "Gym", "Khám bệnh", "Vitamin", "Bảo hiểm"],
    "Nhà cửa": ["Tiền nhà", "Sửa chữa", "Nội thất", "Siêu thị", "Dọn dẹp"],
    "Giáo dục": ["Udemy", "Coursera", "Sách", "Chứng chỉ", "Lệ phí thi"],
    "Du lịch": ["Vé máy bay", "Khách sạn", "Homestay", "Đặt tour", "Đi lại"],
    "Công nghệ": ["Tai nghe", "Bàn phím", "Cloud", "Phần mềm", "Hosting"],
    "Lương": ["Payroll", "Lương cứng", "Thưởng KPI"],
    "Freelance": ["Dự án web", "Thiết kế", "Viết nội dung", "Marketing"],
    "Đầu tư": ["Cổ tức", "Lãi tiết kiệm", "ETF", "Quỹ mở"],
    "Thưởng": ["Bonus", "Thưởng nóng", "Thưởng dự án"],
    "Hoàn tiền": ["Cashback", "Hoàn đơn", "Ưu đãi thẻ"],
    "Thu nhập khác": ["Bán đồ cũ", "Hỗ trợ gia đình", "Thu nhập khác"],
}

GOAL_DEFS = [
    ("Quỹ khẩn cấp", 50_000_000, 8),
    ("Du lịch Đà Nẵng", 20_000_000, 4),
    ("Mua laptop mới", 35_000_000, 6),
]

SAVINGS_GOAL_PLAN_DEFS = [
    {
        "name": "Du lịch Đà Nẵng",
        "goal_type": "Du lịch",
        "funding_source": "Ngân hàng",
        "priority": "high",
        "target_amount": 20_000_000,
        "saved_amount": 13_000_000,
        "monthly_contribution": 2_000_000,
        "months_to_target": 4,
        "note": "Tiết kiệm cho chuyến đi Đà Nẵng mùa hè."
    },
    {
        "name": "Quỹ dự phòng khẩn cấp",
        "goal_type": "Dự phòng",
        "funding_source": "Ngân hàng",
        "priority": "high",
        "target_amount": 100_000_000,
        "saved_amount": 45_000_000,
        "monthly_contribution": 5_000_000,
        "months_to_target": 12,
        "note": "Duy trì cuộc sống trong 6 tháng nếu có sự cố."
    },
    {
        "name": "Mua Macbook Pro M3",
        "goal_type": "Công nghệ",
        "funding_source": "Ví điện tử",
        "priority": "medium",
        "target_amount": 65_000_000,
        "saved_amount": 25_000_000,
        "monthly_contribution": 4_000_000,
        "months_to_target": 10,
        "note": "Nâng cấp máy phục vụ học tập và công việc."
    },
    {
        "name": "Du lịch Nhật Bản",
        "goal_type": "Du lịch",
        "funding_source": "Ngân hàng",
        "priority": "medium",
        "target_amount": 50_000_000,
        "saved_amount": 12_000_000,
        "monthly_contribution": 3_000_000,
        "months_to_target": 15,
        "note": "Chuyến đi ngắm hoa anh đào."
    },
    {
        "name": "Học tiếng Anh IELTS",
        "goal_type": "Giáo dục",
        "funding_source": "Tiền mặt",
        "priority": "low",
        "target_amount": 15_000_000,
        "saved_amount": 6_000_000,
        "monthly_contribution": 1_000_000,
        "months_to_target": 9,
        "note": "Lệ phí khoá học và thi chứng chỉ."
    },
]


def month_start_offset(today: date, months: int) -> date:
    month_index = today.month - (months - 1)
    year = today.year

    while month_index <= 0:
        month_index += 12
        year -= 1

    return date(year, month_index, 1)


def iter_month_starts(start: date, end: date):
    current = date(start.year, start.month, 1)

    while current <= end:
        yield current

        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)


def month_end(month_start: date) -> date:
    if month_start.month == 12:
        return date(month_start.year + 1, 1, 1) - timedelta(days=1)

    return date(month_start.year, month_start.month + 1, 1) - timedelta(days=1)


def clamp_day(year: int, month: int, day: int) -> date:
    end_day = month_end(date(year, month, 1)).day
    return date(year, month, min(day, end_day))


def model_has_column(model, column_name: str) -> bool:
    return hasattr(model, column_name)


def ensure_user(
    db,
    *,
    email: str,
    username: str,
    password: str,
) -> User:
    existing = db.query(User).filter(User.email == email).first()

    if existing:
        return existing

    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        email_verified=True,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def ensure_categories(db, user_id: int):
    names = INCOME_CATEGORIES + EXPENSE_CATEGORIES

    existing = (
        db.query(Category)
        .filter(Category.user_id == user_id, Category.name.in_(names))
        .all()
    )

    by_name = {item.name: item for item in existing}

    for name in names:
        if name in by_name:
            continue

        item = Category(name=name, user_id=user_id)
        db.add(item)
        db.flush()
        by_name[name] = item

    return by_name


def ensure_tags(db, user_id: int):
    all_tags = list(PAYMENT_TAG_DEFS)
    for cat_tags in CATEGORY_TAG_POOL.values():
        all_tags.extend((name, "#64748b") for name in cat_tags)
    names = [name for name, _ in all_tags]

    existing = (
        db.query(Tag)
        .filter(Tag.user_id == user_id, Tag.name.in_(names))
        .all()
    )

    by_name = {item.name: item for item in existing}

    for name, color in all_tags:
        if name in by_name:
            continue

        item = Tag(name=name, color=color, user_id=user_id)
        db.add(item)
        db.flush()
        by_name[name] = item

    return by_name


def ensure_account(db, user_id: int):
    # Dữ liệu mẫu giống UI
    account_defs = [
        {
            "name": "Tài khoản thanh toán",
            "type": "bank",
            "provider": "Vietcombank",
            "last4": "1234",
            "balance": 85250000.0,
            "color": "#3b82f6",
            "note": "Tài khoản nhận lương chính",
        },
        {
            "name": "Ví MoMo",
            "type": "wallet",
            "provider": "MoMo",
            "last4": "5678",
            "balance": 12600000.0,
            "color": "#d946ef",
            "note": "Chi tiêu ăn uống & tiện ích",
        },
        {
            "name": "Thẻ Visa Platinum",
            "type": "credit",
            "provider": "Techcombank",
            "last4": "4321",
            "balance": 45000000.0,
            "color": "#f59e0b",
            "note": "Hạn mức 100tr, dùng mua sắm lớn",
            "credit_limit": 100000000.0,
        },
        {
            "name": "Ví ZaloPay",
            "type": "wallet",
            "provider": "ZaloPay",
            "last4": "9988",
            "balance": 5400000.0,
            "color": "#0ea5e9",
            "note": "Thanh toán hóa đơn gia đình",
        },
        {
            "name": "Tiền mặt",
            "type": "cash",
            "provider": "Tiền mặt",
            "last4": None,
            "balance": 8500000.0,
            "color": "#22c55e",
            "note": "Tiền mặt trong ví",
        },
        {
            "name": "Thẻ Mastercard",
            "type": "credit",
            "provider": "HSBC",
            "last4": "1122",
            "balance": 15000000.0,
            "color": "#ef4444",
            "note": "Dùng khi đi du lịch nước ngoài",
            "credit_limit": 80000000.0,
        },
    ]

    main_account = None
    for acc_data in account_defs:
        account = (
            db.query(Account)
            .filter(Account.user_id == user_id, Account.name == acc_data["name"])
            .first()
        )
        if not account:
            account = Account(
                user_id=user_id,
                name=acc_data["name"],
                account_type=acc_data["type"],
                provider=acc_data["provider"],
                last4=acc_data["last4"],
                opening_balance=acc_data["balance"],
                color=acc_data["color"],
                note=acc_data["note"],
                credit_limit=acc_data.get("credit_limit"),
                currency="VND",
            )
            db.add(account)
            db.flush()
            
        if acc_data["name"] == "Tài khoản thanh toán":
            main_account = account
            
    return main_account


def ensure_bills(db, user_id: int, categories: dict[str, Category], accounts: list[Account], today: date):
    # Dữ liệu mẫu giống UI
    bill_defs = [
        {"merchant": "Circle K", "date": today, "category": "Ăn uống", "total": 78000, "vat": 0, "ocr": 0.92, "status": "confirmed", "no": "CK260426-00123"},
        {"merchant": "Highlands Coffee", "date": today - timedelta(days=1), "category": "Ăn uống", "total": 165000, "vat": 15000, "ocr": 0.95, "status": "confirmed", "no": "HL2504-998"},
        {"merchant": "WinMart", "date": today - timedelta(days=2), "category": "Mua sắm", "total": 685000, "vat": 62273, "ocr": 0.86, "status": "pending", "no": "WM-2404-001"},
        {"merchant": "Co.opmart", "date": today - timedelta(days=3), "category": "Mua sắm", "total": 1230000, "vat": 111818, "ocr": 0.93, "status": "confirmed", "no": "COOP-2304-X"},
        {"merchant": "The Coffee House", "date": today - timedelta(days=4), "category": "Ăn uống", "total": 120000, "vat": 0, "ocr": 0.88, "status": "confirmed", "no": "TCH-22-ABC"},
        {"merchant": "Guardian", "date": today - timedelta(days=5), "category": "Mua sắm", "total": 259000, "vat": 23545, "ocr": 0.91, "status": "confirmed", "no": "GD-21-XYZ"},
        {"merchant": "Grab", "date": today - timedelta(days=6), "category": "Di chuyển", "total": 85000, "vat": 0, "ocr": 0.92, "status": "confirmed", "no": "GRAB-2004"},
        {"merchant": "Shopee Express", "date": today - timedelta(days=7), "category": "Khác", "total": 37000, "vat": 0, "ocr": 0.85, "status": "error", "no": "SP-19-ERR"},
    ]
    
    existing = db.query(Bill).filter(Bill.user_id == user_id).count()
    if existing > 0:
        return
        
    main_account = next((a for a in accounts if a.name == "Tài khoản thanh toán"), accounts[0])
    
    for b in bill_defs:
        cat = categories.get(b["category"])
        db.add(Bill(
            user_id=user_id,
            merchant=b["merchant"],
            date=b["date"],
            category_id=cat.id if cat else None,
            account_id=main_account.id,
            total_amount=b["total"],
            vat_amount=b["vat"],
            ocr_confidence=b["ocr"],
            status=b["status"],
            bill_number=b["no"],
            items=[{"name": "Mặt hàng", "amount": b["total"]}]
        ))
    db.flush()


def add_months_safe(src: date, months: int) -> date:
    month = src.month - 1 + months
    year = src.year + month // 12
    month = month % 12 + 1
    return clamp_day(year, month, src.day)


def ensure_savings_goals(
    db,
    *,
    user_id: int,
    force: bool,
    today: date,
) -> int:
    if force:
        db.query(Goal).filter(Goal.user_id == user_id).delete(synchronize_session=False)
        db.flush()

    existing = db.query(Goal).filter(Goal.user_id == user_id).all()
    by_name = {item.name: item for item in existing}
    created = 0

    for name, target_amount, month_offset in GOAL_DEFS:
        if name in by_name:
            continue
        db.add(
            Goal(
                user_id=user_id,
                name=name,
                target_amount=float(target_amount),
                target_date=add_months_safe(today, month_offset),
            )
        )
        created += 1

    db.flush()
    return created


def ensure_savings_goal_plans(
    db,
    *,
    user_id: int,
    force: bool,
    today: date,
) -> int:
    if force:
        db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).delete(synchronize_session=False)
        db.flush()

    existing = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).all()
    by_name = {item.name: item for item in existing}
    created = 0
    for item in SAVINGS_GOAL_PLAN_DEFS:
        if item["name"] in by_name:
            continue
        db.add(
            SavingsGoal(
                user_id=user_id,
                name=item["name"],
                goal_type=item["goal_type"],
                funding_source=item["funding_source"],
                priority=item["priority"],
                note=item["note"],
                target_amount=float(item["target_amount"]),
                saved_amount=float(item["saved_amount"]),
                monthly_contribution=float(item["monthly_contribution"]),
                start_date=today,
                target_date=add_months_safe(today, item["months_to_target"]),
                auto_deposit=True,
                auto_transfer=True,
                status="active",
            )
        )
        created += 1

    db.flush()
    return created


def random_date_in_month(
    rng: random.Random,
    start: date,
    end: date,
    min_day: int = 1,
    max_day: int = 28,
) -> date:
    lower = max(start.day, min_day)
    upper = min(end.day, max_day)

    if lower > upper:
        lower, upper = start.day, end.day

    return date(start.year, start.month, rng.randint(lower, upper))


def amount_for_expense(category: str, rng: random.Random) -> float:
    if category == "Ăn uống":
        return float(rng.randrange(25_000, 280_000, 5_000))

    if category == "Di chuyển":
        return float(rng.randrange(10_000, 220_000, 5_000))

    if category == "Mua sắm":
        return float(rng.randrange(80_000, 2_500_000, 10_000))

    if category == "Hóa đơn":
        return float(rng.randrange(150_000, 3_500_000, 10_000))

    if category == "Giải trí":
        return float(rng.randrange(50_000, 1_200_000, 10_000))

    if category == "Sức khỏe":
        return float(rng.randrange(80_000, 1_500_000, 10_000))

    if category == "Nhà cửa":
        return float(rng.randrange(120_000, 6_500_000, 10_000))

    if category == "Giáo dục":
        return float(rng.randrange(100_000, 3_000_000, 10_000))

    if category == "Du lịch":
        return float(rng.randrange(300_000, 5_000_000, 10_000))

    if category == "Công nghệ":
        return float(rng.randrange(150_000, 6_000_000, 10_000))

    return float(rng.randrange(50_000, 1_000_000, 10_000))


def expense_description(category: str, rng: random.Random) -> str:
    templates = {
        "Ăn uống": [
            "Ăn sáng gần công ty",
            "Ăn trưa văn phòng",
            "Ăn tối cùng gia đình",
            "Coffee buổi sáng",
            "Đặt đồ ăn qua app",
            "Mua trà sữa",
            "Ăn vặt chiều",
            "Mua thực phẩm siêu thị",
        ],
        "Di chuyển": [
            "Đổ xăng xe máy",
            "Grab đi làm",
            "Taxi gặp khách hàng",
            "Gửi xe",
            "Vé xe buýt",
            "Phí cầu đường",
        ],
        "Mua sắm": [
            "Mua đồ cá nhân",
            "Mua quần áo",
            "Mua đồ siêu thị",
            "Mua phụ kiện",
            "Mua mỹ phẩm",
            "Mua hàng online",
        ],
        "Hóa đơn": [
            "Thanh toán tiền điện",
            "Thanh toán tiền nước",
            "Thanh toán internet",
            "Nạp tiền điện thoại",
            "Thanh toán phí dịch vụ",
            "Thanh toán thuê bao ứng dụng",
        ],
        "Giải trí": [
            "Xem phim cuối tuần",
            "Cafe với bạn bè",
            "Ăn uống tụ tập",
            "Mua game",
            "Đi chơi cuối tuần",
            "Mua vé sự kiện",
        ],
        "Sức khỏe": [
            "Mua thuốc",
            "Khám sức khỏe",
            "Mua vitamin",
            "Đóng phí tập gym",
            "Mua dụng cụ thể thao",
        ],
        "Nhà cửa": [
            "Thanh toán tiền nhà",
            "Mua đồ gia dụng",
            "Chi phí sinh hoạt",
            "Sửa chữa trong nhà",
            "Mua vật dụng bếp",
            "Dọn dẹp nhà cửa",
        ],
        "Giáo dục": [
            "Mua sách",
            "Đăng ký khóa học online",
            "Thanh toán học phí",
            "Mua tài liệu học tập",
            "Lệ phí thi/chứng chỉ",
        ],
        "Du lịch": [
            "Đặt vé xe/xe khách",
            "Đặt phòng nghỉ",
            "Chi phí du lịch cuối tuần",
            "Ăn uống khi đi chơi",
            "Di chuyển trong chuyến đi",
        ],
        "Công nghệ": [
            "Mua tai nghe",
            "Mua bàn phím",
            "Mua chuột",
            "Thanh toán lưu trữ cloud",
            "Mua phụ kiện điện thoại",
            "Thanh toán phần mềm",
        ],
    }

    return rng.choice(templates.get(category, [f"Chi tiêu {category.lower()}"]))


def income_description(category: str, rng: random.Random) -> str:
    templates = {
        "Lương": [
            "Nhận lương tháng",
            "Lương công ty",
            "Lương chuyển khoản",
        ],
        "Freelance": [
            "Thu nhập freelance",
            "Dự án ngoài giờ",
            "Thanh toán hợp đồng",
            "Thiết kế/viết nội dung tự do",
        ],
        "Đầu tư": [
            "Lợi nhuận đầu tư",
            "Cổ tức nhận được",
            "Lãi tiết kiệm",
            "Lợi nhuận quỹ đầu tư",
        ],
        "Thưởng": [
            "Thưởng hiệu suất",
            "Thưởng dự án",
            "Thưởng KPI",
            "Thưởng nóng",
        ],
        "Hoàn tiền": [
            "Hoàn tiền mua sắm",
            "Cashback thẻ tín dụng",
            "Hoàn tiền từ ví điện tử",
        ],
        "Thu nhập khác": [
            "Bán đồ cũ",
            "Nhận hỗ trợ từ gia đình",
            "Thu nhập phát sinh khác",
        ],
    }

    return rng.choice(templates.get(category, ["Thu nhập khác"]))


def add_transaction(
    rows: list[Transaction],
    *,
    user_id: int,
    category: Category,
    account: Account,
    description: str,
    amount: float,
    tx_type: str,
    tx_date: date,
    tags: list[Tag] | None = None,
):
    tx = Transaction(
        user_id=user_id,
        category_id=category.id,
        account_id=account.id,
        description=description,
        amount=float(amount),
        transaction_type=tx_type,
        date=tx_date,
    )

    if tags:
        tx.tags = tags

    rows.append(tx)


def pick_category_tag(tags_by_name: dict[str, Tag], category_name: str, rng: random.Random) -> Tag | None:
    candidates = CATEGORY_TAG_POOL.get(category_name, [])
    if not candidates:
        return None
    chosen = rng.choice(candidates)
    return tags_by_name.get(chosen)


def ensure_many_budgets(
    db,
    *,
    user_id: int,
    categories: dict[str, Category],
    start: date,
    today: date,
    force: bool,
    rng: random.Random,
) -> int:
    """
    Tạo nhiều dữ liệu ngân sách.

    Code này tự xử lý 2 kiểu model Budget:

    1. Nếu Budget có start_date và end_date:
       -> tạo ngân sách theo từng tháng cho từng danh mục.

    2. Nếu Budget chỉ có user_id, category_id, amount:
       -> tạo ngân sách theo từng danh mục.
    """

    budget_configs = {
        "Ăn uống": 5_000_000,
        "Di chuyển": 2_000_000,
        "Mua sắm": 3_500_000,
        "Hóa đơn": 3_500_000,
        "Giải trí": 2_500_000,
        "Sức khỏe": 2_000_000,
        "Nhà cửa": 6_500_000,
        "Giáo dục": 3_000_000,
        "Du lịch": 4_000_000,
        "Công nghệ": 4_500_000,
    }

    # Force False for Microservices to avoid unique constraint on (user_id, category_id)
    has_period = False 

    if force:
        db.query(Budget).filter(Budget.user_id == user_id).delete(
            synchronize_session=False
        )
        db.flush()

    created_count = 0

    if has_period:
        for month in iter_month_starts(start, today):
            start_date = month
            end_date = month_end(month)

            for cat_name, base_amount in budget_configs.items():
                category = categories.get(cat_name)

                if not category:
                    continue

                existing_budget = (
                    db.query(Budget)
                    .filter(
                        Budget.user_id == user_id,
                        Budget.category_id == category.id,
                        Budget.start_date == start_date,
                        Budget.end_date == end_date,
                    )
                    .first()
                )

                if existing_budget:
                    continue

                variation = rng.uniform(0.85, 1.25)
                final_amount = round(base_amount * variation / 10_000) * 10_000

                db.add(
                    Budget(
                        user_id=user_id,
                        category_id=category.id,
                        amount=float(final_amount),
                        start_date=start_date,
                        end_date=end_date,
                    )
                )

                created_count += 1

    else:
        for cat_name, base_amount in budget_configs.items():
            category = categories.get(cat_name)

            if not category:
                continue

            existing_budget = (
                db.query(Budget)
                .filter(
                    Budget.user_id == user_id,
                    Budget.category_id == category.id,
                )
                .first()
            )

            if existing_budget:
                continue

            variation = rng.uniform(0.85, 1.25)
            final_amount = round(base_amount * variation / 10_000) * 10_000

            db.add(
                Budget(
                    user_id=user_id,
                    category_id=category.id,
                    amount=float(final_amount),
                )
            )

            created_count += 1

    db.flush()

    return created_count


def seed_user_recent_transactions(
    db,
    user: User,
    months: int,
    force: bool,
    seed_base: int,
) -> tuple[int, int, int, int, int]:
    today = date.today()
    start = month_start_offset(today, months)

    rng = random.Random(seed_base + (user.id * 97))

    existing_recent = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.user_id == user.id,
            Transaction.date >= start,
            Transaction.date <= today,
        )
        .scalar()
        or 0
    )

    if existing_recent and not force:
        return 0, existing_recent, 0, 0, 0

    if force and existing_recent:
        (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user.id,
                Transaction.date >= start,
                Transaction.date <= today,
            )
            .delete(synchronize_session=False)
        )
        db.query(Bill).filter(Bill.user_id == user.id).delete(synchronize_session=False)
        db.flush()

    categories = ensure_categories(db, user.id)
    tags = ensure_tags(db, user.id)
    account = ensure_account(db, user.id)
    def tx_tags(payment_tag: Tag, category_name: str) -> list[Tag]:
        domain_tag = pick_category_tag(tags, category_name, rng)
        if domain_tag and domain_tag.id != payment_tag.id:
            return [payment_tag, domain_tag]
        return [payment_tag]

    all_accounts = db.query(Account).filter(Account.user_id == user.id).all()
    if not all_accounts:
        ensure_account(db, user.id)
        all_accounts = db.query(Account).filter(Account.user_id == user.id).all()
    
    account = all_accounts[0]

    rows: list[Transaction] = []

    for month in iter_month_starts(start, today):
        end_m = min(month_end(month), today)

        # Thu nhập: Lương cố định
        salary_date = clamp_day(month.year, month.month, 5)

        if salary_date <= today:
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Lương"],
                account=account,
                description=income_description("Lương", rng),
                amount=float(rng.randrange(12_000_000, 22_000_000, 100_000)),
                tx_type="income",
                tx_date=salary_date,
                tags=tx_tags(tags["Ngân hàng"], "Lương"),
            )

        # Thu nhập: Thưởng
        if rng.random() < 0.85:
            bonus_date = random_date_in_month(rng, month, end_m, min_day=15, max_day=28)

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Thưởng"],
                account=account,
                description=income_description("Thưởng", rng),
                amount=float(rng.randrange(800_000, 5_500_000, 50_000)),
                tx_type="income",
                tx_date=bonus_date,
                tags=tx_tags(tags["Ngân hàng"], "Thưởng"),
            )

        # Thu nhập: Freelance
        for _ in range(rng.randint(2, 5)):
            freelance_date = random_date_in_month(
                rng,
                month,
                end_m,
                min_day=5,
                max_day=27,
            )

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Freelance"],
                account=account,
                description=income_description("Freelance", rng),
                amount=float(rng.randrange(700_000, 8_500_000, 50_000)),
                tx_type="income",
                tx_date=freelance_date,
                tags=tx_tags(tags["Ngân hàng"], "Freelance"),
            )

        # Thu nhập: Đầu tư
        for _ in range(rng.randint(4, 8)):
            invest_date = random_date_in_month(
                rng,
                month,
                end_m,
                min_day=7,
                max_day=28,
            )

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Đầu tư"],
                account=account,
                description=income_description("Đầu tư", rng),
                amount=float(rng.randrange(200_000, 2_500_000, 50_000)),
                tx_type="income",
                tx_date=invest_date,
                tags=tx_tags(tags["Ngân hàng"], "Đầu tư"),
            )

        # Thu nhập: Hoàn tiền
        for _ in range(rng.randint(1, 3)):
            cashback_date = random_date_in_month(
                rng,
                month,
                end_m,
                min_day=10,
                max_day=28,
            )

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Hoàn tiền"],
                account=account,
                description=income_description("Hoàn tiền", rng),
                amount=float(rng.randrange(50_000, 500_000, 10_000)),
                tx_type="income",
                tx_date=cashback_date,
                tags=tx_tags(tags["Ngân hàng"], "Hoàn tiền"),
            )

        # Thu nhập khác
        if rng.random() < 0.55:
            extra_income_date = random_date_in_month(
                rng,
                month,
                end_m,
                min_day=12,
                max_day=28,
            )

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Thu nhập khác"],
                account=account,
                description=income_description("Thu nhập khác", rng),
                amount=float(rng.randrange(200_000, 3_000_000, 50_000)),
                tx_type="income",
                tx_date=extra_income_date,
                tags=tx_tags(tags["Tiền mặt"], "Thu nhập khác"),
            )

        # Chi tiêu cố định hằng tháng
        recurring_expenses = [
            (
                "Nhà cửa",
                "Thanh toán tiền nhà",
                rng.randrange(3_000_000, 6_500_000, 100_000),
                1,
                tx_tags(tags["Ngân hàng"], "Nhà cửa"),
            ),
            (
                "Hóa đơn",
                "Thanh toán điện/nước/internet",
                rng.randrange(1_200_000, 3_400_000, 50_000),
                12,
                tx_tags(tags["Ngân hàng"], "Hóa đơn"),
            ),
            (
                "Hóa đơn",
                "Nạp tiền điện thoại",
                rng.randrange(100_000, 300_000, 10_000),
                10,
                tx_tags(tags["Tiền mặt"], "Hóa đơn"),
            ),
            (
                "Sức khỏe",
                "Thanh toán phí gym",
                rng.randrange(250_000, 800_000, 10_000),
                8,
                tx_tags(tags["Ngân hàng"], "Sức khỏe"),
            ),
            (
                "Công nghệ",
                "Thanh toán phần mềm/lưu trữ",
                rng.randrange(80_000, 600_000, 10_000),
                20,
                tx_tags(tags["Ngân hàng"], "Công nghệ"),
            ),
        ]

        for category_name, desc, amount, day, tags_list in recurring_expenses:
            tx_date = clamp_day(month.year, month.month, day)

            if tx_date <= today:
                add_transaction(
                    rows,
                    user_id=user.id,
                    category=categories[category_name],
                    account=account,
                    description=desc,
                    amount=float(amount),
                    tx_type="expense",
                    tx_date=tx_date,
                    tags=tags_list,
                )

        # Chi du lịch
        if rng.random() < 0.45:
            travel_date = random_date_in_month(
                rng,
                month,
                end_m,
                min_day=18,
                max_day=28,
            )

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Du lịch"],
                account=account,
                description=expense_description("Du lịch", rng),
                amount=float(rng.randrange(800_000, 4_500_000, 50_000)),
                tx_type="expense",
                tx_date=travel_date,
                tags=tx_tags(tags["Tiền mặt"], "Du lịch"),
            )

        # Chi công nghệ
        if rng.random() < 0.35:
            tech_date = random_date_in_month(
                rng,
                month,
                end_m,
                min_day=8,
                max_day=25,
            )

            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Công nghệ"],
                account=account,
                description=expense_description("Công nghệ", rng),
                amount=float(rng.randrange(300_000, 3_500_000, 50_000)),
                tx_type="expense",
                tx_date=tech_date,
                tags=tx_tags(tags["Ngân hàng"], "Công nghệ"),
            )

    # Chi tiêu ngẫu nhiên hằng ngày
    current = start

    while current <= today:
        base_rate = 0.82 if current.weekday() < 5 else 0.92

        if rng.random() < base_rate:
            expense_count = (
                rng.randint(3, 6)
                if current.weekday() < 5
                else rng.randint(4, 8)
            )

            for _ in range(expense_count):
                category_name = rng.choices(
                    population=EXPENSE_CATEGORIES,
                    weights=[26, 17, 12, 6, 11, 7, 9, 5, 3, 4],
                    k=1,
                )[0]

                tag_roll = rng.random()
                if tag_roll < 0.45:
                    pay_tag = tags["Tiền mặt"]
                elif tag_roll < 0.78:
                    pay_tag = tags["Ngân hàng"]
                else:
                    pay_tag = tags["Ví điện tử"]

                add_transaction(
                    rows,
                    user_id=user.id,
                    category=categories[category_name],
                    account=account,
                    description=expense_description(category_name, rng),
                    amount=amount_for_expense(category_name, rng),
                    tx_type="expense",
                    tx_date=current,
                    tags=tx_tags(pay_tag, category_name),
                )

        current += timedelta(days=1)

    seed_bills_and_goals(db, user, categories, all_accounts, start, today, rng)

    db.add_all(rows)
    db.flush()
    db.commit()

    return len(rows), existing_recent, 0, 0, 0


def seed_bills_and_goals(db, user, categories, accounts, start, today, rng):
    # 1. Seed Savings Goals
    goals_data = [
        ("Quỹ dự phòng khẩn cấp", 50000000.0, 15000000.0, "Dự phòng", 2000000.0),
        ("Mua Macbook Pro", 65000000.0, 32500000.0, "Công nghệ", 5000000.0),
        ("Du lịch Nhật Bản", 40000000.0, 5000000.0, "Du lịch", 1000000.0),
        ("Quỹ hưu trí", 1000000000.0, 25000000.0, "Đầu tư", 3000000.0),
    ]
    
    for name, target, saved, g_type, monthly in goals_data:
        exists = db.query(SavingsGoal).filter(SavingsGoal.user_id == user.id, SavingsGoal.name == name).first()
        if not exists:
            goal = SavingsGoal(
                user_id=user.id,
                name=name,
                target_amount=target,
                saved_amount=saved,
                goal_type=g_type,
                monthly_contribution=monthly,
                status="active" if saved < target else "completed",
                start_date=start,
                target_date=today + timedelta(days=rng.randint(180, 720))
            )
            db.add(goal)

    # 2. Seed Bills
    merchants = ["EVN", "Viwaico", "Viettel", "FPT Telecom", "Vinhome", "Netflix", "Spotify"]
    bill_categories = ["Hóa đơn", "Hóa đơn", "Hóa đơn", "Hóa đơn", "Hóa đơn", "Giải trí", "Giải trí"]
    
    for i in range(12):
        bill_date = today - timedelta(days=rng.randint(0, 180))
        cat_name = rng.choice(bill_categories)
        merchant = rng.choice(merchants)
        amount = float(rng.randint(200000, 5000000))
        
        bill = Bill(
            user_id=user.id,
            merchant=merchant,
            date=bill_date,
            category_id=categories[cat_name].id,
            account_id=rng.choice(accounts).id,
            total_amount=amount,
            status=rng.choice(["paid", "pending", "overdue"]),
            bill_number=f"BILL-{rng.randint(10000, 99999)}",
            notes=f"Hóa đơn {merchant} tháng {bill_date.month}",
            created_at=bill_date
        )
        db.add(bill)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Seed finance transactions, categories, budgets, tags, and demo user."
    )

    parser.add_argument(
        "--email",
        type=str,
        default=None,
        help="Seed only this user email.",
    )

    parser.add_argument(
        "--months",
        type=int,
        default=6,
        help="How many recent months to seed.",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace existing transactions and budgets in the seeded date range.",
    )

    parser.add_argument(
        "--create-demo-user",
        action="store_true",
        help="Create a demo user if target user does not exist.",
    )

    parser.add_argument(
        "--demo-email",
        type=str,
        default="demo@financeai.local",
    )

    parser.add_argument(
        "--demo-username",
        type=str,
        default="demo_finance",
    )

    parser.add_argument(
        "--demo-password",
        type=str,
        default="Demo@1234",
    )

    parser.add_argument(
        "--user-id",
        type=int,
        default=1,
        help="Manual user ID to seed for (for microservices).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=20260412,
        help="Random seed base.",
    )

    return parser.parse_args()


def main():
    args = parse_args()
    months = max(1, int(args.months))
    db = SessionLocal()

    try:
        from sqlalchemy.exc import ProgrammingError
        users = []
        try:
            if args.email:
                users = db.query(User).filter(User.email == args.email).all()
            else:
                users = db.query(User).all()
        except ProgrammingError as e:
            db.rollback()  # Crucial: Reset the transaction after failure
            if "users" in str(e).lower():
                print(f"[seed] 'users' table not found (Microservices mode). Seeding for User ID: {args.user_id}")
                # Create a dummy user object with the provided ID
                from dataclasses import dataclass
                @dataclass
                class DummyUser:
                    id: int
                    email: str
                users = [DummyUser(id=args.user_id, email=args.email or "unknown@example.com")]
            else:
                raise e

        if not users and args.create_demo_user:
            # Only try to create if users table exists
            try:
                demo_email = args.email or args.demo_email
                print(f"[seed] Creating demo user: {demo_email}")
                user = ensure_user(
                    db,
                    email=demo_email,
                    username=args.demo_username,
                    password=args.demo_password,
                )
                users = [user]
            except Exception:
                print("[seed] Could not create user (likely missing table). Using default ID.")
                from dataclasses import dataclass
                @dataclass
                class DummyUser:
                    id: int
                    email: str
                users = [DummyUser(id=args.user_id, email=args.email or "unknown@example.com")]

        for user in users:
            print(f"[seed] Seeding for user: {user.email} (ID: {user.id})")
            
            # Seed transactions
            try:
                created_transactions, existing_recent, _, _, _ = seed_user_recent_transactions(
                    db=db, user=user, months=months, force=args.force, seed_base=args.seed
                )
                print(f"[seed] Created {created_transactions} transactions.")
            except Exception as e:
                db.rollback()
                print(f"[seed] Could not seed transactions: {e}")

            # Seed budgets
            try:
                categories = ensure_categories(db, user.id)
                created_budgets = ensure_many_budgets(
                    db, user_id=user.id, categories=categories,
                    start=month_start_offset(date.today(), months),
                    today=date.today(), force=args.force, rng=random.Random(args.seed)
                )
                print(f"[seed] Created {created_budgets} budgets.")
            except Exception as e:
                db.rollback()
                print(f"[seed] Could not seed budgets: {e}")

            # Seed goals
            try:
                created_goals = ensure_savings_goals(db, user_id=user.id, force=args.force, today=date.today())
                print(f"[seed] Created {created_goals} goals.")
            except Exception as e:
                db.rollback()
                print(f"[seed] Could not seed goals (table likely missing): {e}")

            # Seed savings goal plans
            try:
                created_goal_plans = ensure_savings_goal_plans(db, user_id=user.id, force=args.force, today=date.today())
                print(f"[seed] Created {created_goal_plans} goal plans.")
            except Exception as e:
                db.rollback()
                print(f"[seed] Could not seed goal plans (table likely missing): {e}")

            db.commit()
            print(f"[seed] Completed seeding for {user.email}")

    finally:
        db.close()


if __name__ == "__main__":
    main()