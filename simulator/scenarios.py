from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class FraudScenario:
    amount: Decimal
    window_seconds: int
    threshold: int
