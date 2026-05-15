-- ==============================================================================
-- FINTECH GUARD - ESQUEMA DE BASE DE DATOS ESTRUCTURAL
-- Motor de PostgreSQL optimizado para transacciones y auditoría de seguridad
-- ==============================================================================

-- 1. TIPOS DE DATOS ENUMERADOS (Para consistencia e integridad)
CREATE TYPE account_state AS ENUM ('Activo', 'Inactivo', 'Bloqueado');
CREATE TYPE audit_state AS ENUM ('Aprobado', 'Bloqueado', 'Revision Pendiente', 'Bajo Revision');
CREATE TYPE transaction_state AS ENUM ('Aprobada', 'Rechazada', 'Bloqueada');

-- 2. TABLAS PRINCIPALES

-- Tabla de Cuentas
CREATE TABLE IF NOT EXISTS account (
    id BIGSERIAL PRIMARY KEY,
    -- PostgreSQL 13+ trae gen_random_uuid() nativo, no requiere extensión
    uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    user_name TEXT NOT NULL UNIQUE,
    user_info JSONB NOT NULL, -- Ej: {"name": "Juan", "dui": "000000-0", "house_location": "San Salvador"}
    state account_state DEFAULT 'Activo',
    -- Campos cruciales para transacciones y concurrencia (Race Conditions)
    balance DECIMAL(12,2) DEFAULT 0.00 CHECK (balance >= 0),
    version INTEGER DEFAULT 1
);

-- Tabla de Transacciones (El flujo de fuego)
CREATE TABLE IF NOT EXISTS transaction (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT REFERENCES account(id),
    ip INET NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    country TEXT NOT NULL,
    state transaction_state NOT NULL DEFAULT 'Aprobada',
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índice crítico de alto rendimiento
-- Evita que la base de datos colapse cuando el motor de FastAPI busque transacciones recientes
CREATE INDEX IF NOT EXISTS idx_transaction_account_time 
ON transaction(account_id, timestamp);

-- 3. TABLAS DE AUDITORÍA Y SEGURIDAD

-- Tabla de Transacciones Marcadas (Cola de "Revisión Manual" para el Frontend)
CREATE TABLE IF NOT EXISTS flagged_transaction (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT REFERENCES transaction(id) UNIQUE, -- Relación 1 a 1 estricta
    anomaly TEXT NOT NULL, -- Ej: "Patrón de Lavado - Alta Frecuencia", "Monto Inusual"
    state audit_state DEFAULT 'Revision Pendiente',
    auditor_notes TEXT, -- Justificación ingresada por el analista en la consola de React
    resolved_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Registros de Seguridad (Log de accesos no autorizados y bloqueos)
CREATE TABLE IF NOT EXISTS security_logs (
    id BIGSERIAL PRIMARY KEY,
    ip INET NOT NULL,
    details JSONB NOT NULL, -- Ej: {"attempted_user": "admin", "reason": "Credencial Invalida"}
    state TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);