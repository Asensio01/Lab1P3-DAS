from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database import get_async_session, redis_client
from repositories.postgres import (
    SqlAlchemyAccountRepository,
    SqlAlchemyAuthUserRepository,
    SqlAlchemyFlaggedTransactionRepository,
    SqlAlchemySecurityLogRepository,
    SqlAlchemyTransactionRepository,
)
from repositories.redis import RedisFraudStore
from services.antifraud import AntifraudService, IpBurstRuleConfig
from core.config import settings
from services.accounts import AccountService
from services.audit import AuditService
from services.transactions import TransactionService
from services.security import SecurityLogService
from services.notifications import NotificationService, notification_hub


@dataclass
class TransactionServiceContext:
    service: TransactionService
    session: AsyncSession


@dataclass
class AuditServiceContext:
    service: AuditService
    session: AsyncSession


@dataclass
class AccountServiceContext:
    service: AccountService
    session: AsyncSession


@dataclass
class SecurityLogContext:
    service: SecurityLogService
    session: AsyncSession


@dataclass
class AuthUserContext:
    repo: SqlAlchemyAuthUserRepository
    session: AsyncSession


async def get_transaction_service(
    session: AsyncSession = Depends(get_async_session),
) -> TransactionServiceContext:
    account_repo = SqlAlchemyAccountRepository(session)
    transaction_repo = SqlAlchemyTransactionRepository(session)
    flagged_repo = SqlAlchemyFlaggedTransactionRepository(session)
    antifraud = AntifraudService(
        RedisFraudStore(redis_client),
        ip_rule=IpBurstRuleConfig(
            window_seconds=settings.ip_burst_window_seconds,
            max_allowed=settings.ip_burst_max,
        ),
    )
    notifier = NotificationService(notification_hub)
    service = TransactionService(
        account_repo=account_repo,
        transaction_repo=transaction_repo,
        flagged_repo=flagged_repo,
        antifraud=antifraud,
        notifier=notifier,
    )
    return TransactionServiceContext(service=service, session=session)


async def get_audit_service(
    session: AsyncSession = Depends(get_async_session),
) -> AuditServiceContext:
    flagged_repo = SqlAlchemyFlaggedTransactionRepository(session)
    service = AuditService(flagged_repo)
    return AuditServiceContext(service=service, session=session)


async def get_account_repo(
    session: AsyncSession = Depends(get_async_session),
) -> SqlAlchemyAccountRepository:
    return SqlAlchemyAccountRepository(session)


async def get_account_service(
    session: AsyncSession = Depends(get_async_session),
) -> AccountServiceContext:
    account_repo = SqlAlchemyAccountRepository(session)
    service = AccountService(account_repo)
    return AccountServiceContext(service=service, session=session)


async def get_security_log_service(
    session: AsyncSession = Depends(get_async_session),
) -> SecurityLogContext:
    repo = SqlAlchemySecurityLogRepository(session)
    service = SecurityLogService(repo)
    return SecurityLogContext(service=service, session=session)


async def get_auth_user_repo(
    session: AsyncSession = Depends(get_async_session),
) -> AuthUserContext:
    repo = SqlAlchemyAuthUserRepository(session)
    return AuthUserContext(repo=repo, session=session)
