
from sqlalchemy.orm import sessionmaker
from app.finance.models import Bill, Transaction
from app.database import SessionLocal

db = SessionLocal()

print("--- Recent Bills ---")
bills = db.query(Bill).order_by(Bill.id.desc()).limit(5).all()
for b in bills:
    print(f"ID: {b.id}, Merchant: {b.merchant}, Total: {b.total_amount}, Conf: {b.ocr_confidence}, User: {b.user_id}")

print("\n--- Recent Transactions ---")
txs = db.query(Transaction).order_by(Transaction.id.desc()).limit(5).all()
for t in txs:
    print(f"ID: {t.id}, Desc: {t.description}, Amount: {t.amount}, Conf: {getattr(t, 'ocr_confidence', 'N/A')}, User: {t.user_id}")

db.close()
