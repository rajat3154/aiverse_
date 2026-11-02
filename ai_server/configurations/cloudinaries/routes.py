from fastapi import APIRouter, File, UploadFile, HTTPException
from aiverse_logging import get_logger, log_event
from configurations.cloudinaries.cloudinary import upload_file
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.cloudinary.routes")

DOMAIN = "CLOUDINARY"

router = APIRouter(prefix="/api/cloudinary", tags=["Cloudinary"])


@router.post("/upload")
async def upload_to_cloudinary(file: UploadFile = File(...)):
    try:
        result = await upload_file(
            file=file.file,
            filename=file.filename or "unknown",
            folder="aiverse/uploads",
            metadata={
                "original_filename": file.filename or "unknown",
                "content_type": file.content_type or "unknown"
            }
        )
        log_event(log, "INFO", get_message("cloudinary.endpoint.completed", file.filename), domain=DOMAIN, action="UPLOAD_ENDPOINT", outcome="COMPLETED")
        return {
            "status": "success",
            "file": result
        }
    except Exception as error:
        log_event(log, "ERROR", get_message("cloudinary.endpoint.failed", file.filename, error), domain=DOMAIN, action="UPLOAD_ENDPOINT", outcome="FAILURE", exc_info=True)
        raise HTTPException(status_code=500, detail="File upload failed")
