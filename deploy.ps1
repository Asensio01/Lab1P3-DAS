# FinTech Guard - Deployment Script para Windows PowerShell
# Este script proporciona todas las utilidades necesarias para levantar y probar el sistema

param(
    [Parameter(Position = 0)]
    [ValidateSet('setup', 'docker-start', 'docker-stop', 'local-backend', 'local-frontend', 'local-simulator', 'local-setup', 'test', 'logs', 'clean')]
    [string]$Command = 'menu'
)

# Colors
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Cyan
$Reset = [System.ConsoleColor]::White

function Write-ColorOutput($Message, $Color = $Reset) {
    Write-Host $Message -ForegroundColor $Color
}

function Show-Header {
    Clear-Host
    Write-ColorOutput "╔════════════════════════════════════════════════════════╗" $Blue
    Write-ColorOutput "║       FINTECH GUARD - DEPLOYMENT FOR WINDOWS           ║" $Blue
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" $Blue
    Write-Host ""
}

function Setup-Environment {
    Write-ColorOutput "[1/4] Configurando variables de entorno..." $Yellow
    
    if (-Not (Test-Path ".env")) {
        $envContent = @"
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
"@
        $envContent | Out-File -Encoding UTF8 ".env"
        Write-ColorOutput "✓ Archivo .env creado" $Green
    }
    else {
        Write-ColorOutput "✓ Archivo .env ya existe" $Green
    }
}

function Docker-Build {
    Write-ColorOutput "[2/4] Compilando imágenes Docker..." $Yellow
    docker-compose build --no-cache
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Imágenes compiladas exitosamente" $Green
    }
    else {
        Write-ColorOutput "✗ Error compilando imágenes" $Red
        exit 1
    }
}

function Docker-Start {
    Show-Header
    Write-ColorOutput "[3/4] Levantando servicios Docker..." $Yellow
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Servicios iniciados" $Green
        Write-Host ""
        Write-ColorOutput "Esperando que los servicios estén saludables..." $Yellow
        Start-Sleep -Seconds 5
        
        Write-ColorOutput "Estado de servicios:" $Blue
        docker-compose ps
        
        Write-ColorOutput "`n¡Stack listo! Accede a:" $Green
        Write-ColorOutput "- Frontend: http://localhost:5173" $Blue
        Write-ColorOutput "- Backend API: http://localhost:8000/docs" $Blue
        Write-ColorOutput "- WebSocket: ws://localhost:8000/ws/transactions" $Blue
    }
    else {
        Write-ColorOutput "✗ Error iniciando servicios" $Red
        exit 1
    }
}

function Docker-Stop {
    Write-ColorOutput "Deteniendo servicios Docker..." $Yellow
    docker-compose down
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Servicios detenidos" $Green
    }
}

function Local-Setup {
    Show-Header
    Write-ColorOutput "Setup Local - Instalando dependencias..." $Yellow
    
    # Backend
    Write-ColorOutput "`nBackend Setup:" $Blue
    if (-Not (Test-Path "venv")) {
        python -m venv venv
        Write-ColorOutput "✓ Virtual environment creado" $Green
    }
    
    & .\venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    Write-ColorOutput "✓ Backend dependencies instaladas" $Green
    
    # Frontend
    Write-ColorOutput "`nFrontend Setup:" $Blue
    cd frontend
    npm install
    Write-ColorOutput "✓ Frontend dependencies instaladas" $Green
    cd ..
    
    Write-ColorOutput "`n✓ Setup completado`n" $Green
    Write-ColorOutput "Inicia los servicios en terminales separadas:" $Yellow
    Write-ColorOutput "Terminal 1: .\deploy.ps1 local-backend" $Blue
    Write-ColorOutput "Terminal 2: .\deploy.ps1 local-frontend" $Blue
    Write-ColorOutput "Terminal 3: .\deploy.ps1 local-simulator" $Blue
}

function Local-Backend {
    Show-Header
    Write-ColorOutput "Iniciando Backend (FastAPI)..." $Yellow
    & .\venv\Scripts\Activate.ps1
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
}

function Local-Frontend {
    Show-Header
    Write-ColorOutput "Iniciando Frontend (Vite)..." $Yellow
    cd frontend
    npm run dev
}

function Local-Simulator {
    Show-Header
    Write-ColorOutput "Iniciando Simulador..." $Yellow
    cd simulator
    & ..\venv\Scripts\Activate.ps1
    python -m app
}

