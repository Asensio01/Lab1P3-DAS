# 🎯 FINTECH GUARD - GUÍA RÁPIDA DE EJECUCIÓN

## 📍 Ubicación del Proyecto
```
c:\Users\odali\OneDrive\Escritorio\Universidad\CICLO 9\Sabados\Fintech Guard\Lab1P3-Herbert
```

## 🚀 OPCIÓN 1: Deployment Completo con Docker (RECOMENDADO)

### Paso 1: Preparar Ambiente
```powershell
cd "c:\Users\odali\OneDrive\Escritorio\Universidad\CICLO 9\Sabados\Fintech Guard\Lab1P3-Herbert"

# Ejecutar script de deployment
.\deploy.ps1 setup
```

Este comando:
- ✓ Configura variables de entorno (.env)
- ✓ Compila imágenes Docker
- ✓ Levanta todos los servicios
- ✓ Valida conectividad
- ✓ Prueba endpoints de API

### Paso 2: Acceder a la Aplicación

**Frontend:**
```
http://localhost:5173
```

**Backend API (Swagger):**
```
http://localhost:8000/docs
```

**WebSocket (para pruebas):**
```
ws://localhost:8000/ws/transactions
```

---

## 🎮 OPCIÓN 2: Desarrollo Local (Sin Docker)

### Terminal 1: Backend
```powershell
cd "c:\Users\odali\OneDrive\Escritorio\Universidad\CICLO 9\Sabados\Fintech Guard\Lab1P3-Herbert"

# Setup (solo primera vez)
.\deploy.ps1 local-setup

# Iniciar Backend
.\deploy.ps1 local-backend
```

### Terminal 2: Frontend
```powershell
cd "c:\Users\odali\OneDrive\Escritorio\Universidad\CICLO 9\Sabados\Fintech Guard\Lab1P3-Herbert"
.\deploy.ps1 local-frontend
```

### Terminal 3: Simulador
```powershell
cd "c:\Users\odali\OneDrive\Escritorio\Universidad\CICLO 9\Sabados\Fintech Guard\Lab1P3-Herbert"
.\deploy.ps1 local-simulator
```

---

## 🧪 Pruebas de Integración

### Opción A: Script Automático (Python)
```powershell
# Instalar dependencias de testing (primera vez)
pip install httpx asyncpg redis websockets

# Ejecutar suite completa de tests
python test_integration.py
```

### Opción B: Pruebas Manuales

#### Crear Transacción
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
    -Body $body
