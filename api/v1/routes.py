from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.dependencies import (
    AccountServiceContext,
    AuditServiceContext,
    TransactionServiceContext,
    get_account_repo,
    get_account_service,
    get_audit_service,
    get_security_log_service,
    get_transaction_service,
)
from api.schemas import (
    AccountCreate,
    AccountResponse,
    AuditResolveRequest,
    FlaggedResponse,
    LoginRequest,
    TokenResponse,
    TransactionCreate,
    TransactionResultResponse,
)
from core.config import settings
from services.auth import AuthError, create_access_token, verify_access_token

auth_scheme = HTTPBearer(auto_error=False)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing token"
        )
    try:
        return verify_access_token(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc


router = APIRouter(prefix="/api/v1")


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    tags=["auth"],
    summary="Login",
    description="Issues a JWT access token for API access.",
    responses={
        200: {"description": "Token issued"},
        401: {"description": "Invalid credentials"},
    },
)
async def login(
    payload: LoginRequest,
    request: Request,
    context=Depends(get_security_log_service),
) -> TokenResponse:
    if (
        payload.username != settings.admin_username
        or payload.password != settings.admin_password
    ):
        client_ip = request.client.host if request.client else "unknown"
        async with context.session.begin():
            await context.service.log_login_failed(
                ip=client_ip,
                username=payload.username,
                reason="invalid credentials",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )

    token, expires_in = create_access_token(payload.username)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post(
    "/transactions",
    response_model=TransactionResultResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["transactions"],
    summary="Submit a transaction",
    description="Validates antifraud rules, applies optimistic locking, and records the transaction.",
    responses={
        201: {"description": "Transaction recorded"},
        400: {"description": "Validation error"},
        403: {"description": "Blocked by antifraud or account state"},
        409: {"description": "Concurrency conflict"},
    },
)
async def submit_transaction(
    payload: TransactionCreate,
    context: TransactionServiceContext = Depends(get_transaction_service),
    _: str = Depends(require_auth),
) -> TransactionResultResponse:
    async with context.session.begin():
        result = await context.service.submit_transaction(
            account_id=payload.account_id,
            ip=str(payload.ip),
            amount=payload.amount,
            country=payload.country,
        )
    return TransactionResultResponse(
        transaction=result.transaction, flagged=result.flagged
    )


@router.post(
    "/flagged/{flagged_id}/resolve",
    response_model=FlaggedResponse,
    tags=["audit"],
    summary="Resolve a flagged transaction",
    description="Marks a flagged transaction as resolved with auditor notes.",
    responses={
        200: {"description": "Flagged transaction updated"},
        400: {"description": "Validation error"},
        404: {"description": "Flagged transaction not found"},
    },
)
async def resolve_flagged(
    flagged_id: int,
    payload: AuditResolveRequest,
    context: AuditServiceContext = Depends(get_audit_service),
    _: str = Depends(require_auth),
) -> FlaggedResponse:
    async with context.session.begin():
        updated = await context.service.resolve_flagged(
            flagged_id=flagged_id,
            state=payload.state,
            auditor_notes=payload.auditor_notes,
        )
    return FlaggedResponse.model_validate(updated)


@router.post(
    "/accounts",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["accounts"],
    summary="Create an account",
    description="Creates a new account with optional initial balance.",
    responses={
        201: {"description": "Account created"},
        400: {"description": "Validation error"},
    },
)
async def create_account(
    payload: AccountCreate,
    context: AccountServiceContext = Depends(get_account_service),
    _: str = Depends(require_auth),
) -> AccountResponse:
    async with context.session.begin():
        account = await context.service.create_account(
            user_name=payload.user_name,
            user_info=payload.user_info,
            initial_balance=payload.initial_balance,
            state=payload.state,
        )
    return AccountResponse.model_validate(account)


@router.get(
    "/accounts/active",
    response_model=list[AccountResponse],
    tags=["accounts"],
    summary="List active accounts",
    description="Returns active accounts with balance >= min_balance.",
    responses={
        200: {"description": "Active accounts returned"},
    },
)
async def list_active_accounts(
    min_balance: Decimal = Query(..., ge=0),
    context: AccountServiceContext = Depends(get_account_service),
    _: str = Depends(require_auth),
) -> list[AccountResponse]:
    accounts = await context.service.get_all_active_accounts(min_balance)
    return [AccountResponse.model_validate(account) for account in accounts]


@router.get(
    "/accounts/{account_id}",
    response_model=AccountResponse,
    tags=["accounts"],
    summary="Get account by id",
    description="Returns account details and current balance.",
    responses={
        200: {"description": "Account found"},
        404: {"description": "Account not found"},
    },
)
async def get_account(
    account_id: int,
    repo=Depends(get_account_repo),
    _: str = Depends(require_auth),
) -> AccountResponse:
    account = await repo.get_by_id(account_id)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="not found"
        )
    return AccountResponse.model_validate(account)