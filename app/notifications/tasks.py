from __future__ import annotations

from app.auth.email import send_notification_email


def send_notification_email_job(*, to_email: str, subject: str, message: str) -> None:
    send_notification_email(to_email=to_email, subject=subject, message=message)

