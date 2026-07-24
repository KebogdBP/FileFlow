import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.accounts.models import Account, AccountPlan, AccountSession, DeveloperApiKey
from fileflow_api.config import Settings
from fileflow_api.jobs.models import Job


def _password_hash(password: str, salt: bytes | None = None) -> str:
    actual_salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=actual_salt, n=2**14, r=8, p=1)
    return f"scrypt${actual_salt.hex()}${digest.hex()}"


def _password_matches(password: str, encoded: str) -> bool:
    try:
        algorithm, salt_hex, expected = encoded.split("$", 2)
        if algorithm != "scrypt":
            return False
        actual = _password_hash(password, bytes.fromhex(salt_hex)).rsplit("$", 1)[1]
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AccountService:
    def __init__(self, sessions: sessionmaker[Session], settings: Settings) -> None:
        self._sessions = sessions
        self._settings = settings

    def register(
        self, email: str, password: str, display_name: str
    ) -> tuple[Account, str, datetime]:
        account = Account(
            id=uuid4().hex,
            email=email.strip().lower(),
            display_name=" ".join(display_name.split()),
            password_hash=_password_hash(password),
            plan=AccountPlan.FREE,
            created_at=datetime.now(UTC),
        )
        try:
            with self._sessions.begin() as session:
                session.add(account)
        except IntegrityError:
            raise HTTPException(
                status_code=409, detail="An account already uses this email."
            ) from None
        token, expires_at = self._create_session(account.id)
        return account, token, expires_at

    def login(self, email: str, password: str) -> tuple[Account, str, datetime]:
        with self._sessions() as session:
            account = session.scalar(select(Account).where(Account.email == email.strip().lower()))
            if account is None or not _password_matches(password, account.password_hash):
                raise HTTPException(status_code=401, detail="Email or password is incorrect.")
            session.expunge(account)
        token, expires_at = self._create_session(account.id)
        return account, token, expires_at

    def authenticate(self, token: str) -> Account:
        now = datetime.now(UTC)
        with self._sessions.begin() as session:
            if token.startswith("ff_live_"):
                api_key = session.scalar(
                    select(DeveloperApiKey).where(
                        DeveloperApiKey.token_hash == _token_hash(token),
                        DeveloperApiKey.revoked_at.is_(None),
                    )
                )
                if api_key is not None:
                    api_key.last_used_at = now
                    account = session.get(Account, api_key.account_id)
                    if account is not None:
                        session.expunge(account)
                        return account
            account = session.scalar(
                select(Account)
                .join(AccountSession, AccountSession.account_id == Account.id)
                .where(
                    AccountSession.token_hash == _token_hash(token),
                    AccountSession.expires_at > now,
                )
            )
            if account is None:
                raise HTTPException(status_code=401, detail="Authentication is required.")
            session.expunge(account)
            return account

    def create_api_key(self, account_id: str, name: str) -> tuple[DeveloperApiKey, str]:
        token = f"ff_live_{secrets.token_urlsafe(32)}"
        api_key = DeveloperApiKey(
            id=uuid4().hex,
            account_id=account_id,
            name=name.strip(),
            prefix=token[:16],
            token_hash=_token_hash(token),
            created_at=datetime.now(UTC),
            last_used_at=None,
            revoked_at=None,
        )
        with self._sessions.begin() as session:
            session.add(api_key)
        return api_key, token

    def api_keys(self, account_id: str) -> list[DeveloperApiKey]:
        with self._sessions() as session:
            keys = list(
                session.scalars(
                    select(DeveloperApiKey)
                    .where(
                        DeveloperApiKey.account_id == account_id,
                        DeveloperApiKey.revoked_at.is_(None),
                    )
                    .order_by(DeveloperApiKey.created_at.desc())
                )
            )
            for api_key in keys:
                session.expunge(api_key)
            return keys

    def revoke_api_key(self, account_id: str, key_id: str) -> None:
        with self._sessions.begin() as session:
            api_key = session.scalar(
                select(DeveloperApiKey).where(
                    DeveloperApiKey.id == key_id,
                    DeveloperApiKey.account_id == account_id,
                    DeveloperApiKey.revoked_at.is_(None),
                )
            )
            if api_key is None:
                raise HTTPException(status_code=404, detail="API key was not found.")
            api_key.revoked_at = datetime.now(UTC)

    def logout(self, token: str) -> None:
        with self._sessions.begin() as session:
            session.execute(
                delete(AccountSession).where(AccountSession.token_hash == _token_hash(token))
            )

    def history(self, account_id: str, limit: int, offset: int) -> list[Job]:
        with self._sessions() as session:
            jobs = list(
                session.scalars(
                    select(Job)
                    .where(Job.account_id == account_id)
                    .order_by(Job.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
            )
            for job in jobs:
                session.expunge(job)
            return jobs

    def usage(self, account_id: str) -> tuple[int, datetime]:
        now = datetime.now(UTC)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        with self._sessions() as session:
            used = session.scalar(
                select(func.count())
                .select_from(Job)
                .where(Job.account_id == account_id, Job.created_at >= start)
            )
        return int(used or 0), start + timedelta(days=1)

    def require_available_job(self, account_id: str) -> None:
        used, resets_at = self.usage(account_id)
        if used >= self._settings.free_daily_cloud_jobs:
            raise HTTPException(
                status_code=429,
                detail=f"Daily cloud job limit reached; quota resets at {resets_at.isoformat()}.",
            )

    def _create_session(self, account_id: str) -> tuple[str, datetime]:
        token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=self._settings.account_session_ttl_seconds)
        with self._sessions.begin() as session:
            session.add(
                AccountSession(
                    id=uuid4().hex,
                    account_id=account_id,
                    token_hash=_token_hash(token),
                    created_at=now,
                    expires_at=expires_at,
                )
            )
        return token, expires_at
