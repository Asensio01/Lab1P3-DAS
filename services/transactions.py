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
from services.notifications import NotificationService
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
        notifier: NotificationService | None = None,
    ) -> None:
        self._account_repo = account_repo
        self._transaction_repo = transaction_repo
        self._flagged_repo = flagged_repo
        self._antifraud = antifraud
        self._notifier = notifier

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

        anomaly = await self._antifraud.record_and_check(account_id, ip, amount)
        if anomaly:
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
                anomaly=anomaly,
                state=AuditState.REVISION_PENDIENTE,
            )
            await self._flagged_repo.create(flagged)
            if self._notifier:
                await self._notifier.notify_flagged(
                    {
                        "type": "flagged",
                        "flagged_id": flagged.id,
                        "transaction_id": transaction.id,
                        "account_id": account_id,
                        "amount": str(amount),
                        "ip": ip,
                        "country": country,
                        "anomaly": anomaly,
                        "state": flagged.state,
                    }
                )
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

    async def list_recent(self, limit: int, account_id: int | None = None) -> list[Transaction]:
        return await self._transaction_repo.list_recent(limit=limit, account_id=account_id)
