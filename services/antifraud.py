from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import Decimal

from repositories.interfaces import RedisFraudRepository


@dataclass(frozen=True)
class FraudRuleConfig:
    amount: Decimal
    window_seconds: int
    max_allowed: int


DEFAULT_RULE = FraudRuleConfig(
    amount=Decimal("9000.00"),
    window_seconds=10,
    max_allowed=3,
)


class AntifraudService:
    def __init__(self, store: RedisFraudRepository, rule: FraudRuleConfig = DEFAULT_RULE) -> None:
        self._store = store
        self._rule = rule

    async def record_and_check(self, account_id: int, amount: Decimal) -> bool:
        if amount != self._rule.amount:
            return False
        timestamp_ms = int(time.time() * 1000)
        count = await self._store.record_and_count(
            account_id=account_id,
            timestamp_ms=timestamp_ms,
            window_seconds=self._rule.window_seconds,
        )
        return count > self._rule.max_allowed
