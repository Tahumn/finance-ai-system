import sys
import os
from datetime import datetime, timedelta

# Add parent dir to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.finance.models import Transaction
from app.auth.models import User

def trigger_anomaly(email: str):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User {email} not found.")
            return

        print(f"Cleaning recent transactions for {email}...")
        # Optional: delete recent txs to have a clean baseline
        # db.query(Transaction).filter(Transaction.user_id == user.id).delete()
        
        today = datetime.now().date()
        
        print("Inserting baseline transactions (low spending)...")
        # 10 days of normal spending (~30k/day)
        for i in range(1, 11):
            date = today - timedelta(days=i)
            tx = Transaction(
                user_id=user.id,
                description=f"Ăn trưa ngày -{i}",
                amount=30000.0,
                transaction_type="expense",
                date=date,
                category_id=None # Or a valid category ID if you have one
            )
            db.add(tx)
        
        print("Inserting ANOMALY transaction (high spending)...")
        # One day of very high spending (5M)
        tx_anomaly = Transaction(
            user_id=user.id,
            description="Mua điện thoại mới (Bất thường)",
            amount=5000000.0,
            transaction_type="expense",
            date=today,
            category_id=None
        )
        db.add(tx_anomaly)
        
        db.commit()
        print("\nSuccess! Anomaly triggered.")
        print(f"Scenario: 10 days of 30,000đ vs 1 day of 5,000,000đ.")
        print("Now refresh your Dashboard to see the AI Alert.")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scratch/trigger_anomaly.py <user_email>")
    else:
        trigger_anomaly(sys.argv[1])
