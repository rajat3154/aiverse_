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
from configurations.databases.database import close_database, init_database
from configurations.rabbitmqs.handlers import handle_ai_request
from configurations.rabbitmqs.rabbitmq import rabbitmq
from configurations.sseevents.connection.sse_connection_manager import initialize_sse, shutdown_sse
from configurations.sseevents.routes.sse_routes import router as sse_router

import time

load_dotenv()

configure_logging("ai_server")
log = get_logger("aiverse.ai_server")
log_event(log, "INFO", get_message("system.server.initialized"), domain="SYSTEM", action="STARTUP", outcome="COMPLETED")

@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_database()
    initialize_sse()
    grpc_server = start_grpc_server()
    try:
        await rabbitmq.connect()
        await rabbitmq.consume(handle_ai_request)
        yield
    finally:
        shutdown_sse()
        stop_grpc_server(grpc_server)
        await rabbitmq.close()
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
    return {
        "status": "healthy" if rabbitmq_connected else "degraded",
        "service": "AIverse AI Server",
        "rabbitmq": "connected" if rabbitmq_connected else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }