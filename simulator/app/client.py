# simulator/app/client.py
import logging
import httpx
import asyncio
import random
from app.config import settings
from app.types import TransactionCreate

logger = logging.getLogger("simulator")
base_api_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1"

async def garantizar_cuentas_iniciales():
    """
    Verifica si el backend tiene cuentas para transaccionar. 
    Si no existen, crea un set de cuentas base automatizadas.
    """
    async with httpx.AsyncClient(base_url=base_api_url, timeout=10.0) as client:
        try:
            # Intentamos verificar si la cuenta 1 existe (o puedes crear un endpoint /accounts/ para verificar)
            response = await client.get("/accounts/1")
            if response.status_code == 200:
                logger.info("Cuentas base detectadas en el sistema.")
                return [1, 2] # IDs asumidos que ya existen
        except Exception:
            logger.warning("No se pudo verificar cuentas. Intentando inicialización forzada...")

        # Flujo de siembra (Seeding): Creamos 3 cuentas simuladas por defecto
        cuentas_creadas = []
        for i in range(1, 4):
            payload = {
                "user_name": f"usuario_simulado_{i}",
                "user_info": {"name": f"Test User {i}", "dui": f"0000000- {i}"},
                "initial_balance": 50000.00,
                "state": "Activo"
            }
            try:
                res = await client.post("/accounts", json=payload)
                if res.status_code in (200, 201):
                    data = res.json()
                    cuentas_creadas.append(data["id"])
                    logger.info(f"Cuenta base creada exitosamente: ID {data['id']}")
            except Exception as e:
                logger.error(f"Error crítico al sembrar la cuenta {i}: {e}")
        
        return cuentas_creadas if cuentas_creadas else [1, 2, 3]

async def enviar_transaccion(tx: TransactionCreate, max_retries: int = 5):
    """
    Envía la transacción al backend. 
    Si hay un conflicto de concurrencia (409), reintenta automáticamente con backoff exponencial.
    """
    
    async with httpx.AsyncClient(base_url=base_api_url) as client:
        for intento in range(1, max_retries + 1):
            try:
                response = await client.post("/transactions", json=tx.model_dump(mode="json"))
                
                if response.status_code in (200, 201):
                    logger.info(f"✅ Transacción exitosa -> Cuenta: {tx.account_id} | Monto: ${tx.amount}")
                    return # Éxito, salimos de la función
                    
                elif response.status_code == 409:
                    # Es un conflicto de versión de cuenta. Esperamos un momento y reintentamos.
                    # Usamos un delay exponencial + aleatoriedad para que las peticiones no colisionen otra vez
                    wait_time = (0.1 * (2 ** intento)) + random.uniform(0.05, 0.15)
                    logger.warning(
                        f"⚠️ [Intento {intento}/{max_retries}] Conflicto 409 (version mismatch) "
                        f"en Cuenta {tx.account_id}. Reintentando en {wait_time:.3f}s..."
                    )
                    await asyncio.sleep(wait_time)
                    continue # Ir al siguiente intento del bucle
                    
                elif response.status_code == 403:
                    # Si el backend responde 403, significa que la IP fue bloqueada por antifraude o el Rate Limit.
                    # Esto está BIEN en la simulación, significa que el backend se defendió.
                    logger.error(f"🛑 Backend Bloqueó la Transacción (403 Forbidden): {response.text}")
                    return
                    
                else:
                    logger.error(f"❌ Backend rechazó transacción: {response.status_code} - {response.text}")
                    return

            except Exception as e:
                logger.error(f"💥 Error de conexión con el Backend (Intento {intento}): {e}")
                await asyncio.sleep(0.5)
                
        logger.error(f"🚨 Transacción para cuenta {tx.account_id} falló definitivamente tras {max_retries} reintentos.")

async def obtener_cuentas_candidatas_fraude() -> list[dict]:
    """
    Consulta al backend los detalles de las cuentas para verificar 
    cuáles están Activas y tienen saldo suficiente (>= 27000).
    """
    cuentas_aptas = []
    
    async with httpx.AsyncClient(base_url=base_api_url, timeout=5.0) as client:
        # Consultamos las primeras cuentas del sistema (ej: IDs del 1 al 10)
        for account_id in range(1, 11):
            try:
                res = await client.get(f"/accounts/{account_id}")
                if res.status_code == 200:
                    acc = res.json()
                    # Validamos requisitos estructurales de la DB
                    balance = float(acc.get("balance", 0) or 0)
                    if acc.get("state") == "Activo" and balance >= 36000.00:
                        cuentas_aptas.append(acc)
            except Exception:
                continue
                
    return cuentas_aptas

async def obtener_cuentas_candidatas_stres() -> list[dict]:
    """
    Consulta al backend los detalles de las cuentas para verificar 
    cuáles están Activas y tienen saldo suficiente (>= 27000).
    """
    cuentas_ids = []
    
    async with httpx.AsyncClient(base_url=base_api_url, timeout=5.0) as client:
        # Consultamos las primeras cuentas del sistema (ej: IDs del 1 al 10)
        for account_id in range(1, 11):
            try:
                res = await client.get(f"/accounts/{account_id}")
                if res.status_code == 200:
                    cuentas_ids.append(account_id)
            except Exception:
                continue
                
    return cuentas_ids