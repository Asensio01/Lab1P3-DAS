# FinTech Guard - Arquitectura Completa de Integración

## 1. ANÁLISIS ARQUITECTÓNICO DEL SISTEMA

### 1.1 Componentes Principales

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  - Alertas Interactivas con Botones Ejecutables                │
│  - WebSocket para Actualizaciones Real-time                     │
│  - Peticiones REST para Acciones de Mitigación                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
    REST API    WebSocket    REST API
    (GET/POST)  (Real-time)  (POST/PUT)
        │            │            │
┌───────▼────────────▼────────────▼─────┐
│         BACKEND (FastAPI)              │
│  ✓ CORS Configurado                   │
│  ✓ Endpoints de Mitigación            │
│  ✓ WebSocket Manager                  │
│  ✓ Servicios de Auditoría y Antifraud │
└───────┬────────────┬────────────┬─────┘
        │            │            │
┌───────▼──┐  ┌──────▼──┐  ┌─────▼──────┐
│PostgreSQL│  │  Redis  │  │ Simulador  │
│  (BD)    │  │(Cache)  │  │  (Python)  │
└──────────┘  └─────────┘  └────────────┘
```

### 1.2 Flujo de Datos

#### Flujo 1: Transmisión de Transacciones (Real-time)
```
Simulador → Backend WebSocket → Frontend React
└─ Emite transacciones cada segundo
└─ Broadcast a todos los clientes conectados
└─ Frontend recibe y renderiza dinámicamente
```

#### Flujo 2: Acciones de Mitigación (Sincrónico)
```
Frontend (Botón Click)
    ↓
POST /api/v1/security/mitigations/{action}
    ↓
Backend Service (Audit/AntifraudService)
    ↓
PostgreSQL/Redis (Actualización de datos)
    ↓
Response JSON con confirmación
    ↓
Frontend actualiza estado local
```

#### Flujo 3: Auditoría Interactiva
```
Frontend (Tabla de Transacciones Flagged)
    ↓
Click en Botón: "Auditar Intento DB" / "Aplicar Ban IP"
    ↓
POST /api/v1/audit/mitigate
    ↓
AuditService.mitigate_transaction()
    ↓
PostgreSQL: UPDATE flagged_transaction SET state = 'Aprobado/Bloqueado'
    ↓
Response: { success: true, transaction_id: X, new_state: "Aprobado" }
```

### 1.3 Modelos de Base de Datos (Existentes)

```sql
-- Account: Cuentas bancarias
id | uuid | user_name | user_info | state | balance | version

-- Transaction: Transacciones procesadas
id | account_id | amount | country | ip | state | timestamp | anomaly_type

-- FlaggedTransaction: Transacciones bajo revisión
id | transaction_id | account_id | anomaly | state | auditor_notes | timestamp | resolved_at

-- AuditLog: Registro de auditoría
id | transaction_id | action | auditor_id | notes | timestamp
```

### 1.4 Stack Tecnológico

| Componente  | Tecnología          | Versión  |
|------------|-------------------|----------|
| Frontend   | React 19           | 19.0.0   |
| UI         | TailwindCSS        | 3.4.13   |
| Query      | TanStack Query     | 5.56.2   |
| Backend    | FastAPI            | 0.115.6  |
| ORM        | SQLAlchemy         | 2.0.36   |
| BD         | PostgreSQL         | 18       |
| Cache      | Redis              | 7        |
| WebSocket  | FastAPI WebSocket  | Built-in |
| Monitoring | Prometheus         | 7.0.0    |

---

## 2. CONFIGURACIÓN DE CORS Y COMUNICACIÓN

### 2.1 CORS Policy (Backend)
```python
from fastapi.middleware.cors import CORSMiddleware

