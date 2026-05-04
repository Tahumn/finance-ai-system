
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DB_URL", "postgresql://finance_user:finance_pass@localhost:5432/finance_db")
if "postgres:5432" in DB_URL:
    DB_URL = DB_URL.replace("postgres:5432", "localhost:5432")

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check():
    db = SessionLocal()
    try:
        print("\n--- Recent Bills ---")
        bills = db.execute(text("SELECT id, merchant, total_amount, image_path FROM bills ORDER BY id DESC LIMIT 5")).fetchall()
        for b in bills:
            print(f"ID: {b[0]}, Merchant: {b[1]}, Total: {b[2]}, Path: {b[3]}")

        print("\n--- Recent Transactions ---")
        txs = db.execute(text("SELECT id, description, amount, image_path FROM transactions ORDER BY id DESC LIMIT 5")).fetchall()
        for t in txs:
            print(f"ID: {t[0]}, Desc: {t[1]}, Amount: {t[2]}, Path: {t[3]}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
