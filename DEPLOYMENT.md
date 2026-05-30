# FinTech Guard - Guía Completa de Deployment e Integración

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Arquitectura Completa](#arquitectura-completa)
3. [Deployment con Docker Compose](#deployment-con-docker-compose)
4. [Deployment Local (Sin Docker)](#deployment-local-sin-docker)
5. [Pruebas de Integración](#pruebas-de-integración)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Requisitos Previos

### Para Docker Compose (Recomendado):
```bash
- Docker Desktop (4.0+)
- Docker Compose (2.0+)
- Git
```

### Para Desarrollo Local:
```bash
- Python 3.11+
- Node.js 18+
- npm o pnpm
- PostgreSQL 18 (opcional, puedes usar Docker solo para BD)
- Redis 7 (opcional, puedes usar Docker solo para caché)
```

---

## 🏗️ Arquitectura Completa

```
┌─────────────────────────────────────────────────────────────────┐
│                    FINTECH GUARD STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend Layer (React 19 + TypeScript)                        │
│  ├── Alerts Interactivas con Botones Ejecutables              │
│  ├── Real-time Updates vía WebSocket                           │
│  ├── REST API Calls para Mitigación                            │
│  └── Componentes: Alert, FlaggedTransactionTable               │
│                                                                  │
├─ CORS + Middleware ─────────────────────────────────────────┤
│                                                                  │
│  Backend Layer (FastAPI 0.115.6)                              │
│  ├── /api/v1/transactions (POST)                              │
│  ├── /api/v1/security/ban-ip (POST/DELETE)                    │
│  ├── /api/v1/security/block-account (POST)                    │
│  ├── /api/v1/audit/resolve (POST)                             │
│  ├── /ws/transactions (WebSocket)                              │
│  └── /metrics (Prometheus)                                     │
│                                                                  │
├─ Services Layer ────────────────────────────────────────────┤
│  ├── TransactionService: Procesa transacciones               │
│  ├── AntifraudService: Detecta anomalías                      │
│  ├── AuditService: Resuelve flagged transactions              │
│  ├── SecurityMitigationService: Bans y blocks                 │
│  └── TransactionAuditService: Auditoría detallada             │
│                                                                  │
├─ Data Layer ────────────────────────────────────────────────┤
│  ├── PostgreSQL 18 (puerto 5433)                              │
│  │   ├── account                                               │
│  │   ├── transaction                                           │
│  │   ├── flagged_transaction                                   │
│  │   └── audit_log                                             │
│  ├── Redis 7 (puerto 6379)                                     │
│  │   ├── Fraud Detection Cache                                │
│  │   ├── IP Ban List                                           │
│  │   └── Audit Trail                                           │
│  └── Simulator (puerto 8001)                                   │
│      └── Genera transacciones cada segundo                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🐳 Deployment con Docker Compose

### 1. Preparar el Entorno

```powershell
# En PowerShell

# Crear archivo .env en la raíz del proyecto
@"
POSTGRES_DSN=postgresql+asyncpg://postgres:fintech_guard@db_postgres:5433/fintech_db
POSTGRES_PASSWORD=fintech_guard
REDIS_DSN=redis://db_redis:6379/0
APP_ENV=development
LOG_LEVEL=INFO
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_SIMULATOR_URL=http://localhost:8001
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
REDIS_SOCKET_TIMEOUT=5
REDIS_SOCKET_CONNECT_TIMEOUT=5
"@ | Out-File -Encoding UTF8 .env
```

### 2. Compilar y Levantar Servicios

```powershell
# Compilar imágenes Docker
docker-compose build --no-cache

# Levantar todos los servicios
docker-compose up -d

# Verificar que los servicios estén corriendo
docker-compose ps

# Ver logs en vivo
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f fintech_backend
docker-compose logs -f fintech-frontend
docker-compose logs -f fintech_simulator
```

### 3. Verificar Servicios

```powershell
# Backend API (OpenAPI)
curl http://localhost:8000/docs

# Frontend
curl http://localhost:5173

# PostgreSQL
# Desde PowerShell (si tienes psql):
psql -h localhost -p 5433 -U postgres -d fintech_db

# Redis
redis-cli -p 6379 ping

# Simulator
curl http://localhost:8001
```

### 4. Detener Servicios

```powershell
# Detener servicios sin eliminar volúmenes
docker-compose stop

# Detener y eliminar contenedores y redes
docker-compose down

# Detener, eliminar todo incluyendo volúmenes
docker-compose down -v
```

---

## 💻 Deployment Local (Sin Docker)

### 1. Setup Backend

```powershell
# Crear virtual environment
python -m venv venv

# Activar virtual environment
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Levantar Backend (en terminal 1)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Setup Frontend

```powershell
# En terminal 2
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (Vite)
npm run dev
```

### 3. Setup Simulador

```powershell
# En terminal 3
cd simulator

# Activar venv del proyecto principal si es necesario
..\venv\Scripts\Activate.ps1

# Instalar dependencias del simulador
pip install -r requirements.txt

# Ejecutar simulador
python -m app
```

### 4. Variables de Entorno

```powershell
# Crear .env en raíz del proyecto
@"
POSTGRES_DSN=postgresql+asyncpg://postgres:fintech_guard@localhost:5433/fintech_db
REDIS_DSN=redis://localhost:6379/0
POSTGRES_PASSWORD=fintech_guard
APP_ENV=development
LOG_LEVEL=DEBUG
"@ | Out-File -Encoding UTF8 .env
```

---

## 🧪 Pruebas de Integración

### 1. Crear una Transacción

```powershell
$body = @{
    account_id = 1
    ip = "192.168.1.1"
    amount = 9500.00
    country = "SV"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/transactions" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | ConvertTo-Json
```

### 2. Auditar Transacción

```powershell
$body = @{
    flagged_transaction_id = 1
    decision = "Aprobado"
    auditor_notes = "Manual verification completed"
    auditor_id = 1
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/audit/resolve" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | ConvertTo-Json
```

### 3. Banear IP

```powershell
$body = @{
    ip_address = "192.168.1.100"
    reason = "Multiple fraud attempts"
    duration_hours = 24
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/security/ban-ip" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | ConvertTo-Json
```

### 4. Bloquear Cuenta

```powershell
$body = @{
    account_id = 1
    reason = "Suspected account compromise"
    auditor_id = 1
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/security/block-account" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | ConvertTo-Json
```

### 5. Probar WebSocket

```powershell
# Instalar wscat globalmente
npm install -g wscat

# Conectarse al endpoint de WebSocket
wscat -c ws://localhost:8000/ws/transactions

# Verás transacciones en tiempo real en formato JSON
```

### 6. Ver Métricas de Prometheus

```powershell
# Acceder a las métricas en formato Prometheus
curl http://localhost:8000/metrics
```

---

## 🎨 Flujo de Interacción Completo

### Paso 1: Usuario Selecciona Transacción en Frontend
```
Click en tabla → Expande detalles → Muestra botones de acción
```

### Paso 2: Usuario Hace Click en Botón (Ej. "Auditar Transacción")
```
Frontend → useMutation hook → POST /api/v1/audit/resolve
```

### Paso 3: Backend Procesa Acción
```
TransactionAuditService.audit_transaction()
   ↓
Actualiza FlaggedTransaction en PostgreSQL
   ↓
Registra en Redis audit trail
   ↓
Retorna TransactionAuditResponse
```

### Paso 4: Frontend Recibe Respuesta
```
✓ Success Alert → Remueve transacción de lista → WebSocket notifica a otros clientes
✗ Error Alert → Muestra mensaje de error → Usuario puede reintentar
```

### Paso 5: WebSocket Notifica Cambios
```
Backend → Broadcast via WebSocket → Todos los clientes actualizan UI en tiempo real
```

---

## 📊 Componentes React Creados

### 1. `Alert.tsx`
- Componentes reutilizables de alertas
- Soporta: success, error, warning, info
- Acciones ejecutables dentro de alertas
- Auto-dismissible

### 2. `FlaggedTransactionTable.tsx`
- Tabla expandible de transacciones flagged
- Botones interactivos:
  - ✓ Auditar Transacción
  - 🔒 Banear IP
  - 🚫 Bloquear Cuenta
- Estado de carga y manejo de errores

### 3. `useMutation.ts`
- Hook custom para peticiones REST
- Manejo de states: pending, error, data
- Callbacks: onSuccess, onError

### 4. `api.ts`
- Cliente HTTP centralizado
- Métodos para todos los endpoints
- Manejo de errores global

---

## 🔌 Endpoints Disponibles

| Método | Endpoint | Descripción | Body |
|--------|----------|-------------|------|
| POST | `/api/v1/transactions` | Crear transacción | `{account_id, ip, amount, country}` |
| POST | `/api/v1/audit/resolve` | Auditar transacción | `{flagged_transaction_id, decision, auditor_notes}` |
| POST | `/api/v1/security/ban-ip` | Banear IP | `{ip_address, reason, duration_hours}` |
| DELETE | `/api/v1/security/ban-ip/{ip}` | Remover ban | - |
| POST | `/api/v1/security/block-account` | Bloquear cuenta | `{account_id, reason, auditor_id}` |
| POST | `/api/v1/security/unblock-account` | Desbloquear cuenta | `{account_id, auditor_id}` |
| WS | `/ws/transactions` | WebSocket transacciones | - |
| GET | `/metrics` | Métricas Prometheus | - |
| GET | `/docs` | OpenAPI Swagger | - |

---

## 🐛 Troubleshooting

### Error: "Cannot connect to Docker daemon"
```
Solución: Asegúrate que Docker Desktop esté corriendo
- En Windows: Abre Docker Desktop desde el Start Menu
```

### Error: "Port 8000 already in use"
```
Solución: Liberar el puerto
powershell: netstat -ano | findstr :8000
Luego: taskkill /PID <PID> /F
```

### Error: "No connection to PostgreSQL"
```
Solución: Verificar que PostgreSQL está corriendo
docker-compose ps
# Si no está running:
docker-compose up -d db_postgres
```

### Error: "CORS error" en frontend
```
Solución: Verificar que CORS está configurado correctamente en main.py
- Asegúrate que tu frontend URL está en cors_origins
- Reinicia el backend
```

### Error: "WebSocket connection failed"
```
Solución: 
- Verificar que backend está corriendo
- Revisar que VITE_WS_URL está correcto en .env
- Revisar console del navegador para más detalles
```

### Base de datos vacía después de levantar
```
Solución:
- El script init.sql se ejecuta automáticamente
- Si no funcionó, ejecutar manualmente:
  docker exec fintech_postgres psql -U postgres -d fintech_db -f /docker-entrypoint-initdb.d/init.sql
```

---

## ✅ Checklist de Validación

- [ ] Docker Compose levanta sin errores
- [ ] Todos los servicios están en estado "running"
- [ ] Frontend accesible en http://localhost:5173
- [ ] Backend API accesible en http://localhost:8000/docs
- [ ] PostgreSQL conecta en puerto 5433
- [ ] Redis conecta en puerto 6379
- [ ] Simulador envía transacciones cada segundo
- [ ] WebSocket recibe datos en tiempo real
- [ ] Botones de acción funcionan correctamente
- [ ] Peticiones REST retornan respuestas válidas
- [ ] Alertas se muestran después de acciones
- [ ] BD se actualiza después de cambios
- [ ] Caché Redis se sincroniza
- [ ] Prometheus recolecta métricas
- [ ] Logs muestran ejecución correcta

---

## 📝 Comandos Útiles

```powershell
# Ver todos los logs en tiempo real
docker-compose logs -f

# Ejecutar comando en contenedor
docker-compose exec fintech_backend uvicorn main:app --reload

# Acceder a shell del contenedor
docker-compose exec fintech_postgres bash

# Rebuild solo un servicio
docker-compose build --no-cache fintech_backend

# Scale de un servicio (si aplica)
docker-compose up -d --scale fintech_backend=2

# Ver estado de salud
docker-compose ps

# Eliminar imágenes dangling
docker image prune -a
```

---

## 📞 Soporte

Para más información sobre arquitectura, ver:
- [ARCHITECTURE.md](ARCHITECTURE.md) - Documentación técnica completa
- [README.md](README.md) - Descripción general del proyecto
- [api/schemas.py] - Esquemas de validación
- [services/] - Lógica de negocio

