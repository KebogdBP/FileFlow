import smtplib
from email.message import EmailMessage
from typing import Protocol

from fileflow_api.config import Settings


class PasswordResetMailer(Protocol):
    def send_password_reset(self, email: str, reset_url: str) -> None: ...


class SmtpPasswordResetMailer:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send_password_reset(self, email: str, reset_url: str) -> None:
        if not self._settings.smtp_host:
            return
        message = EmailMessage()
        message["Subject"] = "Reset your FileFlow password"
        message["From"] = self._settings.smtp_from_email
        message["To"] = email
        message.set_content(
            "A password reset was requested for your FileFlow account.\n\n"
            f"Open this link to choose a new password:\n{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        )
        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port, timeout=15) as smtp:
            if self._settings.smtp_use_tls:
                smtp.starttls()
            if self._settings.smtp_username and self._settings.smtp_password:
                smtp.login(self._settings.smtp_username, self._settings.smtp_password)
            smtp.send_message(message)
