from fastapi import WebSocket
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.websocket")

DOMAIN = "WEBSOCKET"


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        try:
            await websocket.accept()
            self.active_connections[user_id] = websocket
            _log("INFO", "websocket.connected", "CONNECT", "COMPLETED", user_id, len(self.active_connections))
        except Exception as error:
            _log("ERROR", "websocket.connect.failed", "CONNECT", "FAILURE", user_id, error, exc_info=True)
            self.active_connections.pop(user_id, None)

    def disconnect(self, user_id: str):
        if self.active_connections.pop(user_id, None):
            _log("INFO", "websocket.disconnected", "DISCONNECT", "COMPLETED", user_id, len(self.active_connections))
        else:
            _log("WARN", "websocket.disconnect.unknown", "DISCONNECT", "SKIPPED", user_id)

    async def send_to_user(self, user_id: str, message: str):
        websocket = self.active_connections.get(user_id)
        if not websocket:
            _log("WARN", "websocket.send.not_connected", "SEND_TO_USER", "SKIPPED", user_id)
            return
        try:
            await websocket.send_text(message)
            _log("INFO", "websocket.send.completed", "SEND_TO_USER", "COMPLETED", user_id)
        except Exception as error:
            _log("ERROR", "websocket.send.failed", "SEND_TO_USER", "FAILURE", user_id, error, exc_info=True)
            self.disconnect(user_id)

    async def broadcast(self, message: str):
        disconnected_users = []
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_text(message)
            except Exception as error:
                _log("ERROR", "websocket.broadcast.failed", "BROADCAST", "FAILURE", user_id, error, exc_info=True)
                disconnected_users.append(user_id)
        for user_id in disconnected_users:
            self.disconnect(user_id)
        _log("INFO", "websocket.broadcast.completed", "BROADCAST", "COMPLETED", len(self.active_connections), len(disconnected_users))

    async def close_all(self) -> int:
        count = len(self.active_connections)
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.close()
            except Exception:
                pass
        self.active_connections.clear()
        return count


_initialized = False


def initialize_websocket():
    global _initialized
    if _initialized:
        return
    _initialized = True
    _log("INFO", "websocket.initialized", "INITIALIZE", "COMPLETED")


async def shutdown_websocket(manager: ConnectionManager):
    global _initialized
    if not _initialized:
        return
    count = await manager.close_all()
    _initialized = False
    _log("INFO", "websocket.stopped", "SHUTDOWN", "COMPLETED", count)
