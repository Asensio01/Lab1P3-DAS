from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class ApiClient:
    base_url: str

    async def create_account(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError()

    async def submit_transaction(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError()


def build_client(base_url: str) -> ApiClient:
    return ApiClient(base_url=base_url)
