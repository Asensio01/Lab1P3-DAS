# FINTECH GUARD - Guia rapida

## Requisitos
- Docker Desktop
- (Opcional) pnpm para frontend local

## Configuracion de entorno
1) Copia .env.example a .env
2) Define POSTGRES_PASSWORD en .env

Variables clave:
- POSTGRES_DSN=postgresql+asyncpg://postgres:<PASSWORD>@db_postgres:5432/fintech_db
- REDIS_DSN=redis://db_redis:6379/0
- POSTGRES_PASSWORD=<PASSWORD>
- VITE_API_BASE_URL=http://localhost:8000
- VITE_WS_URL=ws://localhost:8000/ws

## Levantar con Docker (backend + postgres + redis)
Desde la raiz:
- docker compose down -v
- docker compose up --build

Backend disponible en:
- http://localhost:8000
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Levantar frontend en Docker (opcional)
- docker compose --profile frontend up --build

Frontend en:
- http://localhost:5173

## Levantar frontend local (opcional)
Desde frontend/:
- pnpm install
- pnpm dev

## Rutas
1) Frontend en:
- http://localhost:5173
2) Backend disponible en:
- http://localhost:8000
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
3) Simulador disponible en:
- http://localhost:8001
- Swagger: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc
4) Netdata disponible en:
- http://localhost:19999
5) Grafana disponible en:
- http://localhost:3000
6) Prometheus disponible en:
- http://localhost:9090

## Probar el backend
1) Crear una cuenta (temporal, via SQL):
- docker exec -it fintech_postgres psql -U postgres -d fintech_db -c "INSERT INTO account (user_name, user_info, balance) VALUES ('juan', '{\"name\":\"Juan\"}', 10000.00) RETURNING id;"

2) Crear una transaccion:
- curl -X POST http://localhost:8000/api/v1/transactions -H "Content-Type: application/json" -d "{\"account_id\":1,\"ip\":\"127.0.0.1\",\"amount\":9000.00,\"country\":\"SV\"}"

3) Consultar la cuenta:
- curl http://localhost:8000/api/v1/accounts/1

## Notas y troubleshooting
- Los logs de GET / repetidos son del healthcheck del backend.
- Si Postgres falla con la version 18, hacer down -v y levantar de nuevo.
- Si falla por variables extra, revisar .env y Settings en core/config.py.
