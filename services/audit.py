from __future__ import annotations

from datetime import datetime, timezone

from repositories.interfaces import FlaggedTransactionRepository
from services.exceptions import NotFoundError, ValidationError


class AuditService:
    def __init__(self, flagged_repo: FlaggedTransactionRepository) -> None:
        self._flagged_repo = flagged_repo

    async def resolve_flagged(
        self,
        flagged_id: int,
        state: str,
        auditor_notes: str | None,
    ):
        if not state:
            raise ValidationError("state is required")
        resolved_at = datetime.now(tz=timezone.utc)
        updated = await self._flagged_repo.update_state(
            flagged_id=flagged_id,
            state=state,
            auditor_notes=auditor_notes,
            resolved_at=resolved_at,
        )
        if updated is None:
            raise NotFoundError("flagged transaction not found")
        return updated
