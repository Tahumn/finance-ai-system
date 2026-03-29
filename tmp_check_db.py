import sys
import os

# Add the project root to sys.path so we can import app modules
sys.path.append(os.getcwd())

try:
    from app.core.database import SessionLocal
    from app.finance.models import Transaction, Category
    from sqlalchemy import func

    db = SessionLocal()
    
    # Get all transactions
    txs = db.query(Transaction).all()
    print(f"DEBUG: Total transactions found: {len(txs)}")
    
    for tx in txs:
        print(f"TX: id={tx.id}, type={tx.transaction_type}, amount={tx.amount}, desc='{tx.description}', date={tx.date}")
    
    # Calculate sum to check dashboard numbers
    income_sum = db.query(func.sum(Transaction.amount)).filter(Transaction.transaction_type == 'income').scalar() or 0
    expense_sum = db.query(func.sum(Transaction.amount)).filter(Transaction.transaction_type == 'expense').scalar() or 0
    
    print(f"DEBUG: Income Sum: {income_sum}")
    print(f"DEBUG: Expense Sum: {expense_sum}")
    
    db.close()
except Exception as e:
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
