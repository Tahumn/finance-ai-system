
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
        print("\n--- Recent Transactions with User ID ---")
        txs = db.execute(text("SELECT id, description, amount, date, user_id FROM transactions ORDER BY id DESC LIMIT 5")).fetchall()
        for t in txs:
            print(f"ID: {t[0]}, UserID: {t[4]}, Date: {t[3]}, Amount: {t[2]}, Desc: {t[1]}")
            
        print("\n--- Recent Bills with User ID ---")
        bills = db.execute(text("SELECT id, merchant, total_amount, user_id FROM bills ORDER BY id DESC LIMIT 5")).fetchall()
        for b in bills:
            print(f"ID: {b[0]}, UserID: {b[3]}, Merchant: {b[1]}, Total: {b[2]}")
            
        print("\n--- Current Users ---")
        users = db.execute(text("SELECT id, username, email FROM users")).fetchall()
        for u in users:
            print(f"ID: {u[0]}, Username: {u[1]}, Email: {u[2]}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
