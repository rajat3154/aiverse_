import os
import time
import grpc
from aiverse_logging import get_logger, log_event
from configurations.grpc.generated import aiverse_pb2, aiverse_pb2_grpc
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.grpc.client")

DOMAIN = "GRPC"


def _log(level, key, action, outcome, *args, duration_started_at=None, exc_info=False):
    context = None
    if duration_started_at is not None:
        context = {"duration_ms": round((time.monotonic() - duration_started_at) * 1000, 2)}
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, context=context, exc_info=exc_info)


class AiverseGrpcClient:
    def __init__(self, host: str = os.getenv("GRPC_HOST", "localhost"), port: int = int(os.getenv("GRPC_PORT", "50051"))):
        self.channel = grpc.insecure_channel(f"{host}:{port}")
        self.stub = aiverse_pb2_grpc.AiverseServiceStub(self.channel)
        _log("INFO", "grpc.client.configured", "CLIENT_INIT", "COMPLETED", host, port)

    def ping(self, message: str):
        started_at = time.monotonic()
        _log("INFO", "grpc.client.ping.started", "PING", "STARTED", message)
        try:
            response = self.stub.Ping(aiverse_pb2.PingRequest(message=message), timeout=10)
            _log("INFO", "grpc.client.ping.completed", "PING", "COMPLETED", duration_started_at=started_at)
            return response
        except Exception as error:
            _log("ERROR", "grpc.client.ping.failed", "PING", "FAILURE", error, exc_info=True)
            raise

    def get_server_status(self):
        started_at = time.monotonic()
        _log("INFO", "grpc.client.status.started", "GET_SERVER_STATUS", "STARTED")
        try:
            response = self.stub.GetServerStatus(aiverse_pb2.ServerStatusRequest(), timeout=10)
            _log("INFO", "grpc.client.status.completed", "GET_SERVER_STATUS", "COMPLETED", duration_started_at=started_at)
            return response
        except Exception as error:
            _log("ERROR", "grpc.client.status.failed", "GET_SERVER_STATUS", "FAILURE", error, exc_info=True)
            raise

    def close(self):
        self.channel.close()
