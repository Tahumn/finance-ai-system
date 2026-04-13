from __future__ import annotations

import argparse
import random
from datetime import date, timedelta

from sqlalchemy import func

from app.auth.models import User
from app.auth.security import hash_password
from app.database import SessionLocal
from app.finance.models import Account, Category, Tag, Transaction


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

TAG_DEFS = [
    ("Ăn uống", "#ff8a65"),
    ("Di chuyển", "#42a5f5"),
    ("Mua sắm", "#7e57c2"),
    ("Hóa đơn", "#ef5350"),
    ("Giải trí", "#ab47bc"),
    ("Sức khỏe", "#26a69a"),
    ("Gia đình", "#8d6e63"),
    ("Công việc", "#5c6bc0"),
    ("Định kỳ", "#ffa726"),
    ("Du lịch", "#26c6da"),
    ("Công nghệ", "#78909c"),
    ("Tiết kiệm", "#66bb6a"),
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
    return date(year, month, min(day, month_end(date(year, month, 1)).day))


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
    names = [name for name, _ in TAG_DEFS]
    existing = (
        db.query(Tag)
        .filter(Tag.user_id == user_id, Tag.name.in_(names))
        .all()
    )
    by_name = {item.name: item for item in existing}
    for name, color in TAG_DEFS:
        if name in by_name:
            continue
        item = Tag(name=name, color=color, user_id=user_id)
        db.add(item)
        db.flush()
        by_name[name] = item
    return by_name


def ensure_account(db, user_id: int):
    account = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.name == "Ví chính")
        .first()
    )
    if account:
        return account
    account = Account(
        user_id=user_id,
        name="Ví chính",
        currency="VND",
        opening_balance=15_000_000,
    )
    db.add(account)
    db.flush()
    return account


def random_date_in_month(
    rng: random.Random,
    start: date,
    end: date,
    min_day: int = 1,
    max_day: int = 28,
):
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


