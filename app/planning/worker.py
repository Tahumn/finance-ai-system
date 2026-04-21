import logging
from typing import Dict, Any
from app.database import SessionLocal
from app.planning.models import Budget

logger = logging.getLogger(__name__)

async def handle_finance_event(message: Dict[str, Any]):
    event_type = message.get("event_type")
    
    if event_type in ["transaction.created", "transaction.deleted"]:
        user_id = message.get("user_id")
        category_id = message.get("category_id")
        
        if not user_id or not category_id:
            return

        # Simple logic: If a transaction happens, we might want to check the budget.
        # In a real system, we might maintain a "spent" column in the Budget table
        # and update it here based on transaction.created and transaction.deleted.
        # Since our Budget table only has 'amount' (the target), we just log the event.
        
        logger.info(f"Planning Service received {event_type} for user {user_id}, category {category_id}")
        
        with SessionLocal() as db:
            budget = db.query(Budget).filter(Budget.user_id == user_id, Budget.category_id == category_id).first()
            if budget:
                logger.info(f"Found active budget for this category: Target Amount {budget.amount}")
                # You can add logic here to send an alert if spent > budget.amount
            else:
                logger.debug("No budget found for this category.")
