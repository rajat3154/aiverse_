import hmac
import os

from fastapi import Header, HTTPException

from modules.authentication.logs import security_log

MIN_SECRET_LENGTH = 32


async def require_gateway_secret(
    x_gateway_secret: str | None = Header(default=None, alias="X-Aiverse-Gateway-Secret"),
) -> None:
    """Only the AIVERSE Gateway may call the AI server: it adds this shared secret to every forwarded request.

    The server refuses to run unauthenticated (503) when the secret is missing or too short, rather than failing open.
    """
    expected = os.getenv("AIVERSE_GATEWAY_SECRET")
    if not expected or len(expected) < MIN_SECRET_LENGTH:
        security_log("ERROR", "FAILURE", "GATEWAY_AUTH", "security.gateway.unconfigured")
        raise HTTPException(status_code=503, detail="Gateway authentication is not configured")
    if not x_gateway_secret:
        security_log("WARNING", "REJECTED", "GATEWAY_AUTH", "security.gateway.rejected", "missing")
        raise HTTPException(status_code=401, detail="Invalid gateway authentication")
    if not hmac.compare_digest(x_gateway_secret.encode(), expected.encode()):
        # the header value itself is never logged
        security_log("WARNING", "REJECTED", "GATEWAY_AUTH", "security.gateway.rejected", "mismatch")
        raise HTTPException(status_code=401, detail="Invalid gateway authentication")
