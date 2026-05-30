#!/usr/bin/env bash
# FinTech Guard - Deployment & Testing Script
# Proporciona todos los comandos necesarios para levantar y probar el sistema completo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       FINTECH GUARD - DEPLOYMENT & TESTING            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# ==================== SETUP FASE ====================

setup_env() {
    echo -e "\n${YELLOW}[1/6] Configurando variables de entorno...${NC}"
    
    # Crear archivo .env si no existe
    if [ ! -f .env ]; then
        cat > .env << 'EOF'
# PostgreSQL Configuration
POSTGRES_DSN=postgresql+asyncpg://postgres:fintech_guard@db_postgres:5432/fintech_db
POSTGRES_PASSWORD=fintech_guard

# Redis Configuration
REDIS_DSN=redis://db_redis:6379/0

# Application Configuration
APP_ENV=development
LOG_LEVEL=INFO

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_SIMULATOR_URL=http://localhost:8001

# Database Pool Settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

# Redis Connection Settings
REDIS_SOCKET_TIMEOUT=5
REDIS_SOCKET_CONNECT_TIMEOUT=5
EOF
        echo -e "${GREEN}✓ Archivo .env creado${NC}"
    else
        echo -e "${GREEN}✓ Archivo .env ya existe${NC}"
    fi
}

# ==================== DOCKER DEPLOYMENT ====================

docker_build() {
    echo -e "\n${YELLOW}[2/6] Compilando imágenes Docker...${NC}"
    docker-compose build --no-cache
    echo -e "${GREEN}✓ Imágenes compiladas exitosamente${NC}"
}

docker_start() {
    echo -e "\n${YELLOW}[3/6] Levantando servicios Docker...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✓ Servicios iniciados${NC}"
    
    # Wait for services to be healthy
    echo -e "\n${YELLOW}Esperando que los servicios estén saludables...${NC}"
    sleep 5
    
    # Check health
    echo -e "${BLUE}Estado de servicios:${NC}"
    docker-compose ps
}

docker_stop() {
    echo -e "\n${YELLOW}Deteniendo servicios Docker...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ Servicios detenidos${NC}"
}

# ==================== LOCAL DEVELOPMENT ====================

local_setup() {
    echo -e "\n${YELLOW}[SETUP LOCAL] Configurando entorno local...${NC}"
    
    # Backend setup
    echo -e "\n${BLUE}Backend Setup:${NC}"
    if [ ! -d "venv" ]; then
        python -m venv venv
        echo -e "${GREEN}✓ Virtual environment creado${NC}"
    fi
    
    source venv/Scripts/activate 2>/dev/null || . venv/bin/activate
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Backend dependencies instaladas${NC}"
    
    # Frontend setup
    echo -e "\n${BLUE}Frontend Setup:${NC}"
    cd frontend
    npm install
    echo -e "${GREEN}✓ Frontend dependencies instaladas${NC}"
    cd ..
}

local_backend() {
    echo -e "\n${YELLOW}Iniciando Backend (FastAPI)...${NC}"
    source venv/Scripts/activate 2>/dev/null || . venv/bin/activate
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
}

local_frontend() {
    echo -e "\n${YELLOW}Iniciando Frontend (Vite)...${NC}"
    cd frontend
    npm run dev
}

local_simulator() {
    echo -e "\n${YELLOW}Iniciando Simulador...${NC}"
    cd simulator
    source ../venv/Scripts/activate 2>/dev/null || . ../venv/bin/activate
    python -m app
}

# ==================== TESTING & VALIDATION ====================

