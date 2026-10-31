from fastapi import FastAPI
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app=FastAPI(
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
    try:
        response = {
            "status": "healthy" ,
            "service": "AIverse AI Server",
            "rabbitmq": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return response
    except Exception as error:
        raise