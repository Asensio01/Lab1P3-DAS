# simulator/app/scenarios.py
import random
import asyncio
import logging
from app.redis_client import redis_db
import json
from decimal import Decimal
from app.types import TransactionCreate
from app.client import enviar_transaccion, enviar_transaccion_con_feedback

logger = logging.getLogger("simulator")

# Simulación de tráfico normal
PALSES_VALIDOS = ["SV", "GT", "HN", "CR", "PA"]
IPS_COMUNES = ["190.86.10.15", "190.86.10.22", "168.243.5.80", "180.22.1.9"]

# Simulación de patrón de fraude
PYS_FRAUDE = ["SV", "GT", "HN"]
IPS_FRAUDE = ["192.168.88.254", "10.0.0.5", "172.16.42.1"]

# Simulacion de estrés (stress test)
IP_STRESS_TARGET = "192.168.100.50" # IP única e idéntica para todo el ataque
PALSES_STRESS = ["SV", "GT", "HN", "CR"]

# Escenarios de simulación
def generar_transaccion_normal(account_id: int) -> TransactionCreate:
    """Genera datos orgánicos que no disparen las reglas de lavado."""
    return TransactionCreate(
        account_id=account_id,
        ip=random.choice(IPS_COMUNES),
        amount=Decimal(round(random.uniform(5.00, 350.00), 2)), # Montos pequeños cotidianos
        country=random.choice(PALSES_VALIDOS)
    )

# Escenario de fraude: Ráfaga de transacciones sospechosas
async def ejecutar_rafaga_fraude(account_id: int) -> list[dict]:
    """Dispara 4 transacciones de $9,000 en ráfaga para una cuenta."""
    logger.warning(f"🚨 INICIANDO PATRÓN DE FRAUDE EN CUENTA ID: {account_id} 🚨")
    resultados_cuenta = []

    for i in range(1, 5): # Enviaremos 4 transacciones de $9,000
        tx = TransactionCreate(
            account_id=account_id,
            ip=random.choice(IPS_FRAUDE),
            amount=Decimal("9000.00"),
            country=random.choice(PYS_FRAUDE)
        )
        
        logger.info(f"⚡ [Ráfaga {i}/4] Enviando $9,000 para cuenta {account_id}...")
        # Las enviamos de forma asíncrona pero con un ligero desfase (1.5s) 
        # para que entren holgadamente en el umbral de los 10 segundos
        # y guardamos el reporte de la transaccion
        resultado = await enviar_transaccion(tx)
        resultados_cuenta.append(resultado)
        await asyncio.sleep(1.5) 
        
    logger.warning(f"🛑 Fin de ráfaga de fraude para cuenta ID: {account_id}. Debería estar marcada/bloqueada.")
    return resultados_cuenta

async def iniciar_simulacion_fraude_global(simulation_id: str, ids_ataque: list[int]):
    """
    Orquesta la simulación de fraude ejecutando las ráfagas en paralelo 
    para todas las cuentas y consolida el reporte unificado en Redis.
    """
    logger.warning(f"🕵️‍♂️ Orquestador de Fraude activado para la simulación: {simulation_id}")
    
    # Creamos las corrutinas para mapear todas las cuentas de manera concurrente
    tareas = [ejecutar_rafaga_fraude(account_id) for account_id in ids_ataque]
    
    # Ejecutamos todas las ráfagas de las cuentas en paralelo y esperamos los resultados
    # 'resultados_totales' será una lista de listas: [[tx1, tx2...], [tx1, tx2...]]
    resultados_totales = await asyncio.gather(*tareas)
    
    # Aplanamos la lista de listas en un solo array de transacciones para el frontend
    cronograma_unificado = []
    for rafaga_cuenta in resultados_totales:
        cronograma_unificado.extend(rafaga_cuenta)
        
    # Calculamos métricas globales de todo el ataque
    exitosas = sum(1 for r in cronograma_unificado if r["status"] == "SUCCESS")
    bloqueadas = sum(1 for r in cronograma_unificado if r["status"] == "BLOCKED")
    fallidas = len(cronograma_unificado) - exitosas - bloqueadas

    # Estructuramos el JSON final
    reporte_final = {
        "status": "COMPLETED",
        "tipo_simulacion": "FRAUDE",
        "cuentas_atacadas": ids_ataque,
        "total_transacciones_enviadas": len(cronograma_unificado),
        "resumen": {
            "exitosas": exitosas,
            "bloqueadas_403_antifraude": bloqueadas,
            "fallidas_sistema": fallidas
        },
        "cronograma": cronograma_unificado
    }

    # Guardamos el consolidado en Redis una sola vez
    redis_db.setex(f"sim:{simulation_id}", 3600, json.dumps(reporte_final))
    logger.warning(f"🛑 Simulación de Fraude {simulation_id} consolidada en Redis con éxito.")

