from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from repositories.interfaces import (
    AccountRepository,
    FlaggedTransactionRepository,
    TransactionRepository,
)
from infrastructure.models import AuditState, TransactionState
from services.exceptions import (
    ConcurrencyConflictError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)


class AuditService:
    def __init__(
        self,
        account_repo: AccountRepository,
        transaction_repo: TransactionRepository,
        flagged_repo: FlaggedTransactionRepository,
    ) -> None:
        self._account_repo = account_repo
        self._transaction_repo = transaction_repo
        self._flagged_repo = flagged_repo

    async def resolve_flagged(
        self,
        flagged_id: int,
        state: str,
        auditor_notes: str | None,
    ):
        if not state:
            raise ValidationError("state is required")
        flagged = await self._flagged_repo.get_by_id(flagged_id)
        if flagged is None:
            raise NotFoundError("flagged transaction not found")
        if flagged.state in (AuditState.APROBADO, AuditState.BLOQUEADO):
            raise ValidationError("flagged transaction already resolved")
        if flagged.transaction_id is None:
            raise ValidationError("flagged transaction missing transaction")

        transaction = await self._transaction_repo.get_by_id(flagged.transaction_id)
        if transaction is None:
            raise NotFoundError("transaction not found")

        if state == AuditState.APROBADO:
            if transaction.account_id is None:
                raise ValidationError("transaction missing account")
            account = await self._account_repo.get_for_update(transaction.account_id)
            if account is None:
                raise NotFoundError("account not found")
            if (
                account.balance is None
                or account.version is None
                or account.reserved_balance is None
            ):
                raise ValidationError("account balance or version missing")
            if account.reserved_balance < transaction.amount:
                raise InsufficientFundsError("insufficient held funds")

            updated_account = await self._account_repo.update_balances_with_version(
                account_id=account.id,
                expected_version=account.version,
                balance_delta=-transaction.amount,
                reserved_delta=-transaction.amount,
            )
            if updated_account is None:
                raise ConcurrencyConflictError("account version mismatch")

            await self._transaction_repo.update_state(
                transaction_id=transaction.id,
                state=TransactionState.APROBADA,
            )
        elif state == AuditState.BLOQUEADO:
            if transaction.account_id is None:
                raise ValidationError("transaction missing account")
            account = await self._account_repo.get_for_update(transaction.account_id)
            if account is None:
                raise NotFoundError("account not found")
            if (
                account.reserved_balance is None
                or account.version is None
            ):
                raise ValidationError("account balance or version missing")
            if account.reserved_balance < transaction.amount:
                raise InsufficientFundsError("insufficient held funds")

            updated_account = await self._account_repo.update_balances_with_version(
                account_id=account.id,
                expected_version=account.version,
                balance_delta=Decimal("0"),
                reserved_delta=-transaction.amount,
            )
            if updated_account is None:
                raise ConcurrencyConflictError("account version mismatch")

            await self._transaction_repo.update_state(
                transaction_id=transaction.id,
                state=TransactionState.RECHAZADA,
            )

        resolved_at = datetime.now(tz=timezone.utc)
        updated = await self._flagged_repo.update_state(
            flagged_id=flagged_id,
            state=state,
            auditor_notes=auditor_notes,
            resolved_at=resolved_at,
        )
        return updated

    async def list_pending(self) -> list:
        return await self._flagged_repo.list_by_states(
            [AuditState.REVISION_PENDIENTE, AuditState.BAJO_REVISION]
        )
