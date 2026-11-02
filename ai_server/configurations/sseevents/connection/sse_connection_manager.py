import asyncio
from collections import defaultdict
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.sse")

DOMAIN = "SSE"

_initialized = False
sse_manager = None


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


class SSEConnectionManager:

    def __init__(self):
        self.connections: dict[str, set[asyncio.Queue]] = defaultdict(set)

    async def connect(self, client_id: str) -> asyncio.Queue:
        try:
            queue = asyncio.Queue()
            self.connections[client_id].add(queue)
            _log("INFO", "sse.connection.connected", "CONNECT", "COMPLETED", client_id)
            return queue
        except Exception as error:
            _log("ERROR", "sse.connection.connect.failed", "CONNECT", "FAILURE", client_id, error, exc_info=True)
            raise

    async def disconnect(self, client_id: str, queue: asyncio.Queue):
        try:
            if client_id in self.connections:
                self.connections[client_id].discard(queue)
                if not self.connections[client_id]:
                    del self.connections[client_id]
            else:
                _log("WARN", "sse.connection.unknown", "DISCONNECT", "SKIPPED", client_id)
            _log("INFO", "sse.connection.disconnected", "DISCONNECT", "COMPLETED", client_id)
        except Exception as error:
            _log("ERROR", "sse.connection.disconnect.failed", "DISCONNECT", "FAILURE", client_id, error, exc_info=True)
            raise

    async def publish(self, client_id: str, event: dict):
        try:
            queues = self.connections.get(client_id, set())
            if not queues:
                _log("WARN", "sse.publish.no_connection", "PUBLISH", "SKIPPED", client_id)
                return
            for queue in queues:
                await queue.put(event)
            _log("INFO", "sse.publish.completed", "PUBLISH", "COMPLETED", client_id, event.get("event"), len(queues))
        except Exception as error:
            _log("ERROR", "sse.publish.failed", "PUBLISH", "FAILURE", client_id, error, exc_info=True)
            raise


def initialize_sse():
    global _initialized
    global sse_manager
    if _initialized:
        return sse_manager
    try:
        sse_manager = SSEConnectionManager()
        _initialized = True
        _log("INFO", "sse.manager.initialized", "INITIALIZE", "COMPLETED")
        return sse_manager
    except Exception as error:
        _log("ERROR", "sse.manager.failed", "INITIALIZE", "FAILURE", error, exc_info=True)
        raise


def shutdown_sse():
    global _initialized
    global sse_manager
    if not _initialized or sse_manager is None:
        return
    count = sum(len(queues) for queues in sse_manager.connections.values())
    sse_manager.connections.clear()
    sse_manager = None
    _initialized = False
    _log("INFO", "sse.manager.stopped", "SHUTDOWN", "COMPLETED", count)


def get_sse_manager() -> SSEConnectionManager:
    if not _initialized or sse_manager is None:
        initialize_sse()
    return sse_manager
