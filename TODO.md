# TODO - Reconstrucción End-to-End FinTech Guard

## Fase 1: Backend Core + Contratos
- [ ] Revisar y normalizar `api/schemas.py` para alertas simulador y patch status.
- [ ] Rehacer/confirmar `POST /api/v1/simulator/alert` en `api/v1/routes.py`.
- [ ] Rehacer/confirmar `PATCH /api/v1/transactions/{tx_id}/status` en `api/v1/routes.py` con persistencia real en PostgreSQL (`commit`/`rollback`).
- [ ] Agregar/confirmar `GET /api/v1/transactions` para bootstrap inicial post-login con estados persistidos.
- [ ] Verificar `main.py` (CORS + WS `/ws`) para frontend local real.
- [ ] Estandarizar payload de eventos WS (flagged/simulator_alert/transaction_status_updated).

## Fase 2: Frontend Funcional Real
- [ ] Rehacer `frontend/src/hooks/useWebSocket.ts` con conexión estable y parse robusto.
- [ ] Rehacer `frontend/src/App.tsx` para:
  - [ ] Login manual con formulario (usuario/contraseña ingresados por el usuario, sin credenciales fijas).
  - [ ] Estado WS funcional (CONNECTED/CLOSED/CONNECTING real).
  - [ ] Tabla alimentada por pending + WS.
  - [ ] Botones 🚫/✅/⛔ operando contra backend con rollback.
  - [ ] Logs de persistencia confirmada y error de persistencia.
  - [ ] KPIs y logs consistentes en tiempo real.

## Fase 3: Simulador Integrado Automático
- [ ] Agregar en `simulator/app/client.py` envío de alertas a `/api/v1/simulator/alert`.
- [ ] Conectar `simulator/app/scenarios.py` para emitir alertas automáticas en escenarios anómalos.
- [ ] Verificar que simulador al correr alimente frontend sin pasos manuales adicionales.

## Fase 4: Testing End-to-End (Obligatorio)
- [ ] API con curl: login / pending / simulator alert / patch status (happy + error + edge).
- [ ] WS real: conexión válida/inválida y recepción de eventos.
- [ ] UI: flujo completo de visualización + operación de botones.
- [ ] Simulador: transacciones/alertas automáticas visibles en UI.

## Fase 5: Entrega
- [ ] Confirmar estado final funcional del sistema completo.
- [ ] Entregar comandos exactos de ejecución backend/frontend/simulador.
