"""Reads a user's saved credential (Credentials page) from the Spring server, which owns and decrypts them.

The AI server never stores the secret: it asks for it for one tool call and uses it in memory. The request is made on the
private link between the two servers (the same AI_INTERNAL_TOKEN Spring uses to call the AI server), not through the gateway.
"""
import os

import httpx

from modules.tools.logs import tool_log

TIMEOUT_SECONDS = 8


class CredentialUnavailable(Exception):
    """The credential could not be read. The message is safe to show to the user."""


async def fetch_secret(user_id: str, credential_id: str) -> str:
    token = os.getenv("AI_INTERNAL_TOKEN", "").strip()
    base = os.getenv("SPRING_SERVER_URL", "http://localhost:8080").rstrip("/")
    if not token:
        raise CredentialUnavailable("The link to the credential manager is not configured (AI_INTERNAL_TOKEN).")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(f"{base}/internal/credentials/{credential_id}/secret", headers={"X-Internal-Token": token, "X-User-Id": user_id})
    except httpx.HTTPError:
        tool_log("WARNING", "FAILURE", "CREDENTIAL", "tool.credential.unreachable")
        raise CredentialUnavailable("The credential manager could not be reached.") from None
    if response.status_code == 404:
        tool_log("WARNING", "FAILURE", "CREDENTIAL", "tool.credential.notfound")
        raise CredentialUnavailable("The selected credential was not found. Choose another one.")
    if response.status_code != 200:
        tool_log("WARNING", "FAILURE", "CREDENTIAL", "tool.credential.rejected", response.status_code)
        raise CredentialUnavailable("The selected credential could not be used. Make sure it is active.")
    secret = (response.json() or {}).get("secret")
    if not isinstance(secret, str) or not secret.strip():
        raise CredentialUnavailable("The selected credential is empty.")
    tool_log("INFO", "COMPLETED", "CREDENTIAL", "tool.credential.fetched")
    return secret.strip()
