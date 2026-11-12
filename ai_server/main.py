from contextlib import asynccontextmanager
from fastapi import FastAPI
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from aiverse_logging import (
    configure_logging,
    generate_request_id,
    get_logger,
    log_context,
    log_event,
)
from configurations.messages import get_message
from configurations.grpc.server.grpc_server import start_grpc_server, stop_grpc_server
from configurations.databases.database import AsyncSessionLocal, close_database, init_database
from modules.llm_providers.loader import ProviderLoader
from modules.llm_providers.registry import provider_registry
from modules.llm_providers.routes import router as llm_providers_router
from modules.llm_providers.synchronizer import ProviderSynchronizer
from configurations.rabbitmqs.handlers import handle_ai_request
from configurations.rabbitmqs.rabbitmq import rabbitmq
from configurations.cache.redis import redis_manager
from configurations.sseevents.connection.sse_connection_manager import initialize_sse, shutdown_sse
from configurations.cloudinaries.cloudinary import initialize_cloudinary
from configurations.cloudinaries.routes import router as cloudinary_router
from configurations.websockets.manager import initialize_websocket, shutdown_websocket
from configurations.websockets.websocket import router as websocket_router, manager as websocket_manager
from configurations.socketio.socketio import initialize_socketio, shutdown_socketio, sio
from configurations.sseevents.routes.sse_routes import router as sse_router

import socketio
import time

load_dotenv()

configure_logging("ai_server")
log = get_logger("aiverse.ai_server")
log_event(log, "INFO", get_message("system.server.initialized"), domain="SYSTEM", action="STARTUP", outcome="COMPLETED")

provider_synchronizer = ProviderSynchronizer()

@asynccontextmanager
async def lifespan(_: FastAPI):
    grpc_server = None
    try:
        await init_database()

        # Load provider manifests and synchronize the Spring-owned catalog table.
        provider_loader = ProviderLoader()
        loaded_providers = provider_loader.load_all()

        async with AsyncSessionLocal() as session:
            sync_result = await provider_synchronizer.synchronize(
                session,
                loaded_providers
            )

        provider_registry.replace_all(loaded_providers)

        log_event(
            log,
            "INFO",
            "LLM provider catalog synchronized",
            domain="LLM",
            action="PROVIDER_SYNC",
            outcome="COMPLETED",
            context={
                **sync_result.to_dict(),
                "registry_count": provider_registry.count()
            }
        )

        # Initialize existing services.
        await redis_manager.connect()
        initialize_sse()
        initialize_socketio()
        initialize_websocket()
        try:
            initialize_cloudinary()
        except Exception:
            log_event(
                log,
                "WARNING",
                "Cloudinary initialization failed",
                domain="CLOUDINARY",
                action="INITIALIZATION",
                outcome="FAILURE",
                exc_info=True
            )
        grpc_server = start_grpc_server()
        await rabbitmq.connect()
        await rabbitmq.consume(handle_ai_request)
        yield
    finally:
        await shutdown_websocket(websocket_manager)
        await shutdown_socketio()
        shutdown_sse()
        if grpc_server is not None:
            stop_grpc_server(grpc_server)
        await rabbitmq.close()
        await redis_manager.close()
        provider_registry.clear()
        await close_database()


app=FastAPI(
    lifespan=lifespan,
    title="AIVerse AI Server",
    description="AIverse backend API for AI workflows, tools, environments, and collaboration.",
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "AI Verse Development Team",
        "email": "support@aiverse.com",
        "url": "https://aiverse.vercel.app",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]     

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_logging_middleware(request, call_next):
    request_id = request.headers.get("X-Request-ID") or generate_request_id()
    start_time = time.perf_counter()

    with log_context(
        request_id=request_id,
        http_method=request.method,
        http_path=request.url.path
    ):
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            response.headers["X-Request-ID"] = request_id

            log_event(
                log, "INFO", get_message("api.http.request.completed"),
                domain="API", action="HTTP_REQUEST", outcome="COMPLETED",
                context={"http_status_code": response.status_code, "duration_ms": duration_ms},
            )
            return response
        except Exception:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            log_event(
                log, "ERROR", get_message("api.http.request.failed"),
                domain="API", action="HTTP_REQUEST", outcome="FAILURE",
                context={"http_status_code": 500, "duration_ms": duration_ms},
                exc_info=True,
            )
            raise

app.include_router(sse_router)
app.include_router(websocket_router)
app.include_router(cloudinary_router)
app.include_router(llm_providers_router)
app.mount("/socket.io", socketio.ASGIApp(sio, socketio_path=""))

@app.get("/", tags=["Health"])
async def root():
      response = {
            "name":"AIVERSE AI Server",
            "version":"1.0.0",
            "status":"running",
            "timestamp":datetime.now(timezone.utc).isoformat()
      }
      return response

@app.get("/health", tags=["Health"])
async def health():
    rabbitmq_connected = await rabbitmq.health()
    redis_connected = await redis_manager.health()
    provider_health = provider_registry.health()
    services = {
        "rabbitmq": "connected" if rabbitmq_connected else "disconnected",
        "redis": "connected" if redis_connected else "disconnected",
        "llm_providers": (
            "connected" if provider_health["initialized"] else "disconnected"
        ),
    }
    healthy = (
        rabbitmq_connected
        and (
            redis_connected or not redis_manager.settings.enabled
        )
        and provider_health["initialized"]
    )
    return {
        "status": "healthy" if healthy else "degraded",
        "service": "AIVERSE AI Server",
        "services": services,
        "llm_providers": provider_health,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
