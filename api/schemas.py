from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress

from infrastructure.models import AccountState, AuditState, TransactionState


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: UUID
    user_name: str
    user_info: dict
    state: AccountState | None
    balance: Decimal | None
    reserved_balance: Decimal | None
    version: int | None


class AccountCreate(BaseModel):
    user_name: str = Field(..., min_length=3, max_length=64)
    user_info: dict
    initial_balance: Decimal | None = Field(default=None, ge=0)
    state: AccountState | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "user_name": "juan",
                    "user_info": {"name": "Juan", "dui": "000000-0"},
                    "initial_balance": 10000.00,
                    "state": "Activo",
                }
            ]
        }
    )


class AccountSelfCreate(BaseModel):
    user_info: dict
    initial_balance: Decimal | None = Field(default=None, ge=0)


class TransactionCreate(BaseModel):
    account_id: int = Field(..., ge=1)
    ip: IPvAnyAddress
    amount: Decimal = Field(..., gt=0)
    country: str = Field(..., min_length=2, max_length=64)

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "account_id": 1,
                    "ip": "127.0.0.1",
                    "amount": 9000.00,
                    "country": "SV",
                }
            ]
        }
    )


class TransactionSelfCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    country: str = Field(..., min_length=2, max_length=64)


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int | None
    ip: IPvAnyAddress
    amount: Decimal
    country: str
    state: TransactionState
    timestamp: datetime | None


class FlaggedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int | None
    anomaly: str
    state: AuditState | None
    auditor_notes: str | None
    resolved_at: datetime | None
    timestamp: datetime | None


class TransactionResultResponse(BaseModel):
    transaction: TransactionResponse
    flagged: FlaggedResponse | None


class AuditResolveRequest(BaseModel):
    state: AuditState
    auditor_notes: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "state": "Aprobado",
                    "auditor_notes": "Revision completada.",
                }
            ]
        }
    )


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)
    role: str = Field("admin", min_length=3, max_length=32)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RegisterResponse(BaseModel):
    username: str
    role: str
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TransactionQueryRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)
    limit: int = Field(25, ge=1, le=200)
    account_id: int | None = Field(default=None, ge=1)


class SimulatorAlertRequest(BaseModel):
    transaction_id: int | None = Field(default=None, ge=1)
    anomaly: str = Field(..., min_length=3, max_length=300)
    amount: Decimal | None = Field(default=None, gt=0)
    country: str | None = Field(default=None, min_length=2, max_length=64)
    ip: str | None = Field(default=None, min_length=7, max_length=64)
    account: str | None = Field(default=None, min_length=3, max_length=64)
    timestamp: datetime | None = None


class TransactionStatusPatchRequest(BaseModel):
    status: Literal["Blocked", "Approved"]


class MessageResponse(BaseModel):
    message: str
