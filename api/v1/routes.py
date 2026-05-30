from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.dependencies import (
    AccountServiceContext,
    AuditServiceContext,
    TransactionServiceContext,
    get_account_repo,
    get_account_service,
    get_audit_service,
    get_auth_user_repo,
    get_security_log_service,
    get_transaction_service,
)
from api.schemas import (
    AccountCreate,
    AccountResponse,
    AccountSelfCreate,
    AuditResolveRequest,
    FlaggedResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    SimulatorAlertRequest,
    TokenResponse,
    TransactionCreate,
    TransactionQueryRequest,
    TransactionResponse,
    TransactionResultResponse,
    TransactionSelfCreate,
    TransactionStatusPatchRequest,
)
from core.config import settings
from infrastructure.models import AccountState, AuthUser
from repositories.postgres import (
    SqlAlchemyAccountRepository,
    SqlAlchemyTransactionRepository,
)
from services.auth import (
    AuthError,
    create_access_token,
    hash_password,
    verify_access_token,
    verify_password,
)
from services.notifications import notification_hub

auth_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    username: str
    role: str


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing token"
        )
    try:
        username, role = verify_access_token(credentials.credentials)
        return AuthContext(username=username, role=role)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc


def require_role(*roles: str):
    async def _require(auth: AuthContext = Depends(require_auth)) -> AuthContext:
        if auth.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient role",
            )
        return auth

    return _require


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
    auth_context=Depends(get_auth_user_repo),
    context=Depends(get_security_log_service),
) -> TokenResponse:
    async with auth_context.session.begin():
        user = await auth_context.repo.get_by_username(payload.username)

    valid_user = user is not None and verify_password(
        payload.password, user.password_hash
    )
    valid_admin = (
        payload.username == settings.admin_username
        and payload.password == settings.admin_password
    )

    if not (valid_user or valid_admin):
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

    role = user.role if valid_user else "admin"
    token, expires_in = create_access_token(payload.username, role)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post(
    "/auth/register",
    response_model=RegisterResponse,
    tags=["auth"],
    summary="Register",
    description="Creates a new user for JWT login.",
    responses={
        201: {"description": "User registered"},
        409: {"description": "Username already exists"},
    },
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    auth_context=Depends(get_auth_user_repo),
) -> RegisterResponse:
    async with auth_context.session.begin():
        existing = await auth_context.repo.get_by_username(payload.username)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="username already exists",
            )

        user = AuthUser(
            username=payload.username,
            password_hash=hash_password(payload.password),
            role="user",
        )
        await auth_context.repo.create(user)

    token, expires_in = create_access_token(payload.username, user.role)
    return RegisterResponse(
        username=user.username,
        role=user.role,
        access_token=token,
        expires_in=expires_in,
    )


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
    _: AuthContext = Depends(require_role("admin")),
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
    _: AuthContext = Depends(require_role("admin")),
) -> FlaggedResponse:
    async with context.session.begin():
        updated = await context.service.resolve_flagged(
            flagged_id=flagged_id,
            state=payload.state,
            auditor_notes=payload.auditor_notes,
        )
    return FlaggedResponse.model_validate(updated)


@router.get(
    "/flagged/pending",
    response_model=list[FlaggedResponse],
    tags=["audit"],
    summary="List pending flagged transactions",
    description="Returns flagged transactions pending manual review.",
    responses={
        200: {"description": "Flagged transactions returned"},
    },
)
async def list_pending_flagged(
    context: AuditServiceContext = Depends(get_audit_service),
    _: AuthContext = Depends(require_role("admin")),
) -> list[FlaggedResponse]:
    flagged = await context.service.list_pending()
    return [FlaggedResponse.model_validate(item) for item in flagged]


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
    _: AuthContext = Depends(require_role("admin")),
) -> AccountResponse:
    async with context.session.begin():
        account = await context.service.create_account(
            user_name=payload.user_name,
            user_info=payload.user_info,
            initial_balance=payload.initial_balance,
            state=payload.state,
        )
    return AccountResponse.model_validate(account)


@router.post(
    "/me/account",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["accounts"],
    summary="Create own account",
    description="Creates an account bound to the authenticated user.",
    responses={
        201: {"description": "Account created"},
        400: {"description": "Validation error"},
    },
)
async def create_my_account(
    payload: AccountSelfCreate,
    context: AccountServiceContext = Depends(get_account_service),
    auth: AuthContext = Depends(require_role("admin", "user")),
) -> AccountResponse:
    async with context.session.begin():
        account = await context.service.create_account(
            user_name=auth.username,
            user_info=payload.user_info,
            initial_balance=payload.initial_balance,
            state=AccountState.ACTIVO,
        )
    return AccountResponse.model_validate(account)


@router.get(
    "/me/account",
    response_model=AccountResponse,
    tags=["accounts"],
    summary="Get own account",
    description="Returns the account bound to the authenticated user.",
    responses={
        200: {"description": "Account found"},
        404: {"description": "Account not found"},
    },
)
async def get_my_account(
    context: AccountServiceContext = Depends(get_account_service),
    auth: AuthContext = Depends(require_role("admin", "user")),
) -> AccountResponse:
    account = await context.service.get_by_user_name(auth.username)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="not found"
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
    _: AuthContext = Depends(require_role("admin")),
) -> list[AccountResponse]:
    accounts = await context.service.get_all_active_accounts(min_balance)
    return [AccountResponse.model_validate(account) for account in accounts]