test_connectivity() {
    echo -e "\n${YELLOW}[4/6] Validando conectividad de servicios...${NC}"
    
    # Test Backend API
    echo -e "\n${BLUE}Backend API (http://localhost:8000):${NC}"
    if curl -s http://localhost:8000/docs > /dev/null; then
        echo -e "${GREEN}✓ Backend accesible${NC}"
    else
        echo -e "${RED}✗ Backend no accesible${NC}"
    fi
    
    # Test Frontend
    echo -e "\n${BLUE}Frontend (http://localhost:5173):${NC}"
    if curl -s http://localhost:5173 > /dev/null; then
        echo -e "${GREEN}✓ Frontend accesible${NC}"
    else
        echo -e "${RED}✗ Frontend no accesible${NC}"
    fi
    
    # Test WebSocket
    echo -e "\n${BLUE}WebSocket (ws://localhost:8000/ws/transactions):${NC}"
    echo -e "${YELLOW}Intenta conectarte con: wscat -c ws://localhost:8000/ws/transactions${NC}"
    
    # Test PostgreSQL
    echo -e "\n${BLUE}PostgreSQL (localhost:5433):${NC}"
    if command -v psql &> /dev/null; then
        if PGPASSWORD=fintech_guard psql -h localhost -p 5433 -U postgres -d fintech_db -c "SELECT version();" 2>/dev/null; then
            echo -e "${GREEN}✓ PostgreSQL conectado${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ psql no instalado, saltando prueba${NC}"
    fi
    
    # Test Redis
    echo -e "\n${BLUE}Redis (localhost:6379):${NC}"
    if command -v redis-cli &> /dev/null; then
        if redis-cli -p 6379 ping 2>/dev/null | grep -q "PONG"; then
            echo -e "${GREEN}✓ Redis conectado${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ redis-cli no instalado, saltando prueba${NC}"
    fi
}

test_api_endpoints() {
    echo -e "\n${YELLOW}[5/6] Probando endpoints de la API...${NC}"
    
    # Test POST /api/v1/transactions
    echo -e "\n${BLUE}Creando transacción de prueba...${NC}"
    RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/transactions \
        -H "Content-Type: application/json" \
        -d '{
            "account_id": 1,
            "ip": "192.168.1.1",
            "amount": 9500.00,
            "country": "SV"
        }')
    echo -e "${BLUE}Response:${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    # Test POST /api/v1/security/ban-ip
    echo -e "\n${BLUE}Probando Ban IP endpoint...${NC}"
    RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/security/ban-ip \
        -H "Content-Type: application/json" \
        -d '{
            "ip_address": "192.168.1.100",
            "reason": "Fraudulent activity",
            "duration_hours": 24
        }')
    echo -e "${BLUE}Response:${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    # Test Audit endpoint
    echo -e "\n${BLUE}Probando endpoint de auditoría...${NC}"
    RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/audit/resolve \
        -H "Content-Type: application/json" \
        -d '{
            "flagged_transaction_id": 1,
            "decision": "Aprobado",
            "auditor_notes": "Manual verification completed"
        }')
    echo -e "${BLUE}Response:${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
}

test_websocket() {
    echo -e "\n${YELLOW}[6/6] Configurando prueba de WebSocket...${NC}"
    echo -e "${BLUE}Para probar WebSocket, ejecuta en otra terminal:${NC}"
    echo -e "${YELLOW}npm install -g wscat${NC}"
    echo -e "${YELLOW}wscat -c ws://localhost:8000/ws/transactions${NC}"
}

view_logs() {
    echo -e "\n${BLUE}Visualizando logs de servicios...${NC}"
    docker-compose logs -f
}

# ==================== MAIN MENU ====================

show_menu() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}OPCIONES DISPONIBLES:${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo "1. Setup completo con Docker"
    echo "2. Setup local (sin Docker)"
    echo "3. Iniciar Backend (local)"
    echo "4. Iniciar Frontend (local)"
    echo "5. Iniciar Simulador (local)"
    echo "6. Validar conectividad de servicios"
    echo "7. Probar endpoints de API"
    echo "8. Ver logs de Docker"
    echo "9. Detener servicios Docker"
    echo "0. Salir"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

# ==================== DEPLOYMENT COMPLETE ====================

case "${1:-0}" in
    1)
        setup_env
        docker_build
        docker_start
        sleep 10
        test_connectivity
        test_api_endpoints
        test_websocket
        ;;
    2)
        setup_env
        local_setup
        echo -e "\n${GREEN}Setup local completado.${NC}"
        echo -e "${YELLOW}Ahora ejecuta los servicios en terminales separadas:${NC}"
        echo "Terminal 1: $0 3  # Backend"
        echo "Terminal 2: $0 4  # Frontend"
        echo "Terminal 3: $0 5  # Simulator"
        ;;
    3)
        local_backend
        ;;
    4)
        local_frontend
        ;;
    5)
        local_simulator
        ;;
    6)
        test_connectivity
        ;;
    7)
        test_api_endpoints
        ;;
    8)
        view_logs
        ;;
    9)
        docker_stop
        ;;
    0)
        echo -e "${BLUE}¡Hasta luego!${NC}"
        exit 0
        ;;
    *)
        show_menu
        echo -e "\n${YELLOW}Uso: $0 [opción]${NC}"
        ;;
esac
