from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AccountState(str, enum.Enum):
    ACTIVO = "Activo"
    INACTIVO = "Inactivo"
    BLOQUEADO = "Bloqueado"


class AuditState(str, enum.Enum):
    APROBADO = "Aprobado"
    BLOQUEADO = "Bloqueado"
    REVISION_PENDIENTE = "Revision Pendiente"
    BAJO_REVISION = "Bajo Revision"


class TransactionState(str, enum.Enum):
    APROBADA = "Aprobada"
    RECHAZADA = "Rechazada"
    BLOQUEADA = "Bloqueada"


class Account(Base):
    __tablename__ = "account"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_account_balance_nonnegative"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        server_default=text("gen_random_uuid()"),
        unique=True,
        nullable=False,
    )
    user_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    user_info: Mapped[dict] = mapped_column(JSONB, nullable=False)
    state: Mapped[AccountState | None] = mapped_column(
        Enum(
            AccountState,
            name="account_state",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        server_default=text("'Activo'"),
        nullable=True,
    )
    balance: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        server_default=text("0.00"),
        nullable=True,
    )
    version: Mapped[int | None] = mapped_column(
        Integer, server_default=text("1"), nullable=True
    )

    transactions: Mapped[list[Transaction]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class Transaction(Base):
    __tablename__ = "transaction"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    account_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("account.id"), nullable=True
    )
    ip: Mapped[str] = mapped_column(INET, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    country: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[TransactionState] = mapped_column(
        Enum(
            TransactionState,
            name="transaction_state",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        server_default=text("'Aprobada'"),
        nullable=False,
    )
    timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )

    account: Mapped[Account | None] = relationship(back_populates="transactions")
    flagged: Mapped[FlaggedTransaction | None] = relationship(
        back_populates="transaction", uselist=False
    )


class FlaggedTransaction(Base):
    __tablename__ = "flagged_transaction"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("transaction.id"), unique=True, nullable=True
    )
    anomaly: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[AuditState | None] = mapped_column(
        Enum(
            AuditState,
            name="audit_state",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        server_default=text("'Revision Pendiente'"),
        nullable=True,
    )
    auditor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )

    transaction: Mapped[Transaction | None] = relationship(back_populates="flagged")


class SecurityLog(Base):
    __tablename__ = "security_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ip: Mapped[str] = mapped_column(INET, nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )


class AuthUser(Base):
    __tablename__ = "auth_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, server_default=text("'admin'"), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )


Index("idx_transaction_account_time", Transaction.account_id, Transaction.timestamp)
Index("idx_auth_user_username", AuthUser.username)