@router.post(
    "/me/transactions",
    response_model=TransactionResultResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["transactions"],
    summary="Submit own transaction",
    description="Creates a transaction for the authenticated user's account.",
    responses={
        201: {"description": "Transaction recorded"},
        400: {"description": "Validation error"},
        403: {"description": "Blocked by antifraud or account state"},
        404: {"description": "Account not found"},
        409: {"description": "Concurrency conflict"},
    },
)
async def submit_my_transaction(
    payload: TransactionSelfCreate,
    request: Request,
    context: TransactionServiceContext = Depends(get_transaction_service),
    auth: AuthContext = Depends(require_role("admin", "user")),
) -> TransactionResultResponse:
    client_ip = request.client.host if request.client else "0.0.0.0"
    async with context.session.begin():
        account_repo = SqlAlchemyAccountRepository(context.session)
        account = await account_repo.get_by_user_name(auth.username)
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="account not found",
            )
        result = await context.service.submit_transaction(
            account_id=account.id,
            ip=client_ip,
            amount=payload.amount,
            country=payload.country,
        )
    return TransactionResultResponse(
        transaction=result.transaction, flagged=result.flagged
    )


@router.get(
    "/me/transactions",
    response_model=list[TransactionResponse],
    tags=["transactions"],
    summary="List own transactions",
    description="Lists recent transactions for the authenticated user.",
    responses={
        200: {"description": "Transactions returned"},
        404: {"description": "Account not found"},
    },
)
async def list_my_transactions(
    limit: int = Query(25, ge=1, le=200),
    context: TransactionServiceContext = Depends(get_transaction_service),
    auth: AuthContext = Depends(require_role("admin", "user")),
) -> list[TransactionResponse]:
    account_repo = SqlAlchemyAccountRepository(context.session)
    account = await account_repo.get_by_user_name(auth.username)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="account not found"
        )
    transactions = await context.service.list_recent(
        limit=limit, account_id=account.id
    )
    return [TransactionResponse.model_validate(item) for item in transactions]


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
    _: AuthContext = Depends(require_role("admin")),
) -> AccountResponse:
    account = await repo.get_by_id(account_id)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="not found"
        )
    return AccountResponse.model_validate(account)


@router.get(
    "/transactions/{tx_id}",
    response_model=TransactionResponse,
    tags=["transactions"],
    summary="Get transaction by id",
    description="Returns transaction details for admin review.",
    responses={
        200: {"description": "Transaction found"},
        404: {"description": "Transaction not found"},
    },
)
async def get_transaction(
    tx_id: int,
    context: TransactionServiceContext = Depends(get_transaction_service),
    _: AuthContext = Depends(require_role("admin")),
) -> TransactionResponse:
    repo = SqlAlchemyTransactionRepository(context.session)
    transaction = await repo.get_by_id(tx_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="not found"
        )
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions/query",
    response_model=list[TransactionResponse],
    tags=["transactions"],
    summary="Query recent transactions",
    description="Queries recent transactions after validating DB credentials.",
    responses={
        200: {"description": "Transactions returned"},
        401: {"description": "Invalid DB credentials"},
    },
)
async def query_transactions(
    payload: TransactionQueryRequest,
    request: Request,
    context: TransactionServiceContext = Depends(get_transaction_service),
    security_context=Depends(get_security_log_service),
    _: AuthContext = Depends(require_role("admin")),
) -> list[TransactionResponse]:
    if (
        payload.username != settings.db_query_username
        or payload.password != settings.db_query_password
    ):
        client_ip = request.client.host if request.client else "unknown"
        async with security_context.session.begin():
            await security_context.service.log_db_query_failed(
                ip=client_ip,
                username=payload.username,
                reason="invalid db credentials",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid db credentials",
        )

    transactions = await context.service.list_recent(
        limit=payload.limit,
        account_id=payload.account_id,
    )
    return [TransactionResponse.model_validate(item) for item in transactions]


@router.post(
    "/simulator/alert",
    response_model=MessageResponse,
    tags=["transactions"],
    summary="Ingest simulator anomaly alert",
    description="Receives anomaly alerts from simulator and broadcasts them over WebSocket.",
    responses={
        200: {"description": "Alert accepted and broadcasted"},
        401: {"description": "Unauthorized"},
    },
)
async def simulator_alert(
    payload: SimulatorAlertRequest,
    _: AuthContext = Depends(require_role("admin")),
) -> MessageResponse:
    event = {
        "type": "simulator_alert",
        "transaction_id": payload.transaction_id,
        "anomaly": payload.anomaly,
        "amount": float(payload.amount) if payload.amount is not None else None,
        "country": payload.country,
        "ip": payload.ip,
        "account": payload.account,
        "timestamp": (
            payload.timestamp.astimezone(timezone.utc).isoformat()
            if payload.timestamp is not None
            else datetime.now(timezone.utc).isoformat()
        ),
    }
    await notification_hub.broadcast(event)
    return MessageResponse(message="alert broadcasted")


@router.patch(
    "/transactions/{tx_id}/status",
    response_model=MessageResponse,
    tags=["transactions"],
    summary="Update transaction status in dashboard stream",
    description="Publishes a transaction status update event over WebSocket.",
    responses={
        200: {"description": "Status update broadcasted"},
        401: {"description": "Unauthorized"},
    },
)
async def patch_transaction_status(
    tx_id: int,
    payload: TransactionStatusPatchRequest,
    _: AuthContext = Depends(require_role("admin")),
) -> MessageResponse:
    event = {
        "type": "transaction_status_updated",
        "tx_id": tx_id,
        "status": payload.status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await notification_hub.broadcast(event)
    return MessageResponse(message="transaction status broadcasted")
