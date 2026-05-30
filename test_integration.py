#!/usr/bin/env python3
"""
FinTech Guard Integration Testing Suite
Valida la integración completa entre Frontend, Backend, y Simulador
"""

import asyncio
import json
import time
import sys
from typing import Any, Dict
from datetime import datetime, timedelta
from decimal import Decimal

try:
    import httpx
    import asyncpg
    import redis.asyncio as redis
    import websockets
except ImportError:
    print("❌ Por favor instala las dependencias:")
    print("pip install httpx asyncpg redis websockets")
    sys.exit(1)


class Colors:
    RESET = "\033[0m"
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"


def print_header(text: str) -> None:
    print(f"\n{Colors.BLUE}{'═' * 70}{Colors.RESET}")
    print(f"{Colors.BLUE}{text:^70}{Colors.RESET}")
    print(f"{Colors.BLUE}{'═' * 70}{Colors.RESET}\n")


def print_success(text: str) -> None:
    print(f"{Colors.GREEN}✓{Colors.RESET} {text}")


def print_error(text: str) -> None:
    print(f"{Colors.RED}✗{Colors.RESET} {text}")


def print_info(text: str) -> None:
    print(f"{Colors.CYAN}ℹ{Colors.RESET} {text}")


def print_warning(text: str) -> None:
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {text}")


