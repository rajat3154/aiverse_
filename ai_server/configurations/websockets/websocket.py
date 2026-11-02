from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message
from configurations.websockets.manager import ConnectionManager

log = get_logger("aiverse.ai_server.websocket.routes")

DOMAIN = "WEBSOCKET"

router = APIRouter(prefix="/ws", tags=["WebSocket"])
manager = ConnectionManager()


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


@router.websocket("/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    try:
        await manager.connect(user_id, websocket)
        while True:
            message = await websocket.receive_text()
            _log("INFO", "websocket.message.received", "MESSAGE", "COMPLETED", user_id)
            await manager.send_to_user(user_id, f"Server received: {message}")
    except WebSocketDisconnect:
        _log("INFO", "websocket.client.disconnected", "ENDPOINT", "COMPLETED", user_id)
        manager.disconnect(user_id)
    except Exception as error:
        _log("ERROR", "websocket.endpoint.failed", "ENDPOINT", "FAILURE", user_id, error, exc_info=True)
        manager.disconnect(user_id)
