# simulator/app/main.py
import asyncio
from contextlib import asynccontextmanager
import logging
import random
from app.config import settings
from fastapi import FastAPI, APIRouter, HTTPException, status
from app.types import FraudSimulationRequest
from app.client import obtener_cuentas_candidatas_fraude, garantizar_cuentas_iniciales, enviar_transaccion, obtener_cuentas_candidatas_stres
from app.scenarios import ejecutar_rafaga_fraude, generar_transaccion_normal
from app.types import StressSimulationRequest
from app.scenarios import ejecutar_rafaga_estres

# Ruta de la api
base_api_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1"

# Configurar logs legibles en la consola de Docker
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("simulator")

# Variable global para controlar la ejecución del bucle
simulador_activo = True

async def bucle_simulacion_normal():
    logger.info("Esperando estabilización del Backend e iniciando siembra...")
    await asyncio.sleep(5) # Margen de espera para asegurar que Postgres/FastAPI estén listos
    
    # FASE 1: Garantizar que existan los IDs de destino
    cuentas_disponibles = await garantizar_cuentas_iniciales()
    logger.info(f"Comenzando flujo de tráfico normal para las cuentas: {cuentas_disponibles}")
    
    # FASE 2: Tráfico orgánico constante
    while simulador_activo:
        import random
        cuenta_random = random.choice(cuentas_disponibles)
        
        # Generar y enviar payload
        tx = generar_transaccion_normal(cuenta_random)
        await enviar_transaccion(tx)
        
        # Esperar intervalo fijado en las configuraciones
        await asyncio.sleep(settings.INTERVALO_SEGUNDOS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Código que se ejecuta al arrancar el contenedor
    task = asyncio.create_task(bucle_simulacion_normal())
    yield
    # Código que se ejecuta al apagar el contenedor
    global simulador_activo
    simulador_activo = False
    task.cancel()
    logger.info("Simulador apagado correctamente.")

app = FastAPI(title="FinTech Guard - Simulator API", lifespan=lifespan)

@app.get("/status")
def get_status():
    return {"status": "running", "mode": "normal_traffic", "interval": settings.INTERVALO_SEGUNDOS}

@app.post(
    "/api/v1/simulations/fraud",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Simulación"]
)

async def activar_simulacion_fraude(payload: FraudSimulationRequest):
    """
    Endpoint activado desde el Frontend de React.
    Busca cuentas aptas y ejecuta ráfagas de transacciones de lavado en segundo plano.
    """
    # 1. Buscar cuentas en el backend con saldo >= $36,000 y Activas
    candidatas = await obtener_cuentas_candidatas_fraude()
    
    if not candidatas:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="No hay cuentas activas en el sistema con balance mayor o igual a $27,000 para procesar el fraude."
        )
        
    if len(candidatas) < payload.cantidad_cuentas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solicitaste {payload.cantidad_cuentas} cuentas, pero solo hay {len(candidatas)} que cumplen los requisitos."
        )
        
    # 2. Seleccionar cuentas aleatorias según la cantidad pedida
    cuentas_seleccionadas = random.sample(candidatas, payload.cantidad_cuentas)
    ids_ataque = [acc["id"] for acc in cuentas_seleccionadas]
    
    # 3. Lanzar los ataques en segundo plano de manera concurrente
    for account_id in ids_ataque:
        asyncio.create_task(ejecutar_rafaga_fraude(account_id))
        
    return {
        "message": f"Simulación de lavado iniciada en segundo plano.",
        "cuentas_afectadas": ids_ataque,
        "detalles": "Se enviarán 3 transacciones de $9,000 a cada cuenta elegida."
    }

@app.post(
    "/api/v1/simulations/stress",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Simulación"]
)

async def activar_simulacion_estres(payload: StressSimulationRequest):
    """
    Endpoint dinámico para pruebas de estrés. 
    Envía 'N' transacciones desde diferentes cuentas usando la misma IP.
    """
    base_api_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1"
    
    # 1. Obtener los IDs de cuentas disponibles en el sistema para poder variar
    cuentas_ids = await obtener_cuentas_candidatas_stres()

    if not cuentas_ids:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="No hay cuentas en el sistema para realizar la simulación de estrés."
        )

    # 2. Lanzar la ráfaga masiva en segundo plano
    asyncio.create_task(ejecutar_rafaga_estres(payload.cantidad_transacciones, cuentas_ids))
    
    return {
        "message": f"Prueba de estrés iniciada en segundo plano con {payload.cantidad_transacciones} peticiones.",
        "ip_atacante": "192.168.100.50",
        "cuentas_involucradas": cuentas_ids
    }