function Test-Connectivity {
    Show-Header
    Write-ColorOutput "[4/4] Validando conectividad de servicios..." $Yellow
    
    Write-ColorOutput "`nBackend API (http://localhost:8000):" $Blue
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/docs" -ErrorAction Stop
        Write-ColorOutput "✓ Backend accesible (HTTP 200)" $Green
    }
    catch {
        Write-ColorOutput "✗ Backend no accesible" $Red
    }
    
    Write-ColorOutput "`nFrontend (http://localhost:5173):" $Blue
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -ErrorAction Stop
        Write-ColorOutput "✓ Frontend accesible (HTTP 200)" $Green
    }
    catch {
        Write-ColorOutput "✗ Frontend no accesible" $Red
    }
    
    Write-ColorOutput "`nPostgreSQL (localhost:5433):" $Blue
    Write-ColorOutput "Para conectar: psql -h localhost -p 5433 -U postgres -d fintech_db" $Yellow
    
    Write-ColorOutput "`nRedis (localhost:6379):" $Blue
    Write-ColorOutput "Para conectar: redis-cli -p 6379" $Yellow
    
    Write-ColorOutput "`nWebSocket (ws://localhost:8000/ws/transactions):" $Blue
    Write-ColorOutput "Para probar: wscat -c ws://localhost:8000/ws/transactions" $Yellow
}

function Test-API-Endpoints {
    Show-Header
    Write-ColorOutput "Probando endpoints de la API..." $Yellow
    
    Write-ColorOutput "`nCreando transacción de prueba..." $Blue
    $body = @{
        account_id = 1
        ip = "192.168.1.1"
        amount = 9500.00
        country = "SV"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/transactions" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
    
    Write-ColorOutput "Response:" $Blue
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
    
    Write-ColorOutput "`nProbando endpoint de auditoría..." $Blue
    $body = @{
        flagged_transaction_id = 1
        decision = "Aprobado"
        auditor_notes = "Verification completed"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/audit/resolve" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
    
    Write-ColorOutput "Response:" $Blue
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
}

function View-Logs {
    Write-ColorOutput "Mostrando logs de Docker..." $Yellow
    docker-compose logs -f
}

function Cleanup {
    Write-ColorOutput "Limpiando recursos..." $Yellow
    
    Write-ColorOutput "¿Deseas eliminar contenedores? (Y/n)" $Yellow
    $confirm = Read-Host
    if ($confirm -ne "n") {
        docker-compose down
        Write-ColorOutput "✓ Contenedores eliminados" $Green
    }
    
    Write-ColorOutput "¿Deseas eliminar volúmenes? (Y/n)" $Yellow
    $confirm = Read-Host
    if ($confirm -ne "n") {
        docker-compose down -v
        Write-ColorOutput "✓ Volúmenes eliminados" $Green
    }
    
    Write-ColorOutput "¿Deseas limpiar imágenes dangling? (Y/n)" $Yellow
    $confirm = Read-Host
    if ($confirm -ne "n") {
        docker image prune -a -f
        Write-ColorOutput "✓ Imágenes limpias" $Green
    }
}

function Show-Menu {
    Show-Header
    Write-ColorOutput "OPCIONES DISPONIBLES:" $Blue
    Write-ColorOutput "═════════════════════════════════════════════════════════" $Blue
    Write-Host ""
    Write-Host "DOCKER (Recomendado):"
    Write-Host "  setup              - Setup completo con Docker Compose"
    Write-Host "  docker-start       - Levantar servicios Docker"
    Write-Host "  docker-stop        - Detener servicios Docker"
    Write-Host "  logs               - Ver logs de Docker"
    Write-Host ""
    Write-Host "DESARROLLO LOCAL (Sin Docker):"
    Write-Host "  local-setup        - Instalar dependencias locales"
    Write-Host "  local-backend      - Iniciar Backend (FastAPI)"
    Write-Host "  local-frontend     - Iniciar Frontend (Vite)"
    Write-Host "  local-simulator    - Iniciar Simulador"
    Write-Host ""
    Write-Host "TESTING:"
    Write-Host "  test               - Validar conectividad y probar endpoints"
    Write-Host ""
    Write-Host "MANTENIMIENTO:"
    Write-Host "  clean              - Limpiar recursos Docker"
    Write-Host ""
    Write-ColorOutput "═════════════════════════════════════════════════════════" $Blue
}

# Main execution
switch ($Command) {
    'setup' {
        Show-Header
        Setup-Environment
        Docker-Build
        Docker-Start
        Test-Connectivity
        Test-API-Endpoints
    }
    'docker-start' {
        Show-Header
        Docker-Start
    }
    'docker-stop' {
        Show-Header
        Docker-Stop
    }
    'local-setup' {
        Local-Setup
    }
    'local-backend' {
        Local-Backend
    }
    'local-frontend' {
        Local-Frontend
    }
    'local-simulator' {
        Local-Simulator
    }
    'test' {
        Test-Connectivity
        Write-Host ""
        Test-API-Endpoints
    }
    'logs' {
        View-Logs
    }
    'clean' {
        Cleanup
    }
    default {
        Show-Menu
        Write-Host ""
        Write-ColorOutput "Uso: .\deploy.ps1 [opción]" $Yellow
        Write-ColorOutput "`nEjemplo: .\deploy.ps1 setup" $Blue
    }
}
