from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from rq import Retry

from app.core.auth_context import RequestUser, get_request_user
from app.queue import get_queue
from app.notifications.tasks import send_notification_email_job

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationEmailRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=4000)


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
def send_email(
    payload: NotificationEmailRequest, current_user: RequestUser = Depends(get_request_user)
):
    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is missing in token",
        )
    try:
        queue = get_queue("notifications")
        job = queue.enqueue(
            send_notification_email_job,
            kwargs={
                "to_email": current_user.email,
                "subject": payload.subject,
                "message": payload.message,
            },
            retry=Retry(max=3, interval=[10, 30, 60]),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Notification queue is unavailable: {exc}",
        ) from exc
    return {"status": "queued", "job_id": job.id}
