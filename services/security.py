from __future__ import annotations

from dataclasses import dataclass

from infrastructure.models import SecurityLog
from repositories.interfaces import SecurityLogRepository


@dataclass(frozen=True)
class SecurityLogService:
    repo: SecurityLogRepository

    async def log_login_failed(self, ip: str, username: str, reason: str) -> SecurityLog:
        entry = SecurityLog(
            ip=ip,
            details={"username": username, "reason": reason},
            state="LOGIN_FAILED",
        )
        return await self.repo.create(entry)

    async def log_db_query_failed(self, ip: str, username: str, reason: str) -> SecurityLog:
        entry = SecurityLog(
            ip=ip,
            details={"username": username, "reason": reason},
            state="DB_QUERY_FAILED",
        )
        return await self.repo.create(entry)
