"""
WebSocket Manager para broadcast de eventos en tiempo real
Maneja conexiones de múltiples clientes y distribuye actualizaciones de transacciones
"""

from typing import Set
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger("fintech_guard")


class WebSocketManager:
    """
    Gestiona las conexiones WebSocket activas y realiza broadcast de eventos.
    Permite que múltiples clientes frontend reciban actualizaciones en tiempo real.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.logger = logging.getLogger("fintech_guard.ws")

    async def connect(self, websocket: WebSocket) -> None:
        """Acepta una nueva conexión WebSocket"""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.logger.info(
            f"✓ WebSocket conectado. Total de conexiones: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Desconecta un cliente WebSocket"""
        self.active_connections.discard(websocket)
        self.logger.info(
            f"✗ WebSocket desconectado. Total de conexiones: {len(self.active_connections)}"
        )

    async def broadcast(self, message: dict | str) -> None:
        """
        Envía un mensaje a todos los clientes WebSocket conectados.
        Si el mensaje es un dict, se serializa a JSON.
        """
        if isinstance(message, dict):
            message_text = json.dumps(message)
        else:
            message_text = message

        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message_text)
            except Exception as e:
                self.logger.error(f"Error enviando mensaje a cliente: {e}")
                disconnected.append(connection)

        # Limpiar conexiones problemáticas
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_transaction(self, transaction_data: dict) -> None:
        """
        Broadcast especializado para actualizaciones de transacciones.
        Formato esperado:
        {
            "type": "transaction_update",
            "transaction": {...},
            "flagged": {...} (opcional),
            "status": "Under Review" | "Approved" | "Blocked"
        }
        """
        message = {
            "type": "transaction_update",
            **transaction_data,
        }
        await self.broadcast(message)

    async def broadcast_alert(
        self, alert_type: str, severity: str, message: str, details: dict | None = None
    ) -> None:
        """
        Broadcast de alerta de seguridad.
        Severidades: "info", "warning", "error", "critical"
        """
        payload = {
            "type": "alert",
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "details": details or {},
        }
        await self.broadcast(payload)

    async def broadcast_status_update(
        self, transaction_id: int, old_status: str, new_status: str, timestamp: str
    ) -> None:
        """
        Broadcast cuando cambia el estado de una transacción.
        Usado por analistas que aprueban o rechazan transacciones.
        """
        payload = {
            "type": "status_update",
            "transaction_id": transaction_id,
            "old_status": old_status,
            "new_status": new_status,
            "timestamp": timestamp,
        }
        await self.broadcast(payload)

    def get_connection_count(self) -> int:
        """Retorna el número de conexiones activas"""
        return len(self.active_connections)


# Instancia global del manager
ws_manager = WebSocketManager()
