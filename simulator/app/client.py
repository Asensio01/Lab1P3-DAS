# simulator/app/client.py
import logging
import httpx
import asyncio
import random
import time
import base64
import json
from decimal import Decimal
from app.config import settings
from app.types import TransactionCreate
from app.redis_client import redis_db

logger = logging.getLogger("simulator")
base_api_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1"

_access_token: str | None = None
_access_token_expires_at: float = 0.0


async def _login_for_token() -> tuple[str, int]:
    async with httpx.AsyncClient(base_url=base_api_url, timeout=10.0) as client:
        response = await client.post(
            "/auth/login",
            json={"username": settings.AUTH_USERNAME, "password": settings.AUTH_PASSWORD},
        )
        if response.status_code != 200:
            raise RuntimeError(f"Login failed: {response.status_code} {response.text}")
        payload = response.json()
        return payload["access_token"], int(payload["expires_in"])


async def get_access_token() -> str:
    global _access_token, _access_token_expires_at
    now = time.time()
    if _access_token and now < (_access_token_expires_at - 5):
        return _access_token

    token, expires_in = await _login_for_token()
    _access_token = token
    _access_token_expires_at = now + expires_in
    return token

async def garantizar_cuentas_iniciales():
    """
    Verifica si el backend tiene cuentas para transaccionar. 
    Si no existen, crea un set de cuentas base automatizadas.
    """
    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=base_api_url, timeout=10.0) as client:
        try:
            # Intentamos verificar si la cuenta 1 existe (o puedes crear un endpoint /accounts/ para verificar)
            response = await client.get("/accounts/active", headers=headers)
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
                res = await client.post("/accounts", json=payload, headers=headers)
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
    # Configuramos un timeout explícito y más holgado de 30 segundos para soportar el estrés
    limits = httpx.Limits(max_keepalive_connections=100, max_connections=200)
    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Informacion a retornar
    tx_data = tx.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=base_api_url, timeout=30.0, limits=limits) as client:
        for intento in range(1, max_retries + 1):
            try:
                response = await client.post(
                    "/transactions",
                    json=tx.model_dump(mode="json"),
                    headers=headers,
                )
                
                if response.status_code in (200, 201):
                    logger.info(f"✅ Transacción exitosa -> Cuenta: {tx.account_id} | Monto: ${tx.amount}")
                    return {
                        "status": "SUCCESS",
                        "status_code": response.status_code,
                        "intentos": intento,
                        "details": response.json() if response.text else {},
                        "transaction": tx_data
                    }
                    
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
                    return {
                        "status": "BLOCKED",
                        "status_code": 403,
                        "intentos": intento,
                        "details": response.json() if response.text else {"message": "Forbidden"},
                        "transaction": tx_data
                    }
                    
                else:
                    logger.error(f"❌ Backend rechazó transacción: {response.status_code} - {response.text}")
                    return {
                        "status": "REJECTED",
                        "status_code": response.status_code,
                        "intentos": intento,
                        "details": response.text,
                        "transaction": tx_data
                    }
            
            except httpx.TimeoutException:
                logger.error(f"⏳ [Intento {intento}] ¡Timeout de red esperando al backend para la cuenta {tx.account_id}!")
                await asyncio.sleep(1.0)
                continue

            except Exception as e:
                logger.error(f"💥 Error de conexión con el Backend (Intento {intento}): {e}")
                await asyncio.sleep(0.5)
                
        logger.error(f"🚨 Transacción para cuenta {tx.account_id} falló definitivamente tras {max_retries} reintentos.")
        return {
            "status": "FAILED",
            "status_code": 500,
            "intentos": max_retries,
            "details": "Falló tras máximos reintentos por red o timeout.",
            "transaction": tx_data
        }

