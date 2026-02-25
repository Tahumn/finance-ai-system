import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_otp_email(*, to_email: str, code: str) -> None:
    if not settings.smtp_user or not settings.smtp_password:
        raise RuntimeError("SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in .env.")

    msg = EmailMessage()
    msg["Subject"] = "Your Finance AI OTP code"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email
    msg.set_content(
        "\n".join(
            [
                "Your OTP code:",
                code,
                "",
                f"This code expires in {settings.otp_expire_minutes} minutes.",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

    with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)

