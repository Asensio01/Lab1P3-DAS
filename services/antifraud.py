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


@dataclass(frozen=True)
class IpBurstRuleConfig:
    window_seconds: int
    max_allowed: int


DEFAULT_RULE = FraudRuleConfig(
    amount=Decimal("9000.00"),
    window_seconds=10,
    max_allowed=3,
)

DEFAULT_IP_RULE = IpBurstRuleConfig(
    window_seconds=60,
    max_allowed=50,
)


class AntifraudService:
    def __init__(
        self,
        store: RedisFraudRepository,
        rule: FraudRuleConfig = DEFAULT_RULE,
        ip_rule: IpBurstRuleConfig = DEFAULT_IP_RULE,
    ) -> None:
        self._store = store
        self._rule = rule
        self._ip_rule = ip_rule

    async def record_and_check(
        self,
        account_id: int,
        ip: str,
        amount: Decimal,
    ) -> str | None:
        timestamp_ms = int(time.time() * 1000)

        ip_count = await self._store.record_and_count_ip(
            ip=ip,
            timestamp_ms=timestamp_ms,
            window_seconds=self._ip_rule.window_seconds,
        )
        if ip_count > self._ip_rule.max_allowed:
            return f"IP burst {self._ip_rule.max_allowed}+ in {self._ip_rule.window_seconds}s"

        if amount != self._rule.amount:
            return None

        count = await self._store.record_and_count(
            account_id=account_id,
            timestamp_ms=timestamp_ms,
            window_seconds=self._rule.window_seconds,
        )
        if count > self._rule.max_allowed:
            return "Pattern 3x 9000 < 10s"

        return None
