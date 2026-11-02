import os
import socketio
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.socketio")

DOMAIN = "SOCKETIO"

_initialized = False
_connected: set[str] = set()

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    logger=False,
    engineio_logger=False
)


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


def initialize_socketio():
    global _initialized
    if _initialized:
        return sio
    _initialized = True
    _log("INFO", "socketio.initialized", "INITIALIZE", "COMPLETED")
    return sio


async def shutdown_socketio():
    global _initialized
    if not _initialized:
        return
    count = len(_connected)
    for sid in list(_connected):
        await sio.disconnect(sid)
    _connected.clear()
    _initialized = False
    _log("INFO", "socketio.stopped", "SHUTDOWN", "COMPLETED", count)


def get_socketio():
    if not _initialized:
        initialize_socketio()
    return sio


@sio.event
async def connect(sid, environ, auth):
    try:
        _connected.add(sid)
        await sio.emit("connected", {"sid": sid, "message": "Socket.IO connection established"}, to=sid)
        _log("INFO", "socketio.client.connected", "CONNECT", "COMPLETED", sid)
    except Exception as error:
        _log("ERROR", "socketio.client.connect.failed", "CONNECT", "FAILURE", sid, error, exc_info=True)
        raise


@sio.event
async def disconnect(sid):
    _connected.discard(sid)
    _log("INFO", "socketio.client.disconnected", "DISCONNECT", "COMPLETED", sid)


@sio.event
async def ping(sid, data):
    try:
        response = {"message": "Pong from FastAPI", "data": data}
        await sio.emit("pong", response, to=sid)
        _log("INFO", "socketio.ping.completed", "PING", "COMPLETED", sid)
        return response
    except Exception as error:
        _log("ERROR", "socketio.ping.failed", "PING", "FAILURE", sid, error, exc_info=True)
        await _emit_error(sid, "ping", "Failed to process ping request")
        raise


@sio.event
async def message(sid, data):
    try:
        response = {"sid": sid, "data": data}
        await sio.emit("message", response)
        _log("INFO", "socketio.message.completed", "MESSAGE", "COMPLETED", sid)
        return response
    except Exception as error:
        _log("ERROR", "socketio.message.failed", "MESSAGE", "FAILURE", sid, error, exc_info=True)
        await _emit_error(sid, "message", "Failed to process message")
        raise


async def _emit_error(sid, event, text):
    try:
        await sio.emit("socket_error", {"event": event, "message": text}, to=sid)
    except Exception as error:
        _log("ERROR", "socketio.error_emit.failed", "ERROR_EMIT", "FAILURE", sid, error, exc_info=True)
