"""Encrypts the secret part of a saved connection (passwords, API keys) before it reaches the database."""
import json
import os
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

KEY_ENV = "DATABASE_CONNECTIONS_ENCRYPTION_KEY"


class EncryptionNotConfigured(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = (os.getenv(KEY_ENV) or "").strip()
    if not key:
        raise EncryptionNotConfigured(f"{KEY_ENV} is not set")
    try:
        return Fernet(key.encode())
    except ValueError as exc:
        raise EncryptionNotConfigured(f"{KEY_ENV} is not a valid Fernet key") from exc


def encrypt_secrets(secrets: dict[str, Any]) -> str | None:
    if not secrets:
        return None
    return _fernet().encrypt(json.dumps(secrets, separators=(",", ":")).encode()).decode()


def decrypt_secrets(token: str | None) -> dict[str, Any]:
    if not token:
        return {}
    try:
        return json.loads(_fernet().decrypt(token.encode()).decode())
    except InvalidToken as exc:
        raise EncryptionNotConfigured("Saved secrets cannot be decrypted with the configured key") from exc
