from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.auth.email import send_notification_email
from app.auth.models import User
from app.auth.service import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationEmailRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=4000)


@router.post("/email", status_code=status.HTTP_200_OK)
def send_email(
    payload: NotificationEmailRequest, current_user: User = Depends(get_current_user)
):
    send_notification_email(
        to_email=current_user.email, subject=payload.subject, message=payload.message
    )
    return {"status": "sent"}
