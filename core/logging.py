from __future__ import annotations

import contextvars
import logging
from typing import Any

from core.config import settings

correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default="-"
)


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        return True


def configure_logging() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format=(
            "%(asctime)s %(levelname)s correlation_id=%(correlation_id)s "
            "%(name)s %(message)s"
        ),
    )
    logging.getLogger().addFilter(CorrelationIdFilter())


def get_correlation_id() -> str:
    return correlation_id_var.get()


def set_correlation_id(value: str) -> None:
    correlation_id_var.set(value)
