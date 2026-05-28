from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any


class NotificationHub:
    def __init__(self) -> None:
        self._connections: set[Any] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: Any) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: Any) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections)

        stale: list[Any] = []
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                for websocket in stale:
                    self._connections.discard(websocket)


notification_hub = NotificationHub()


@dataclass(frozen=True)
class NotificationService:
    hub: NotificationHub

    async def notify_flagged(self, payload: dict[str, Any]) -> None:
        await self.hub.broadcast(payload)
