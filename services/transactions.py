from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from infrastructure.models import (
    AccountState,
    AuditState,
    FlaggedTransaction,
    Transaction,
    TransactionState,
)
from repositories.interfaces import (
    AccountRepository,
    FlaggedTransactionRepository,
    TransactionRepository,
)
from services.antifraud import AntifraudService
from services.exceptions import (
    AccountBlockedError,
    ConcurrencyConflictError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)


@dataclass(frozen=True)
class TransactionResult:
    transaction: Transaction
    flagged: FlaggedTransaction | None


class TransactionService:
    def __init__(
        self,
        account_repo: AccountRepository,
        transaction_repo: TransactionRepository,
        flagged_repo: FlaggedTransactionRepository,
        antifraud: AntifraudService,
    ) -> None:
        self._account_repo = account_repo
        self._transaction_repo = transaction_repo
        self._flagged_repo = flagged_repo
        self._antifraud = antifraud

    async def submit_transaction(
        self,
        account_id: int,
        ip: str,
        amount: Decimal,
        country: str,
    ) -> TransactionResult:
        if amount <= 0:
            raise ValidationError("amount must be positive")

        account = await self._account_repo.get_by_id(account_id)
        if account is None:
            raise NotFoundError("account not found")
        if account.state != AccountState.ACTIVO:
            raise AccountBlockedError("account is not active")

        is_fraud = await self._antifraud.record_and_check(account_id, amount)
        if is_fraud:
            transaction = Transaction(
                account_id=account_id,
                ip=ip,
                amount=amount,
                country=country,
                state=TransactionState.BLOQUEADA,
            )
            await self._transaction_repo.create(transaction)
            flagged = FlaggedTransaction(
                transaction_id=transaction.id,
                anomaly="Pattern 3x 9000 < 10s",
                state=AuditState.REVISION_PENDIENTE,
            )
            await self._flagged_repo.create(flagged)
            return TransactionResult(transaction=transaction, flagged=flagged)

        if account.balance is None or account.version is None:
            raise ValidationError("account balance or version missing")
        if account.balance < amount:
            raise InsufficientFundsError("insufficient funds")

        updated = await self._account_repo.update_balance_with_version(
            account_id=account.id,
            expected_version=account.version,
            delta=-amount,
        )
        if updated is None:
            raise ConcurrencyConflictError("account version mismatch")

        transaction = Transaction(
            account_id=account_id,
            ip=ip,
            amount=amount,
            country=country,
            state=TransactionState.APROBADA,
        )
        await self._transaction_repo.create(transaction)
        return TransactionResult(transaction=transaction, flagged=None)
