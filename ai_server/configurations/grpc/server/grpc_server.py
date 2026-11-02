import os
import time
from concurrent import futures
import grpc
from aiverse_logging import get_logger, log_event
from configurations.grpc.generated import aiverse_pb2, aiverse_pb2_grpc
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.grpc")

DOMAIN = "GRPC"
SERVER_NAME = "AIVERSE-FASTAPI" 


def _log(level, key, action, outcome, *args, duration_started_at=None, exc_info=False):
    context = None
    if duration_started_at is not None:
        context = {"duration_ms": round((time.monotonic() - duration_started_at) * 1000, 2)}
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, context=context, exc_info=exc_info)


class AiverseGrpcService(aiverse_pb2_grpc.AiverseServiceServicer):
    def Ping(self, request, context):
        started_at = time.monotonic()
        _log("INFO", "grpc.ping.received", "PING", "STARTED", request.message)
        try:
            response = aiverse_pb2.PingResponse(
                message=f"Pong from FastAPI: {request.message}",
                server=SERVER_NAME,
                timestamp=int(time.time()),
            )
            _log("INFO", "grpc.ping.completed", "PING", "COMPLETED", duration_started_at=started_at)
            return response
        except Exception as error:
            _log("ERROR", "grpc.ping.failed", "PING", "FAILURE", error, exc_info=True)
            raise

    def GetServerStatus(self, request, context):
        started_at = time.monotonic()
        _log("INFO", "grpc.status.received", "GET_SERVER_STATUS", "STARTED")
        try:
            response = aiverse_pb2.ServerStatusResponse(server=SERVER_NAME, status="UP", version="1.0.0")
            _log("INFO", "grpc.status.completed", "GET_SERVER_STATUS", "COMPLETED", duration_started_at=started_at)
            return response
        except Exception as error:
            _log("ERROR", "grpc.status.failed", "GET_SERVER_STATUS", "FAILURE", error, exc_info=True)
            raise


def start_grpc_server():
    # On Render the HTTP server owns $PORT, so gRPC listens on its own port (reached over the private network).
    port = os.getenv("GRPC_PORT", "50051")
    if port == os.getenv("PORT"):
        raise ValueError(f"GRPC_PORT ({port}) must differ from PORT, which is used by the HTTP server")
    _log("INFO", "grpc.server.starting", "START_SERVER", "STARTED", port)
    try:
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
        aiverse_pb2_grpc.add_AiverseServiceServicer_to_server(AiverseGrpcService(), server)
        server.add_insecure_port(f"[::]:{port}")
        server.start()
        _log("INFO", "grpc.server.started", "START_SERVER", "COMPLETED", port)
        return server
    except Exception as error:
        _log("ERROR", "grpc.server.failed", "START_SERVER", "FAILURE", error, exc_info=True)
        raise


def stop_grpc_server(server):
    server.stop(grace=5).wait()
    _log("INFO", "grpc.server.stopped", "STOP_SERVER", "COMPLETED")
