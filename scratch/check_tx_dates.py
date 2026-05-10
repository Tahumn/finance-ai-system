
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
        print("\n--- Recent Transactions with Dates ---")
        txs = db.execute(text("SELECT id, description, amount, date FROM transactions ORDER BY id DESC LIMIT 10")).fetchall()
        for t in txs:
            print(f"ID: {t[0]}, Date: {t[3]}, Amount: {t[2]}, Desc: {t[1]}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
