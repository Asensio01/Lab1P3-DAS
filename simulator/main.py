from __future__ import annotations

import asyncio

from simulator.config import SimulatorConfig


def build_default_config() -> SimulatorConfig:
    return SimulatorConfig(
        base_url="http://localhost:8000",
        total_accounts=10,
        rate_per_sec=5,
        duration_seconds=30,
        burst_size=3,
    )


async def run_simulation(config: SimulatorConfig) -> None:
    raise NotImplementedError()


def main() -> None:
    config = build_default_config()
    asyncio.run(run_simulation(config))


if __name__ == "__main__":
    main()
