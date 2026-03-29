import sys
import os

# Add project root to sys.path
sys.path.append(os.getcwd())

from app.core.database import SessionLocal
from app.finance.models import Transaction
from sqlalchemy import and_, or_

def cleanup():
    db = SessionLocal()
    try:
        # Tìm các giao dịch có số tiền 13,000,000
        # Chúng ta nghi ngờ có 1 bản ghi expense và 1 bản ghi income cho cùng 1 việc "lãnh lương"
        target_amount = 13000000
        
        # Lấy tất cả giao dịch 13M
        txs = db.query(Transaction).filter(Transaction.amount == target_amount).all()
        
        users_with_13m = set(tx.user_id for tx in txs)
        
        deleted_count = 0
        for user_id in users_with_13m:
            user_txs = [tx for tx in txs if tx.user_id == user_id]
            
            incomes = [tx for tx in user_txs if tx.transaction_type == 'income']
            expenses = [tx for tx in user_txs if tx.transaction_type == 'expense']
            
            if incomes and expenses:
                print(f"User {user_id} has both income and expense of {target_amount}")
                # Nếu có cả hai, khả năng cao bản ghi expense là sai (đặc biệt nếu desc liên quan đến lương)
                for exp in expenses:
                    desc_norm = (exp.description or "").lower()
                    if "luong" in desc_norm or "lanh" in desc_norm or "thuong" in desc_norm:
                        print(f"Deleting duplicate expense: ID {exp.id}, Desc: '{exp.description}'")
                        db.delete(exp)
                        deleted_count += 1
        
        db.commit()
        print(f"Finished. Deleted {deleted_count} duplicate transactions.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
 Broadway