async def obtener_cuentas_candidatas_fraude() -> list[dict]:
    """
    Consulta al backend los detalles de las cuentas para verificar 
    cuáles están Activas y tienen saldo suficiente (>= 27000).
    """
    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=base_api_url, timeout=5.0) as client:
        try:
            # Enviamos el min_balance requerido en los parámetros de la URL
            response = await client.get(
                "/accounts/active", 
                params={"min_balance": "36000.00"}, 
                headers=headers
            )
            if response.status_code == 200:
                # El backend ya devuelve la lista filtrada de cuentas aptas
                return response.json()
        except Exception as e:
            logger.error(f"Error al obtener cuentas candidatas de fraude: {e}")
            
    return []

async def obtener_cuentas_candidatas_estres() -> list[dict]:
    """
    Consulta al backend los detalles de las cuentas para verificar 
    cuáles están Activas y tienen saldo suficiente (>= 1000).
    """
    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=base_api_url, timeout=5.0) as client:
        try:
            response = await client.get(
                "/accounts/active", 
                params={"min_balance": "1000.00"}, 
                headers=headers
            )
            if response.status_code == 200:
                cuentas = response.json()
                # Mapeamos para retornar solo la lista de IDs que espera el escenario de estrés
                return [acc["id"] for acc in cuentas]
        except Exception as e:
            logger.error(f"Error al obtener cuentas candidatas de estrés: {e}")
            
    return []

async def obtener_cuentas_candidatas_doble_pago() -> list[dict]:
    """
    Consulta al backend los detalles de las cuentas para verificar 
    cuáles están Activas y tienen saldo suficiente (> 0.01).
    """
    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=base_api_url, timeout=5.0) as client:
        try:
            response = await client.get(
                "/accounts/active", 
                params={"min_balance": "0.01"}, 
                headers=headers
            )
            if response.status_code == 200:
                cuentas = response.json()
                # Formateamos la respuesta para mantener compatibilidad con tu código original
                return [
                    {
                        "id": acc["id"], 
                        "balance": Decimal(str(acc.get("balance", "0")))
                    } 
                    for acc in cuentas
                ]
        except Exception as e:
            logger.error(f"Error al obtener cuentas candidatas de doble pago: {e}")
            
    return []

async def enviar_transaccion_con_feedback(tx: TransactionCreate) -> dict:
    """Envía una transacción sin reintentos automáticos para evaluar si el backend frena el choque."""

    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=base_api_url) as client:
        try:
            response = await client.post(
                "/transactions",
                json=tx.model_dump(mode="json"),
                headers=headers,
            )
            return {
                "status": response.status_code,
                "detail": response.json() if response.status_code in (200, 201, 409, 403, 400) else response.text
            }
        except Exception as e:
            return {"status": 500, "detail": f"Error de conexión: {str(e)}"}


async def verificar_token_expirado_bg(simulation_id: str, account_id: int):
    """
    Duerme eficientemente en segundo plano hasta que el token expire de verdad,
    luego consulta al backend y guarda el resultado estricto en Redis.
    """
    try:
        # 1. Obtenemos el token y su tiempo de vida (ej: 900 segundos)
        token, expires_in = await _login_for_token()
        
        # 2. Esperamos en segundo plano. Cero consumo de CPU durante la espera.
        await asyncio.sleep(expires_in + 2) 
        
        # 3. Al despertar, el token ya expiró estrictamente en el Backend. Ejecutamos la prueba.
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=base_api_url, timeout=10.0) as client:
            response = await client.get(f"/accounts/{account_id}", headers=headers)
            
            # 4. Estructuramos el reporte final esperado
            reporte_final = {
                "status": "COMPLETED",
                "resultado": {
                    "status_code": response.status_code,
                    "detail": response.json() if response.status_code in (200, 401, 403, 404) else response.text,
                }
            }
            
    except Exception as e:
        reporte_final = {
            "status": "FAILED",
            "message": f"Error durante la simulación de fondo: {str(e)}"
        }

    # 5. Guardamos en Redis para que React pueda verlo
    redis_db.setex(f"sim:{simulation_id}", 7200, json.dumps(reporte_final))