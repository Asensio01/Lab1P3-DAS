from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from infrastructure.models import Account, AuthUser, FlaggedTransaction, SecurityLog, Transaction


class AccountRepository(Protocol):
    async def get_by_id(self, account_id: int) -> Account | None: ...

    async def get_by_uuid(self, account_uuid: UUID) -> Account | None: ...

    async def get_by_user_name(self, user_name: str) -> Account | None: ...

    async def get_for_update(self, account_id: int) -> Account | None: ...

    async def create(self, account: Account) -> Account: ...

    async def update_balance_with_version(
        self, account_id: int, expected_version: int, delta: Decimal
    ) -> Account | None: ...

    async def list_active(self, min_balance: Decimal) -> list[Account]: ...


class TransactionRepository(Protocol):
    async def get_by_id(self, transaction_id: int) -> Transaction | None: ...

    async def create(self, transaction: Transaction) -> Transaction: ...

    async def list_recent_by_account(
        self, account_id: int, since: datetime
    ) -> list[Transaction]: ...

    async def list_recent(
        self, limit: int, account_id: int | None = None
    ) -> list[Transaction]: ...


class FlaggedTransactionRepository(Protocol):
    async def get_by_transaction_id(
        self, transaction_id: int
    ) -> FlaggedTransaction | None: ...

    async def create(self, flagged: FlaggedTransaction) -> FlaggedTransaction: ...

    async def update_state(
        self,
        flagged_id: int,
        state: str,
        auditor_notes: str | None,
        resolved_at: datetime | None,
    ) -> FlaggedTransaction | None: ...

    async def list_by_states(self, states: list[str]) -> list[FlaggedTransaction]: ...


class SecurityLogRepository(Protocol):
    async def create(self, log_entry: SecurityLog) -> SecurityLog: ...


class AuthUserRepository(Protocol):
    async def get_by_username(self, username: str) -> AuthUser | None: ...

    async def create(self, user: AuthUser) -> AuthUser: ...


class RedisFraudRepository(Protocol):
    async def record_and_count(
        self, account_id: int, timestamp_ms: int, window_seconds: int
    ) -> int: ...

    async def record_and_count_ip(
        self, ip: str, timestamp_ms: int, window_seconds: int
    ) -> int: ...
