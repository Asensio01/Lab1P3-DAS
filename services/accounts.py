from __future__ import annotations

from decimal import Decimal

from infrastructure.models import Account, AccountState
from repositories.interfaces import AccountRepository
from services.exceptions import ValidationError


class AccountService:
    def __init__(self, account_repo: AccountRepository) -> None:
        self._account_repo = account_repo

    async def get_by_user_name(self, user_name: str) -> Account | None:
        return await self._account_repo.get_by_user_name(user_name)

    async def create_account(
        self,
        user_name: str,
        user_info: dict,
        initial_balance: Decimal | None,
        state: AccountState | None,
    ) -> Account:
        if not user_name.strip():
            raise ValidationError("user_name is required")
        if not isinstance(user_info, dict) or not user_info:
            raise ValidationError("user_info must be a non-empty JSON object")
        if initial_balance is not None and initial_balance < 0:
            raise ValidationError("initial_balance must be >= 0")

        existing = await self._account_repo.get_by_user_name(user_name)
        if existing is not None:
            raise ValidationError("user_name already exists")

        account = Account(
            user_name=user_name,
            user_info=user_info,
            balance=initial_balance,
            state=state,
        )
        return await self._account_repo.create(account)

    async def get_all_active_accounts(self, min_balance: Decimal) -> list[Account]:
        return await self._account_repo.list_active(min_balance)