# Escenario de estrés: Ráfaga masiva desde una sola IP
async def ejecutar_rafaga_estres(simulation_id: str, cantidad_tx: int, cuentas_disponibles: list[int]):
    """Dispara ráfagas de transacciones concurrentes desde una sola IP usando múltiples cuentas."""
    logger.warning(f"🔥 INICIANDO PRUEBA DE ESTRÉS: {cantidad_tx} transacciones desde la IP {IP_STRESS_TARGET} 🔥")
    
    tareas = []
    for i in range(cantidad_tx):
        # Selecciona una cuenta aleatoria de las que están disponibles en el sistema
        cuenta_random = random.choice(cuentas_disponibles)
        
        tx = TransactionCreate(
            account_id=cuenta_random,
            ip=IP_STRESS_TARGET, # Mismo origen IP siempre
            amount=Decimal(round(random.uniform(10.00, 999.00), 2)), # Montos variables normales
            country=random.choice(PALSES_STRESS)
        )
        
        # Guardamos la corrutina en la lista para ejecutarlas en paralelo
        tareas.append(enviar_transaccion(tx))
        
        # Opcional: Un micro-retraso para no asfixiar el socket local del contenedor si son demasiadas
        if i % 20 == 0:
            await asyncio.sleep(0.1)
    # Dispara todas las solicitudes en paralelo hacia el Backend de FastAPI
    reportes = await asyncio.gather(*tareas)
    exitosas = sum(1 for r in reportes if r["status"] == "SUCCESS")
    bloqueadas = sum(1 for r in reportes if r["status"] == "BLOCKED")
    fallidas = len(reportes) - exitosas - bloqueadas
    logger.warning(f"🛑 Fin de la ráfaga de estrés. Se enviaron {cantidad_tx} peticiones.")

    reporte_final = {
        "tipo_simulacion": "ESTRES",
        "total_enviadas": cantidad_tx,
        "resumen": {
            "exitosas": exitosas,
            "bloqueadas_403": bloqueadas,
            "fallidas": fallidas
        },
        "cronograma": reportes
    }

    redis_db.setex(f"sim:{simulation_id}", 3600, json.dumps(reporte_final))

async def ejecutar_ataque_race_condition(account_id: int, balance_actual: Decimal) -> dict:
    """
    Dispara dos transacciones idénticas al mismo milisegundo por el monto TOTAL del saldo.
    Retorna el resultado detallado de ambas peticiones para dar feedback al Frontend.
    """
    logger.warning(f"⚔️ DETONANDO RACE CONDITION EN CUENTA ID: {account_id} (Saldo: ${balance_actual}) ⚔️")
    
    # Creamos dos payloads idénticos que intentan retirar el total del dinero al mismo tiempo
    tx1 = TransactionCreate(
        account_id=account_id,
        ip="192.168.50.99",
        amount=balance_actual,
        country="SV"
    )
    tx2 = tx1.model_copy() # Duplicado exacto del ataque
    
    # Modificaremos ligeramente el envío para capturar las respuestas HTTP del backend
    # Ejecutamos ambas tareas estrictamente en paralelo (mismo instante de tiempo)
    resultados = await asyncio.gather(
        enviar_transaccion_con_feedback(tx1),
        enviar_transaccion_con_feedback(tx2)
    )
    
    res_tx1, res_tx2 = resultados[0], resultados[1]
    
    # Analizamos qué ocurrió
    exito_tx1 = res_tx1["status"] in (200, 201)
    exito_tx2 = res_tx2["status"] in (200, 201)
    
    status_final = "PROTEGIDO"
    if exito_tx1 and exito_tx2:
        status_final = "VULNERABLE (¡Peligro! Ambas transacciones pasaron)"
    elif not exito_tx1 and not exito_tx2:
        status_final = "RECHAZADO_TOTAL (Ambas fallaron)"
        
    logger.info(f"📊 Resultado Race Condition Cuenta {account_id}: Tx1={res_tx1['status']}, Tx2={res_tx2['status']} -> {status_final}")
    
    return {
        "account_id": account_id,
        "saldo_inicial": str(balance_actual),
        "transaccion_1": res_tx1,
        "transaccion_2": res_tx2,
        "resultado_sistema": status_final
    }