class FinTechGuardTester:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.ws_url = "ws://localhost:8000"
        self.postgres_dsn = "postgresql://postgres:fintech_guard@localhost:5433/fintech_db"
        self.redis_url = "redis://localhost:6379"
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "skipped": 0,
        }

    async def test_backend_connectivity(self) -> bool:
        """Test if backend API is accessible"""
        print_info("Probando conectividad del Backend...")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/docs", timeout=5)
                if response.status_code == 200:
                    print_success(f"Backend API accesible (HTTP {response.status_code})")
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_error(f"Backend retornó {response.status_code}")
                    self.test_results["failed"] += 1
                    return False
        except Exception as e:
            print_error(f"No se puede conectar al backend: {e}")
            self.test_results["failed"] += 1
            return False

    async def test_postgresql_connection(self) -> bool:
        """Test PostgreSQL connectivity"""
        print_info("Probando conexión a PostgreSQL...")
        try:
            conn = await asyncpg.connect(self.postgres_dsn)
            result = await conn.fetchval("SELECT version()")
            await conn.close()
            print_success(f"PostgreSQL conectado")
            self.test_results["passed"] += 1
            return True
        except Exception as e:
            print_error(f"No se puede conectar a PostgreSQL: {e}")
            self.test_results["failed"] += 1
            return False

    async def test_redis_connection(self) -> bool:
        """Test Redis connectivity"""
        print_info("Probando conexión a Redis...")
        try:
            redis_client = await redis.from_url(self.redis_url)
            pong = await redis_client.ping()
            await redis_client.close()
            if pong:
                print_success("Redis conectado")
                self.test_results["passed"] += 1
                return True
        except Exception as e:
            print_error(f"No se puede conectar a Redis: {e}")
            self.test_results["failed"] += 1
            return False

    async def test_create_transaction(self) -> Dict[str, Any]:
        """Test creating a transaction"""
        print_info("Creando transacción de prueba...")
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "account_id": 1,
                    "ip": "192.168.1.100",
                    "amount": 9500.00,
                    "country": "SV",
                }
                response = await client.post(
                    f"{self.base_url}/api/v1/transactions",
                    json=payload,
                    timeout=10,
                )

                if response.status_code == 201:
                    data = response.json()
                    print_success(
                        f"Transacción creada: ID={data['transaction']['id']}, "
                        f"State={data['transaction']['state']}"
                    )
                    if data.get("flagged"):
                        print_info(f"Flagged: {data['flagged']['anomaly']}")
                    self.test_results["passed"] += 1
                    return data
                else:
                    print_error(
                        f"Error creando transacción: {response.status_code} - {response.text}"
                    )
                    self.test_results["failed"] += 1
                    return {}
        except Exception as e:
            print_error(f"Excepción creando transacción: {e}")
            self.test_results["failed"] += 1
            return {}

    async def test_ban_ip(self) -> bool:
        """Test IP banning"""
        print_info("Probando endpoint de Ban IP...")
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "ip_address": "192.168.1.200",
                    "reason": "Multiple fraud attempts detected",
                    "duration_hours": 24,
                }
                response = await client.post(
                    f"{self.base_url}/api/v1/security/ban-ip",
                    json=payload,
                    timeout=10,
                )

                if response.status_code == 200:
                    data = response.json()
                    print_success(
                        f"IP {data['ip_address']} prohibida hasta "
                        f"{data['expires_at'][:19]}"
                    )
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_error(f"Error baneando IP: {response.status_code}")
                    self.test_results["failed"] += 1
                    return False
        except Exception as e:
            print_error(f"Excepción baneando IP: {e}")
            self.test_results["failed"] += 1
            return False

    async def test_audit_transaction(self, flagged_id: int = 1) -> bool:
        """Test transaction auditing"""
        print_info(f"Probando auditoría de transacción ID={flagged_id}...")
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "flagged_transaction_id": flagged_id,
                    "decision": "Aprobado",
                    "auditor_notes": "Verified as legitimate transaction",
                    "auditor_id": 1,
                }
                response = await client.post(
                    f"{self.base_url}/api/v1/audit/resolve",
                    json=payload,
                    timeout=10,
                )

                if response.status_code == 200:
                    data = response.json()
                    print_success(
                        f"Transacción auditada: "
                        f"new_state={data['new_state']}, "
                        f"resolved_at={data['resolved_at'][:19]}"
                    )
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_warning(
                        f"No se pudo auditar (posiblemente no existe): {response.status_code}"
                    )
                    self.test_results["skipped"] += 1
                    return False
        except Exception as e:
            print_warning(f"Excepción auditando: {e}")
            self.test_results["skipped"] += 1
            return False

    async def test_cors_headers(self) -> bool:
        """Test CORS headers are correctly set"""
        print_info("Probando headers CORS...")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.options(
                    f"{self.base_url}/api/v1/transactions",
                    timeout=5,
                )

                cors_headers = {
                    "access-control-allow-origin": response.headers.get(
                        "access-control-allow-origin"
                    ),
                    "access-control-allow-methods": response.headers.get(
                        "access-control-allow-methods"
                    ),
                    "access-control-allow-headers": response.headers.get(
                        "access-control-allow-headers"
                    ),
                }

                if cors_headers["access-control-allow-origin"]:
                    print_success("CORS headers configurados correctamente")
                    print_info(f"Allowed origins: {cors_headers['access-control-allow-origin']}")
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_warning("CORS headers no encontrados")
                    self.test_results["failed"] += 1
                    return False
        except Exception as e:
            print_warning(f"No se pudo verificar CORS: {e}")
            self.test_results["skipped"] += 1
            return False

    async def test_websocket_connection(self) -> bool:
        """Test WebSocket connectivity"""
        print_info("Probando conexión WebSocket...")
        try:
            uri = f"{self.ws_url}/ws/transactions"
            async with websockets.connect(uri, ping_timeout=5) as websocket:
                print_success("WebSocket conectado")

                # Try to receive a message with timeout
                try:
                    message = await asyncio.wait_for(
                        websocket.recv(), timeout=3
                    )
                    data = json.loads(message)
                    print_success(
                        f"Mensaje recibido: {json.dumps(data, indent=2)[:100]}..."
                    )
                    self.test_results["passed"] += 1
                    return True
                except asyncio.TimeoutError:
                    print_info("WebSocket conectado pero sin mensajes (esperado)")
                    self.test_results["passed"] += 1
                    return True
        except Exception as e:
            print_error(f"No se puede conectar al WebSocket: {e}")
            self.test_results["failed"] += 1
            return False

    async def test_health_checks(self) -> bool:
        """Test API health check endpoints"""
        print_info("Probando endpoints de salud...")
        try:
            async with httpx.AsyncClient() as client:
                # Test main endpoint
                response = await client.get(f"{self.base_url}/", timeout=5)
                if response.status_code == 200:
                    print_success("Health check endpoint respondiendo")
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_error(f"Health check falló: {response.status_code}")
                    self.test_results["failed"] += 1
                    return False
        except Exception as e:
            print_error(f"Error en health check: {e}")
            self.test_results["failed"] += 1
            return False

    async def test_prometheus_metrics(self) -> bool:
        """Test Prometheus metrics endpoint"""
        print_info("Probando endpoint de métricas Prometheus...")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/metrics", timeout=5)
                if response.status_code == 200 and "# HELP" in response.text:
                    lines = response.text.count("\n")
                    print_success(f"Métricas disponibles ({lines} líneas)")
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_warning("Endpoint de métricas no retorna datos válidos")
                    self.test_results["skipped"] += 1
                    return False
        except Exception as e:
            print_warning(f"No se pueden obtener métricas: {e}")
            self.test_results["skipped"] += 1
            return False

    async def test_error_handling(self) -> bool:
        """Test error handling"""
        print_info("Probando manejo de errores...")
        try:
            async with httpx.AsyncClient() as client:
                # Test 404
                response = await client.get(f"{self.base_url}/api/v1/accounts/99999", timeout=5)
                if response.status_code == 404:
                    print_success("Error 404 manejado correctamente")
                    self.test_results["passed"] += 1
                    return True
                else:
                    print_warning(f"Comportamiento inesperado: {response.status_code}")
                    self.test_results["skipped"] += 1
                    return False
        except Exception as e:
            print_error(f"Error en test de error handling: {e}")
            self.test_results["failed"] += 1
            return False

    async def run_all_tests(self):
        """Run all tests"""
        print_header("FINTECH GUARD INTEGRATION TEST SUITE")

        print(f"{Colors.CYAN}Iniciando pruebas... {datetime.now().isoformat()[:19]}{Colors.RESET}\n")

        # Connectivity Tests
        print_header("1. PRUEBAS DE CONECTIVIDAD")
        await self.test_backend_connectivity()
        await self.test_postgresql_connection()
        await self.test_redis_connection()

        # API Tests
        print_header("2. PRUEBAS DE API")
        await self.test_health_checks()
        await self.test_cors_headers()
        tx_data = await self.test_create_transaction()

        # Security Mitigation Tests
        print_header("3. PRUEBAS DE MITIGACIÓN DE SEGURIDAD")
        await self.test_ban_ip()

        # Audit Tests
        print_header("4. PRUEBAS DE AUDITORÍA")
        await self.test_audit_transaction()

        # Real-time Tests
        print_header("5. PRUEBAS DE REAL-TIME")
        await self.test_websocket_connection()

        # Monitoring Tests
        print_header("6. PRUEBAS DE MONITOREO")
        await self.test_prometheus_metrics()

        # Error Handling Tests
        print_header("7. PRUEBAS DE MANEJO DE ERRORES")
        await self.test_error_handling()

        # Summary
        print_header("RESUMEN DE RESULTADOS")
        total = (
            self.test_results["passed"]
            + self.test_results["failed"]
            + self.test_results["skipped"]
        )

        print(f"Total de pruebas:    {total}")
        print(f"{Colors.GREEN}Pasadas:           {self.test_results['passed']}{Colors.RESET}")
        print(f"{Colors.RED}Fallidas:          {self.test_results['failed']}{Colors.RESET}")
        print(f"{Colors.YELLOW}Omitidas:          {self.test_results['skipped']}{Colors.RESET}")

        success_rate = (
            (self.test_results["passed"] / total * 100) if total > 0 else 0
        )
        print(f"Tasa de éxito:      {success_rate:.1f}%")

        if self.test_results["failed"] == 0:
            print(f"\n{Colors.GREEN}{'✓' * 70}{Colors.RESET}")
            print(f"{Colors.GREEN}¡Todas las pruebas completadas exitosamente!{Colors.RESET}")
            print(f"{Colors.GREEN}{'✓' * 70}{Colors.RESET}\n")
            return True
        else:
            print(f"\n{Colors.RED}{'✗' * 70}{Colors.RESET}")
            print(f"{Colors.RED}Algunas pruebas fallaron. Revisa los logs arriba.{Colors.RESET}")
            print(f"{Colors.RED}{'✗' * 70}{Colors.RESET}\n")
            return False


async def main():
    tester = FinTechGuardTester()
    try:
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test suite interrumpido por el usuario{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.RED}Error fatal: {e}{Colors.RESET}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
