# simulator/app/types.py
from decimal import Decimal
from pydantic import BaseModel, Field

class TransactionCreate(BaseModel):
    account_id: int = Field(..., ge=1)
    ip: str
    amount: Decimal = Field(..., gt=0)
    country: str = Field(..., min_length=2, max_length=64)

class FraudSimulationRequest(BaseModel):
    cantidad_cuentas: int = Field(..., ge=1, description="Número de cuentas activas a corromper")

class StressSimulationRequest(BaseModel):
    cantidad_transacciones: int = Field(..., ge=1, le=500, description="Número de transacciones a disparar en la ráfaga")