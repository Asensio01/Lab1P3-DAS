from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.dependencies import (
    AuditServiceContext,
    AccountServiceContext,
    TransactionServiceContext,
    get_account_repo,
    get_account_service,
    get_audit_service,
    get_transaction_service,
)
from api.schemas import (
    AccountCreate,
    AccountResponse,
    AuditResolveRequest,
    FlaggedResponse,
    TransactionCreate,
    TransactionResultResponse,
)
from services.audit import AuditService

router = APIRouter(prefix="/api/v1")


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
) -> AccountResponse:
    account = await repo.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return AccountResponse.model_validate(account)
