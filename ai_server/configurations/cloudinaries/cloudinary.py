import asyncio
import os
from typing import Any, BinaryIO
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

load_dotenv()

log = get_logger("aiverse.ai_server.cloudinary")

DOMAIN = "CLOUDINARY"

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

_initialized = False


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


def initialize_cloudinary():
    global _initialized
    if _initialized:
        return
    missing = [
        name for name, value in (
            ("CLOUDINARY_CLOUD_NAME", CLOUDINARY_CLOUD_NAME),
            ("CLOUDINARY_API_KEY", CLOUDINARY_API_KEY),
            ("CLOUDINARY_API_SECRET", CLOUDINARY_API_SECRET),
        ) if not value
    ]
    if missing:
        _log("ERROR", "cloudinary.config.missing", "INITIALIZE", "FAILURE", ", ".join(missing))
        raise RuntimeError(f"{', '.join(missing)} environment variable(s) required")
    try:
        cloudinary.config(cloud_name=CLOUDINARY_CLOUD_NAME, api_key=CLOUDINARY_API_KEY, api_secret=CLOUDINARY_API_SECRET, secure=True)
        _initialized = True
        _log("INFO", "cloudinary.initialized", "INITIALIZE", "COMPLETED", CLOUDINARY_CLOUD_NAME)
    except Exception as error:
        _log("ERROR", "cloudinary.initialize.failed", "INITIALIZE", "FAILURE", error, exc_info=True)
        raise


async def upload_file(
    file: BinaryIO,
    filename: str,
    folder: str = "aiverse",
    public_id: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    try:
        if not _initialized:
            initialize_cloudinary()
        _log("INFO", "cloudinary.upload.started", "UPLOAD", "STARTED", filename, folder)
        upload_options = {
            "resource_type": "auto",
            "folder": folder,
            "use_filename": True,
            "unique_filename": True,
            "overwrite": False
        }
        if public_id:
            upload_options["public_id"] = public_id
        if tags:
            upload_options["tags"] = tags
        if metadata:
            upload_options["context"] = {key: str(value) for key, value in metadata.items()}
        result = await asyncio.to_thread(cloudinary.uploader.upload, file, **upload_options)
        _log("INFO", "cloudinary.upload.completed", "UPLOAD", "COMPLETED", filename, result.get("public_id"), result.get("resource_type"))
        return {
            "success": True,
            "public_id": result.get("public_id"),
            "resource_type": result.get("resource_type"),
            "type": result.get("type"),
            "format": result.get("format"),
            "version": result.get("version"),
            "url": result.get("url"),
            "secure_url": result.get("secure_url"),
            "width": result.get("width"),
            "height": result.get("height"),
            "bytes": result.get("bytes"),
            "created_at": result.get("created_at"),
            "original_filename": filename
        }
    except Exception as error:
        _log("ERROR", "cloudinary.upload.failed", "UPLOAD", "FAILURE", filename, error, exc_info=True)
        raise


async def delete_file(public_id: str, resource_type: str = "image") -> dict[str, Any]:
    try:
        if not _initialized:
            initialize_cloudinary()
        result = await asyncio.to_thread(cloudinary.uploader.destroy, public_id, resource_type=resource_type)
        _log("INFO", "cloudinary.delete.completed", "DELETE", "COMPLETED", public_id, result.get("result"))
        return result
    except Exception as error:
        _log("ERROR", "cloudinary.delete.failed", "DELETE", "FAILURE", public_id, error, exc_info=True)
        raise
