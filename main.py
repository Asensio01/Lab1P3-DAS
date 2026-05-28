from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from api.v1.routes import router as api_router
from core.logging import configure_logging, get_correlation_id, set_correlation_id
from services.exceptions import (
    AccountBlockedError,
    ConcurrencyConflictError,
    DomainError,
    FraudDetectedError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)

configure_logging()
logger = logging.getLogger("fintech_guard")

app = FastAPI(
    title="FINTECH GUARD",
    version="1.0.0",
    description=(
        "Motor de analisis de transacciones en tiempo real para deteccion de fraude, "
        "auditoria y procesamiento concurrente seguro."
    ),
    openapi_tags=[
        {
            "name": "accounts",
            "description": "Gestion de cuentas y estado financiero.",
        },
        {
            "name": "transactions",
            "description": "Registro y validacion de transacciones financieras.",
        },
        {
            "name": "audit",
            "description": "Resolucion de transacciones marcadas para revision manual.",
        },
    ],
)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.include_router(api_router)


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    header_value = request.headers.get("x-correlation-id")
    correlation_id = header_value or str(uuid4())
    set_correlation_id(correlation_id)
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    return response


@app.exception_handler(DomainError)
async def handle_domain_error(_: Request, exc: DomainError):
    status_code = 400
    if isinstance(exc, NotFoundError):
        status_code = 404
    elif isinstance(exc, (AccountBlockedError, InsufficientFundsError, FraudDetectedError)):
        status_code = 403
    elif isinstance(exc, ConcurrencyConflictError):
        status_code = 409
    elif isinstance(exc, ValidationError):
        status_code = 400
    payload = {"error": str(exc), "correlation_id": get_correlation_id()}
    logger.warning("domain_error", extra=payload)
    return JSONResponse(status_code=status_code, content=payload)


@app.get("/")
async def root():
    return {"message": "Fintech Guard"}