```

#### Auditar Transacción
```powershell
$body = @{
    flagged_transaction_id = 1
    decision = "Aprobado"
    auditor_notes = "Verified"
    auditor_id = 1
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/audit/resolve" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

#### Banear IP
```powershell
$body = @{
    ip_address = "192.168.1.100"
    reason = "Fraudulent activity"
    duration_hours = 24
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/security/ban-ip" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

#### Bloquear Cuenta
```powershell
$body = @{
    account_id = 1
    reason = "Suspicious activity"
    auditor_id = 1
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/v1/security/block-account" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

#### Probar WebSocket
```powershell
# Instalar wscat
npm install -g wscat

# Conectar al WebSocket
wscat -c ws://localhost:8000/ws/transactions
```

---

## 📊 Monitoring y Logs

### Ver Logs de Docker
```powershell
.\deploy.ps1 logs
```

### Ver Logs de Servicio Específico
```powershell
docker-compose logs -f fintech_backend
docker-compose logs -f fintech-frontend
docker-compose logs -f fintech_simulator
```

### Acceder a Métricas Prometheus
```
http://localhost:8000/metrics
```

---

## 🛑 Detener Servicios

```powershell
# Detener sin eliminar volúmenes
docker-compose stop

# Detener y eliminar contenedores
docker-compose down

# Limpiar todo (contenedores, volúmenes, imágenes)
.\deploy.ps1 clean
```

---

## 📁 Archivos Principales Modificados/Creados

### Backend (FastAPI)
- ✅ `main.py` - CORS configurado
- ✅ `api/v1/routes.py` - Nuevos endpoints de seguridad
- ✅ `api/schemas.py` - Esquemas de mitigación
- ✅ `api/dependencies.py` - Inyección de dependencias
- ✅ `services/security.py` - Servicio de mitigación de seguridad
- ✅ `services/security.py` - Servicio de auditoría extendida

### Frontend (React)
- ✅ `src/App.tsx` - App mejorada con alertas
- ✅ `src/components/Alert.tsx` - Componente de alertas
- ✅ `src/components/FlaggedTransactionTable.tsx` - Tabla interactiva
- ✅ `src/hooks/useMutation.ts` - Hook para mutaciones REST
- ✅ `src/lib/api.ts` - Cliente API centralizado

### Configuración y Deployment
- ✅ `deploy.ps1` - Script PowerShell para Windows
- ✅ `deploy.sh` - Script Bash para Linux/Mac
- ✅ `test_integration.py` - Suite de testing completa
- ✅ `ARCHITECTURE.md` - Documentación técnica
- ✅ `DEPLOYMENT.md` - Guía de deployment

---

## 🔍 Verificación de Integración

### Checklist Completo

```
BACKEND:
  ✓ CORS configurado (main.py)
  ✓ Endpoints de mitigación activos
  ✓ WebSocket transmitiendo en vivo
  ✓ Servicios inyectados correctamente
  ✓ Respuestas JSON válidas

FRONTEND:
  ✓ React 19 funcionando
  ✓ Componentes interactivos
  ✓ Botones ejecutables
  ✓ Alertas dinámicas
  ✓ Peticiones REST conectadas

BD:
  ✓ PostgreSQL inicializado
  ✓ Tablas creadas
  ✓ Datos persistidos
  ✓ Transacciones ACID

CACHÉ:
  ✓ Redis accesible
  ✓ Bans de IP almacenados
  ✓ Audit trail registrado

REAL-TIME:
  ✓ WebSocket conectado
  ✓ Simulador emitiendo datos
  ✓ Frontend recibiendo en vivo
  ✓ Actualizaciones sincronizadas

TESTING:
  ✓ Suite de tests ejecutada
  ✓ Endpoints validados
  ✓ Manejo de errores OK
  ✓ CORS headers presentes
```

---

## 🆘 Troubleshooting Rápido

### Error: "Port already in use"
```powershell
# Encontrar proceso usando puerto 8000
netstat -ano | findstr :8000

# Matar proceso
taskkill /PID <PID> /F
```

### Error: "Docker daemon not running"
```powershell
# Iniciar Docker Desktop
# O ejecutar manualmente:
"C:\Program Files\Docker\Docker\Docker.exe"
```

### Error: "Cannot connect to PostgreSQL"
```powershell
# Verificar que PostgreSQL está en Docker
docker-compose ps

# Si no está corriendo:
docker-compose up -d db_postgres
```

### Error: "CORS error" en navegador
```powershell
# Reiniciar backend
docker-compose restart fintech_backend

# Verificar que VITE_API_BASE_URL es correcto en .env
```

---

## 📞 Contacto y Recursos

- Documentación Técnica: `ARCHITECTURE.md`
- Guía de Deployment: `DEPLOYMENT.md`
- Suite de Tests: `test_integration.py`
- Script de Deploy: `deploy.ps1`

---

## ⏱️ Tiempos Esperados

- Setup con Docker: 3-5 minutos
- Setup local: 2-3 minutos
- Suite de tests: 10-15 segundos
- Primera transacción: <1 segundo
- Ban de IP: <1 segundo
- Auditoría de transacción: <1 segundo

---

## 🎊 ¡Listo para usar!

Una vez que todo esté levantado, dirígete a:
```
http://localhost:5173
```

Verás:
- Dashboard con métricas en vivo
- Tabla de transacciones flagged
- Botones interactivos para cada acción
- Alertas de confirmación
- Logs de eventos
- Estado del sistema

¡Disfruta tu sistema FinTech Guard completo y funcional!
