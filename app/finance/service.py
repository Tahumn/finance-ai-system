from app.finance import schemas

_transactions = []
_budgets = []


def add_transaction(tx: schemas.TransactionCreate):
    _transactions.append(tx)
    return {"id": len(_transactions), **tx.model_dump()}


def list_transactions():
    return _transactions


def add_budget(budget: schemas.BudgetCreate):
    _budgets.append(budget)
    return {"id": len(_budgets), **budget.model_dump()}


def summarize_budget():
    return [
        {
            "category": b.category,
            "limit": b.limit,
            "spent": 0.0,
        }
        for b in _budgets
    ]

