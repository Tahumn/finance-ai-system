"""
Script để migrate tags trong database:
- Xóa tất cả tags cũ (danh mục)
- Tạo 2 tags mới: Tiền mặt và Ngân hàng cho từng user
- Gán ngẫu nhiên tag Tiền mặt/Ngân hàng cho các giao dịch chưa có tag
"""
from __future__ import annotations

import random
import argparse
from sqlalchemy import text

from app.auth.models import User
from app.database import SessionLocal
from app.finance.models import Tag, Transaction, transaction_tags


PAYMENT_TAGS = [
    ("Tiền mặt", "#22c55e"),
    ("Ngân hàng", "#3b82f6"),
]

OLD_TAG_NAMES = [
    "Ăn uống", "Di chuyển", "Mua sắm", "Hóa đơn", "Giải trí",
    "Sức khỏe", "Gia đình", "Công việc", "Định kỳ", "Du lịch",
    "Công nghệ", "Tiết kiệm",
]


def migrate_tags_for_user(db, user: User, rng: random.Random, dry_run: bool = False) -> dict:
    result = {"deleted": 0, "created": 0, "tagged": 0}

    # 1. Xóa các tags cũ (không phải Tiền mặt/Ngân hàng)
    old_tags = (
        db.query(Tag)
        .filter(Tag.user_id == user.id, Tag.name.notin_(["Tiền mặt", "Ngân hàng"]))
        .all()
    )

    for tag in old_tags:
        print(f"  [DELETE tag] {tag.name} (id={tag.id})")
        result["deleted"] += 1
        if not dry_run:
            db.delete(tag)

    if not dry_run:
        db.flush()

    # 2. Tạo/cập nhật tags Tiền mặt & Ngân hàng
    payment_tag_objs = {}
    for name, color in PAYMENT_TAGS:
        existing = db.query(Tag).filter(Tag.user_id == user.id, Tag.name == name).first()
        if existing:
            print(f"  [KEEP tag] {name} (id={existing.id})")
            payment_tag_objs[name] = existing
        else:
            print(f"  [CREATE tag] {name}")
            result["created"] += 1
            if not dry_run:
                new_tag = Tag(name=name, color=color, user_id=user.id)
                db.add(new_tag)
                db.flush()
                payment_tag_objs[name] = new_tag

    if dry_run:
        return result

    # 3. Gán tag thanh toán cho giao dịch chưa có Tiền mặt/Ngân hàng
    if not payment_tag_objs:
        return result

    cash_tag = payment_tag_objs.get("Tiền mặt")
    bank_tag = payment_tag_objs.get("Ngân hàng")

    # Lấy transaction_ids đã có Tiền mặt hoặc Ngân hàng
    has_pay_tag_ids = set()
    if cash_tag:
        rows = db.execute(
            text("SELECT transaction_id FROM transaction_tags WHERE tag_id = :tid"),
            {"tid": cash_tag.id}
        ).fetchall()
        has_pay_tag_ids.update(r[0] for r in rows)
    if bank_tag:
        rows = db.execute(
            text("SELECT transaction_id FROM transaction_tags WHERE tag_id = :tid"),
            {"tid": bank_tag.id}
        ).fetchall()
        has_pay_tag_ids.update(r[0] for r in rows)

    # Giao dịch chưa có tag thanh toán
    all_txs = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    untagged = [tx for tx in all_txs if tx.id not in has_pay_tag_ids]

    print(f"  Gán tag thanh toán cho {len(untagged)} giao dịch chưa có tag...")

    for tx in untagged:
        # Thu nhập -> Ngân hàng nhiều hơn; Chi tiêu -> ngẫu nhiên 60/40
        if tx.transaction_type == "income":
            chosen = bank_tag if rng.random() < 0.8 else cash_tag
        else:
            chosen = cash_tag if rng.random() < 0.6 else bank_tag

        if chosen:
            db.execute(
                text("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (:txid, :tagid) ON CONFLICT DO NOTHING"),
                {"txid": tx.id, "tagid": chosen.id}
            )
            result["tagged"] += 1

    return result


def main():
    parser = argparse.ArgumentParser(description="Migrate tags sang Tiền mặt / Ngân hàng")
    parser.add_argument("--email", type=str, default=None, help="Chỉ migrate user này")
    parser.add_argument("--dry-run", action="store_true", help="Thử nghiệm, không commit")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    db = SessionLocal()

    try:
        if args.email:
            users = db.query(User).filter(User.email == args.email).all()
        else:
            users = db.query(User).all()

        if not users:
            print("[migrate] Không tìm thấy user nào.")
            return

        for user in users:
            print(f"\n[migrate] User: {user.email}")
            result = migrate_tags_for_user(db, user, rng, dry_run=args.dry_run)
            print(f"  Tổng kết: xóa {result['deleted']} tag, tạo {result['created']} tag, gán {result['tagged']} giao dịch")

        if args.dry_run:
            print("\n[dry-run] Không commit. Chạy lại không có --dry-run để áp dụng.")
            db.rollback()
        else:
            db.commit()
            print("\n[migrate] Hoàn tất!")

    except Exception as e:
        db.rollback()
        print(f"[migrate] Lỗi: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
