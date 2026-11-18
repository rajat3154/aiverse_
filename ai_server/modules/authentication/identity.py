from uuid import UUID

from aiverse_logging import set_context
from fastapi import Header, HTTPException

from modules.authentication.logs import security_log


async def get_current_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> str:
    """The user the Gateway authenticated, as a canonical UUID string. Never taken from a body or query string."""
    if not x_user_id or not x_user_id.strip():
        security_log("WARNING", "REJECTED", "IDENTITY", "security.identity.rejected", "missing")
        raise HTTPException(status_code=401, detail="Authenticated user identity required")
    try:
        user_id = str(UUID(x_user_id.strip()))
    except ValueError as exc:
        security_log("WARNING", "REJECTED", "IDENTITY", "security.identity.rejected", "not_a_uuid")
        raise HTTPException(status_code=401, detail="Invalid authenticated user identity") from exc
    set_context(user_id=user_id)  # every later log line of this request carries the user id
    return user_id
