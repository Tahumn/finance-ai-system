from app.finance.models import Transaction, Category
from app.core.database import SessionLocal
import datetime

db = SessionLocal()
txs = db.query(Transaction).all()
print(f"Total transactions: {len(txs)}")
for t in txs:
    print(f"ID: {t.id}, Date: {t.date}, Desc: '{t.description}', Amount: {t.amount}, Type: {t.transaction_type}")

cats = db.query(Category).all()
print(f"Total categories: {len(cats)}")
for c in cats:
    print(f"ID: {c.id}, Name: '{c.name}'")

db.close()
