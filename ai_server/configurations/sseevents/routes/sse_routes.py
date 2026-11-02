import asyncio
import json
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message
from configurations.sseevents.connection.sse_connection_manager import get_sse_manager

log = get_logger("aiverse.ai_server.sse.routes")

DOMAIN = "SSE"

router = APIRouter(prefix="/api/sse", tags=["SSE"])


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


@router.get("/events/{client_id}")
async def events(client_id: str, request: Request):
    sse_manager = get_sse_manager()
    queue = await sse_manager.connect(client_id)

    async def event_generator():
        _log("INFO", "sse.stream.started", "STREAM", "STARTED", client_id)
        try:
            yield {
                "event": "connected",
                "data": json.dumps({
                    "client_id": client_id,
                    "message": "SSE connection established"
                })}
            while True:
                if await request.is_disconnected():
                    _log("INFO", "sse.stream.client_disconnected", "STREAM", "COMPLETED", client_id)
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield {
                        "event": event.get("event", "message"),
                        "data": json.dumps(event.get("data", {})),
                        "id": event.get("id")
                    }
                    _log("INFO", "sse.stream.delivered", "DELIVER", "COMPLETED", client_id, event.get("event", "message"))
                except asyncio.TimeoutError:
                    yield {
                        "event": "ping",
                        "data": json.dumps({
                            "timestamp": asyncio.get_running_loop().time()
                        })}
        except asyncio.CancelledError:
            _log("INFO", "sse.stream.cancelled", "STREAM", "COMPLETED", client_id)
            raise
        except Exception as error:
            _log("ERROR", "sse.stream.failed", "STREAM", "FAILURE", client_id, error, exc_info=True)
            raise
        finally:
            await sse_manager.disconnect(client_id, queue)

    return EventSourceResponse(event_generator(), ping=30)


@router.post("/publish/{client_id}")
async def publish(
    client_id: str,
    event: str
):
    sse_manager = get_sse_manager()
    try:
        await sse_manager.publish(
            client_id,
            {
                "event": event,
                "data": {
                    "message": "Hello from FastAPI"
                }
            }
        )
        _log("INFO", "sse.endpoint.publish.completed", "PUBLISH", "COMPLETED", client_id, event)
        return {
            "success": True,
            "client_id": client_id,
            "event": event
        }
    except Exception as error:
        _log("ERROR", "sse.endpoint.publish.failed", "PUBLISH", "FAILURE", client_id, event, error, exc_info=True)
        raise
