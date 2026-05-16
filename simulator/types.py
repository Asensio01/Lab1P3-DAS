from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AccountSeed:
    user_name: str
    user_info: dict
    initial_balance: float