def seed_user_recent_transactions(db, user: User, months: int, force: bool, seed_base: int) -> tuple[int, int]:
    today = date.today()
    start = month_start_offset(today, months)
    rng = random.Random(seed_base + (user.id * 97))

    existing_recent = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.user_id == user.id, Transaction.date >= start, Transaction.date <= today)
        .scalar()
        or 0
    )

    if existing_recent and not force:
        return 0, existing_recent

    if force and existing_recent:
        (
            db.query(Transaction)
            .filter(Transaction.user_id == user.id, Transaction.date >= start, Transaction.date <= today)
            .delete(synchronize_session=False)
        )
        db.flush()

    categories = ensure_categories(db, user.id)
    tags = ensure_tags(db, user.id)
    account = ensure_account(db, user.id)

    rows: list[Transaction] = []

    for month in iter_month_starts(start, today):
        end_m = min(month_end(month), today)

        # Lương cố định
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
                tags=[tags["Công việc"]],
            )

        # Thưởng
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
                tags=[tags["Công việc"]],
            )

        # Freelance nhiều hơn
        for _ in range(rng.randint(2, 5)):
            freelance_date = random_date_in_month(rng, month, end_m, min_day=5, max_day=27)
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Freelance"],
                account=account,
                description=income_description("Freelance", rng),
                amount=float(rng.randrange(700_000, 8_500_000, 50_000)),
                tx_type="income",
                tx_date=freelance_date,
                tags=[tags["Công việc"]],
            )

        # Đầu tư nhiều hơn
        for _ in range(rng.randint(4, 8)):
            invest_date = random_date_in_month(rng, month, end_m, min_day=7, max_day=28)
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Đầu tư"],
                account=account,
                description=income_description("Đầu tư", rng),
                amount=float(rng.randrange(200_000, 2_500_000, 50_000)),
                tx_type="income",
                tx_date=invest_date,
                tags=[tags["Định kỳ"], tags["Tiết kiệm"]],
            )

        # Hoàn tiền
        for _ in range(rng.randint(1, 3)):
            cashback_date = random_date_in_month(rng, month, end_m, min_day=10, max_day=28)
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Hoàn tiền"],
                account=account,
                description=income_description("Hoàn tiền", rng),
                amount=float(rng.randrange(50_000, 500_000, 10_000)),
                tx_type="income",
                tx_date=cashback_date,
                tags=[tags["Định kỳ"]],
            )

        # Thu nhập khác thỉnh thoảng có
        if rng.random() < 0.55:
            extra_income_date = random_date_in_month(rng, month, end_m, min_day=12, max_day=28)
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Thu nhập khác"],
                account=account,
                description=income_description("Thu nhập khác", rng),
                amount=float(rng.randrange(200_000, 3_000_000, 50_000)),
                tx_type="income",
                tx_date=extra_income_date,
                tags=[tags["Gia đình"]],
            )

        # Các khoản chi cố định
        recurring_expenses = [
            ("Nhà cửa", "Thanh toán tiền nhà", rng.randrange(3_000_000, 6_500_000, 100_000), 1, [tags["Gia đình"], tags["Định kỳ"]]),
            ("Hóa đơn", "Thanh toán điện/nước/internet", rng.randrange(1_200_000, 3_400_000, 50_000), 12, [tags["Hóa đơn"], tags["Định kỳ"]]),
            ("Hóa đơn", "Nạp tiền điện thoại", rng.randrange(100_000, 300_000, 10_000), 10, [tags["Hóa đơn"], tags["Định kỳ"]]),
            ("Sức khỏe", "Thanh toán phí gym", rng.randrange(250_000, 800_000, 10_000), 8, [tags["Sức khỏe"], tags["Định kỳ"]]),
            ("Công nghệ", "Thanh toán phần mềm/lưu trữ", rng.randrange(80_000, 600_000, 10_000), 20, [tags["Công nghệ"], tags["Định kỳ"]]),
        ]

        for category_name, desc, amount, day, tx_tags in recurring_expenses:
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
                    tags=tx_tags,
                )

        # Mỗi 2-3 tháng có chuyến đi/chi tiêu lớn
        if rng.random() < 0.45:
            travel_date = random_date_in_month(rng, month, end_m, min_day=18, max_day=28)
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Du lịch"],
                account=account,
                description=expense_description("Du lịch", rng),
                amount=float(rng.randrange(800_000, 4_500_000, 50_000)),
                tx_type="expense",
                tx_date=travel_date,
                tags=[tags["Du lịch"], tags["Gia đình"]],
            )

        # Mua sắm công nghệ thỉnh thoảng
        if rng.random() < 0.35:
            tech_date = random_date_in_month(rng, month, end_m, min_day=8, max_day=25)
            add_transaction(
                rows,
                user_id=user.id,
                category=categories["Công nghệ"],
                account=account,
                description=expense_description("Công nghệ", rng),
                amount=float(rng.randrange(300_000, 3_500_000, 50_000)),
                tx_type="expense",
                tx_date=tech_date,
                tags=[tags["Công nghệ"]],
            )

    current = start
    while current <= today:
        # tăng xác suất có chi tiêu mỗi ngày
        base_rate = 0.82 if current.weekday() < 5 else 0.92

        if rng.random() < base_rate:
            # tăng số lượng giao dịch/ngày
            expense_count = rng.randint(2, 4) if current.weekday() < 5 else rng.randint(2, 5)

            for _ in range(expense_count):
                category_name = rng.choices(
                    population=EXPENSE_CATEGORIES,
                    weights=[26, 17, 12, 6, 11, 7, 9, 5, 3, 4],
                    k=1,
                )[0]

                tx_tags: list[Tag] = []
                if category_name in tags:
                    tx_tags.append(tags[category_name])

                if category_name in ("Ăn uống", "Di chuyển", "Hóa đơn"):
                    tx_tags.append(tags["Định kỳ"])

                if current.weekday() >= 5 and category_name in ("Giải trí", "Ăn uống", "Mua sắm", "Du lịch"):
                    tx_tags.append(tags["Gia đình"])

                if category_name == "Sức khỏe":
                    tx_tags.append(tags["Sức khỏe"])

                if category_name == "Công nghệ":
                    tx_tags.append(tags["Công nghệ"])

                add_transaction(
                    rows,
                    user_id=user.id,
                    category=categories[category_name],
                    account=account,
                    description=expense_description(category_name, rng),
                    amount=amount_for_expense(category_name, rng),
                    tx_type="expense",
                    tx_date=current,
                    tags=tx_tags[:2],
                )

        current += timedelta(days=1)

    db.add_all(rows)
    db.commit()
    return len(rows), existing_recent


def parse_args():
    parser = argparse.ArgumentParser(
        description="Seed finance transactions for the last N months."
    )
    parser.add_argument("--email", type=str, default=None, help="Seed only this user email.")
    parser.add_argument("--months", type=int, default=6, help="How many recent months to seed.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace existing transactions in the seeded date range.",
    )
    parser.add_argument(
        "--create-demo-user",
        action="store_true",
        help="Create a demo user if target user does not exist.",
    )
    parser.add_argument("--demo-email", type=str, default="demo@financeai.local")
    parser.add_argument("--demo-username", type=str, default="demo_finance")
    parser.add_argument("--demo-password", type=str, default="Demo@1234")
    parser.add_argument("--seed", type=int, default=20260412, help="Random seed base.")
    return parser.parse_args()


def main():
    args = parse_args()
    months = max(1, int(args.months))
    db = SessionLocal()
    try:
        if args.email:
            users = db.query(User).filter(User.email == args.email).all()
        else:
            users = db.query(User).all()

        if not users and args.create_demo_user:
            demo_email = args.email or args.demo_email
            user = ensure_user(
                db,
                email=demo_email,
                username=args.demo_username,
                password=args.demo_password,
            )
            users = [user]
            print(f"[seed] Created demo user: {user.email}")
            print(f"[seed] Demo password: {args.demo_password}")

        if not users:
            print("[seed] No user found. Use --email or --create-demo-user.")
            return

        for user in users:
            created, existing_recent = seed_user_recent_transactions(
                db=db,
                user=user,
                months=months,
                force=args.force,
                seed_base=args.seed,
            )
            if created == 0 and existing_recent > 0 and not args.force:
                print(
                    f"[seed] Skip {user.email}: already has {existing_recent} transaction(s) in last {months} month(s). "
                    "Run again with --force to replace."
                )
            else:
                print(f"[seed] User {user.email}: created {created} transaction(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
