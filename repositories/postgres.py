from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.models import (
    Account,
    AccountState,
    AuthUser,
    FlaggedTransaction,
    SecurityLog,
    Transaction,
)


class SqlAlchemyAccountRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, account_id: int) -> Account | None:
        result = await self._session.execute(
            select(Account).where(Account.id == account_id)
        )
        return result.scalar_one_or_none()

    async def get_by_uuid(self, account_uuid: UUID) -> Account | None:
        result = await self._session.execute(
            select(Account).where(Account.uuid == account_uuid)
        )
        return result.scalar_one_or_none()

    async def get_by_user_name(self, user_name: str) -> Account | None:
        result = await self._session.execute(
            select(Account).where(Account.user_name == user_name)
        )
        return result.scalar_one_or_none()

    async def get_for_update(self, account_id: int) -> Account | None:
        result = await self._session.execute(
            select(Account).where(Account.id == account_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def create(self, account: Account) -> Account:
        self._session.add(account)
        await self._session.flush()
        return account

    async def update_balance_with_version(
        self, account_id: int, expected_version: int, delta: Decimal
    ) -> Account | None:
        return await self.update_balances_with_version(
            account_id=account_id,
            expected_version=expected_version,
            balance_delta=delta,
            reserved_delta=Decimal("0"),
        )

    async def update_balances_with_version(
        self,
        account_id: int,
        expected_version: int,
        balance_delta: Decimal,
        reserved_delta: Decimal,
    ) -> Account | None:
        stmt = (
            update(Account)
            .where(Account.id == account_id, Account.version == expected_version)
            .values(
                balance=Account.balance + balance_delta,
                reserved_balance=Account.reserved_balance + reserved_delta,
                version=Account.version + 1,
            )
            .returning(Account)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active(self, min_balance: Decimal) -> list[Account]:
        result = await self._session.execute(
            select(Account).where(
                Account.state == AccountState.ACTIVO,
                (Account.balance - func.coalesce(Account.reserved_balance, 0))
                >= min_balance,
            )
        )
        return list(result.scalars().all())


class SqlAlchemyTransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, transaction_id: int) -> Transaction | None:
        result = await self._session.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        return result.scalar_one_or_none()

    async def create(self, transaction: Transaction) -> Transaction:
        self._session.add(transaction)
        await self._session.flush()
        return transaction

    async def update_state(
        self, transaction_id: int, state: str
    ) -> Transaction | None:
        stmt = (
            update(Transaction)
            .where(Transaction.id == transaction_id)
            .values(state=state)
            .returning(Transaction)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_recent_by_account(
        self, account_id: int, since: datetime
    ) -> list[Transaction]:
        result = await self._session.execute(
            select(Transaction)
            .where(Transaction.account_id == account_id, Transaction.timestamp >= since)
            .order_by(Transaction.timestamp.desc())
        )
        return list(result.scalars().all())

    async def list_recent(
        self, limit: int, account_id: int | None = None
    ) -> list[Transaction]:
        stmt = select(Transaction).order_by(Transaction.timestamp.desc()).limit(limit)
        if account_id is not None:
            stmt = stmt.where(Transaction.account_id == account_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class SqlAlchemyFlaggedTransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, flagged_id: int) -> FlaggedTransaction | None:
        result = await self._session.execute(
            select(FlaggedTransaction).where(FlaggedTransaction.id == flagged_id)
        )
        return result.scalar_one_or_none()

    async def get_by_transaction_id(
        self, transaction_id: int
    ) -> FlaggedTransaction | None:
        result = await self._session.execute(
            select(FlaggedTransaction).where(
                FlaggedTransaction.transaction_id == transaction_id
            )
        )
        return result.scalar_one_or_none()

    async def create(self, flagged: FlaggedTransaction) -> FlaggedTransaction:
        self._session.add(flagged)
        await self._session.flush()
        return flagged

    async def update_state(
        self,
        flagged_id: int,
        state: str,
        auditor_notes: str | None,
        resolved_at: datetime | None,
    ) -> FlaggedTransaction | None:
        stmt = (
            update(FlaggedTransaction)
            .where(FlaggedTransaction.id == flagged_id)
            .values(state=state, auditor_notes=auditor_notes, resolved_at=resolved_at)
            .returning(FlaggedTransaction)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_states(self, states: list[str]) -> list[FlaggedTransaction]:
        result = await self._session.execute(
            select(FlaggedTransaction)
            .where(FlaggedTransaction.state.in_(states))
            .order_by(FlaggedTransaction.timestamp.desc())
        )
        return list(result.scalars().all())


class SqlAlchemySecurityLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, log_entry: SecurityLog) -> SecurityLog:
        self._session.add(log_entry)
        await self._session.flush()
        return log_entry


class SqlAlchemyAuthUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_username(self, username: str) -> AuthUser | None:
        result = await self._session.execute(
            select(AuthUser).where(AuthUser.username == username)
        )
        return result.scalar_one_or_none()

    async def create(self, user: AuthUser) -> AuthUser:
        self._session.add(user)
        await self._session.flush()
        return user