CORS_ORIGINS = [
    "http://localhost:5173",      # Frontend Dev
    "http://localhost:3000",       # Frontend Alt
    "http://0.0.0.0:5173",         # Docker
    "http://fintech-frontend:5173" # Docker Compose
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2.2 WebSocket Endpoints
```
ws://localhost:8000/ws/transactions    # Transmisión en vivo
ws://localhost:8000/ws/audit           # Eventos de auditoría
```

---

## 3. ENDPOINTS DE MITIGACIÓN (A IMPLEMENTAR)

### 3.1 Ban de IP
```
POST /api/v1/security/ban-ip
{
  "ip_address": "192.168.1.100",
  "reason": "Multiple fraud attempts",
  "duration_hours": 24
}
Response: { success: true, ip: "...", banned_at: "..." }
```

### 3.2 Bloqueo de Cuenta
```
POST /api/v1/security/block-account
{
  "account_id": 123,
  "reason": "Suspected compromise",
  "auditor_id": 1
}
Response: { success: true, account_id: 123, state: "Bloqueado" }
```

### 3.3 Auditoría de Transacción
```
POST /api/v1/audit/resolve
{
  "flagged_transaction_id": 456,
  "decision": "Aprobado" | "Bloqueado",
  "auditor_notes": "Verified legitimate transaction"
}
Response: { success: true, transaction_id: 456, new_state: "Aprobado" }
```

---

## 4. FLUJO DE INTEGRACIÓN COMPLETO

### 4.1 Secuencia de Inicialización
```
1. Docker Compose levanta:
   - PostgreSQL (puerto 5433)
   - Redis (puerto 6379)
   - Backend FastAPI (puerto 8000)
   - Frontend React (puerto 5173)
   - Simulador Python (puerto 8001)

2. Frontend se conecta a:
   - ws://localhost:8000/ws/transactions

3. Backend carga Servicios:
   - AccountService, TransactionService, AuditService, AntifraudService

4. Simulador comienza a emitir transacciones:
   - POST http://localhost:8000/api/v1/transactions

5. Frontend recibe en WebSocket:
   - Renderiza en tabla de "Flagged Transacciones"
   - Habilita botones de mitigación

6. Usuario hace click en botón:
   - POST /api/v1/security/mitigations/{action}
   - Backend procesa y actualiza BD
   - WebSocket notifica cambios a todos los clientes
```

### 4.2 Estados de Transacción
```
┌──────────────┐
│  Simulada    │  (Generada por simulador)
└──────┬───────┘
       │
┌──────▼──────────────┐
│  Aprobada/Rechazada │  (Procesada por TransactionService)
└──────┬──────────────┘
       │
    ¿Anomalía?
    ╱            ╲
   SÍ             NO
   │              │
   │         Transacción Normal
   │         (Guardada en BD)
   │
┌──────▼──────────┐
│ Flagged (Redis) │  (Marcada por AntifraudService)
└──────┬──────────┘
       │
    ┌──────────────────┐
    │ Bajo Revisión    │  (AuditService)
    └──────┬───────────┘
           │
      ┌────┴────┐
      │          │
   Aprobado   Bloqueado
      │          │
      └────┬─────┘
           │
      ┌────▼──────────┐
      │ Finalizado    │
      │ (Auditoría)   │
      └───────────────┘
```

---

## 5. COMANDOS DE DEPLOYMENT

### 5.1 Desarrollo Local (sin Docker)
```bash
# Terminal 1: Backend
cd Lab1P3-Herbert
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Terminal 3: Simulador
cd simulator
pip install -r requirements.txt
python -m app
```

### 5.2 Producción con Docker Compose
```bash
# Crear .env con variables
cat > .env << EOF
POSTGRES_DSN=postgresql+asyncpg://postgres:fintech_guard@localhost:5433/fintech_db
REDIS_DSN=redis://localhost:6379/0
POSTGRES_PASSWORD=fintech_guard
LOG_LEVEL=INFO
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
EOF

# Levantar stack completo
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar stack
docker-compose down
```

### 5.3 Verificación de Conectividad
```bash
# Verificar Backend
curl http://localhost:8000/docs

# Verificar Frontend
curl http://localhost:5173

# Verificar PostgreSQL
psql -h localhost -p 5433 -U postgres -d fintech_db

# Verificar Redis
redis-cli -p 6379 ping

# Verificar WebSocket (require wscat)
npm install -g wscat
wscat -c ws://localhost:8000/ws/transactions
```

---

## 6. MATRIZ DE INTEGRACIÓN

| Componente      | Protocolo  | Puerto | Autenticación | Real-time |
|-----------------|-----------|--------|---------------|-----------|
| Frontend        | HTTP/WS   | 5173   | No            | Sí (WS)  |
| Backend API     | HTTP/REST | 8000   | No (MVP)      | No       |
| WebSocket       | WS        | 8000   | No (MVP)      | Sí       |
| PostgreSQL      | TCP       | 5433   | Usuario/Pass  | No       |
| Redis           | TCP       | 6379   | No            | No       |
| Simulador       | HTTP      | 8001   | No            | No       |
| Prometheus      | HTTP      | 9090   | No            | No       |

---

## 7. CHECKLIST DE INTEGRACIÓN

- [ ] CORS configurado en FastAPI
- [ ] Middleware de CORS activo
- [ ] Endpoints de mitigación creados
- [ ] WebSocket conectado en Frontend
- [ ] Botones interactivos en tabla de Logs
- [ ] Peticiones REST funcionando
- [ ] Base de datos actualizada después de acciones
- [ ] Redis cache sincronizado
- [ ] Docker Compose levanta todo sin errores
- [ ] Comunicación bidireccional verificada
- [ ] Prometheus recolecta métricas
- [ ] Simulador emite transacciones en vivo

