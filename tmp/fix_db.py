import re
import unicodedata
from app.core.database import SessionLocal
from app.finance.models import Transaction, Category

def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return normalized.lower().strip()

# Các từ khóa thu nhập chắc chắn
INCOME_KEYWORDS = ["luong", "lanh", "thuong", "bonus", "lai", "hoan tien", "refund"]

def fix_historical_data():
    db = SessionLocal()
    try:
        # Tìm tất cả các giao dịch là "expense"
        txs = db.query(Transaction).filter(Transaction.transaction_type == "expense").all()
        fixed_count = 0
        
        for tx in txs:
            normalized_desc = _normalize_text(tx.description)
            
            # Kiểm tra nếu chứa từ khóa thu nhập (dùng regex word boundary)
            is_likely_income = False
            for kw in INCOME_KEYWORDS:
                if re.search(rf"\b{re.escape(kw)}\b", normalized_desc):
                    is_likely_income = True
                    break
            
            if is_likely_income:
                print(f"Fixing TX {tx.id}: '{tx.description}' ({tx.amount}) Move from expense -> income")
                tx.transaction_type = "income"
                fixed_count += 1
                
                # Bonus: Nếu là lương, thử gán danh mục "Salary" hoặc "Lương"
                if "luong" in normalized_desc:
                    # Tìm danh mục Lương của user đó
                    cat = db.query(Category).filter(
                        Category.user_id == tx.user_id,
                        Category.name.ilike("%lương%")
                    ).first()
                    if cat:
                        tx.category_id = cat.id
        
        db.commit()
        print(f"Successfully fixed {fixed_count} transactions.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_historical_data()
