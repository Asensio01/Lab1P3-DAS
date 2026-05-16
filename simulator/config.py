from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SimulatorConfig:
    base_url: str
    total_accounts: int
    rate_per_sec: int
    duration_seconds: int
    burst_size: int
