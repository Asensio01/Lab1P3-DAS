from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
from services.auth import AuthError, verify_access_token
from services.notifications import notification_hub

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"] ,
)
app.include_router(api_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        verify_access_token(token)
    except AuthError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await notification_hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await notification_hub.disconnect(websocket)


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