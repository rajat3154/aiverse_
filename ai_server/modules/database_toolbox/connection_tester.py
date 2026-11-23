import asyncio
import re
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable

from modules.database_toolbox.logs import connection_log




TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class TestResult:
    success: bool
    message: str
    error_code: str = ""
    latency_ms: int = 0


class ConfigError(ValueError):
    """The submitted configuration is missing or malformed."""


def _require(config: dict[str, Any], *names: str) -> list[Any]:
    missing = [n for n in names if config.get(n) in (None, "")]
    if missing:
        raise ConfigError("Missing required field(s): " + ", ".join(missing))
    return [config[n] for n in names]


def _port(config: dict[str, Any], default: int) -> int:
    raw = config.get("port")
    if raw in (None, ""):
        return default
    try:
        return int(raw)
    except (TypeError, ValueError) as exc:
        raise ConfigError("Port must be a number") from exc


def _postgres(config: dict[str, Any]) -> str:
    import asyncpg

    host, database, user = _require(config, "host", "database", "user")
    port = _port(config, 5432)

    async def run() -> str:
        connection = await asyncpg.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=config.get("password") or None,
            timeout=TIMEOUT_SECONDS,
        )
        try:
            version = await connection.fetchval("SELECT version()")
        finally:
            await connection.close()
        return str(version).split(",")[0]

    return asyncio.run(run())


def _mysql(config: dict[str, Any]) -> str:
    import pymysql

    host, database, user = _require(config, "host", "database", "user")
    connection = pymysql.connect(
        host=host,
        port=_port(config, 3306),
        user=user,
        password=config.get("password") or "",
        database=database,
        connect_timeout=TIMEOUT_SECONDS,
        read_timeout=TIMEOUT_SECONDS,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            return f"MySQL {cursor.fetchone()[0]}"
    finally:
        connection.close()


def _mssql(config: dict[str, Any]) -> str:
    import pyodbc

    server = config.get("host") or config.get("server")
    if not server:
        raise ConfigError("Missing required field(s): host")
    database, user = _require(config, "database", "user")
    drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
    if not drivers:
        raise RuntimeError("DRIVER_MISSING")
    driver = sorted(drivers)[-1]
    connection = pyodbc.connect(
        f"DRIVER={{{driver}}};SERVER={server},{_port(config, 1433)};"
        f"DATABASE={database};UID={user};PWD={config.get('password') or ''};"
        "TrustServerCertificate=yes",
        timeout=TIMEOUT_SECONDS,
    )
    try:
        return str(connection.cursor().execute("SELECT @@VERSION").fetchone()[0]).splitlines()[0]
    finally:
        connection.close()


def _mongodb(config: dict[str, Any]) -> str:
    from pymongo import MongoClient

    (uri,) = _require(config, "uri")
    client = MongoClient(
        str(uri),
        serverSelectionTimeoutMS=TIMEOUT_SECONDS * 1000,
        connectTimeoutMS=TIMEOUT_SECONDS * 1000,
    )
    try:
        client.admin.command("ping")
        return f"MongoDB {client.server_info().get('version', '')}".strip()
    finally:
        client.close()


def _address(value: Any, default_port: int) -> tuple[str, int]:
    """First host[:port] of a comma-separated address list."""
    first = str(value).split(",")[0].strip()
    first = re.sub(r"^[a-z]+://", "", first)
    host, _, port = first.rpartition(":")
    if not host:
        return first, default_port
    try:
        return host, int(port)
    except ValueError as exc:
        raise ConfigError("Address must look like host:port") from exc


def _redis(config: dict[str, Any]) -> str:
    import redis
    from redis.backoff import NoBackoff
    from redis.retry import Retry

    (address,) = _require(config, "address")
    host, port = _address(address, 6379)
    client = redis.Redis(
        host=host,
        port=port,
        username=config.get("username") or None,
        password=config.get("password") or None,
        db=int(config.get("database") or 0),
        socket_connect_timeout=TIMEOUT_SECONDS,
        socket_timeout=TIMEOUT_SECONDS,
        retry=Retry(NoBackoff(), 0),
    )
    try:
        client.ping()
        return f"Redis-compatible server {client.info('server').get('redis_version', '')}".strip()
    finally:
        client.close()


def _oracle(config: dict[str, Any]) -> str:
    import oracledb

    user, password = _require(config, "user", "password")
    if config.get("connectionString"):
        target: dict[str, Any] = {"dsn": str(config["connectionString"])}
    else:
        host, service = _require(config, "host", "serviceName")
        target = {"host": host, "port": _port(config, 1521), "service_name": service}
    connection = oracledb.connect(user=user, password=password, tcp_connect_timeout=TIMEOUT_SECONDS, **target)
    try:
        return f"Oracle Database {connection.version}"
    finally:
        connection.close()


def _elasticsearch(config: dict[str, Any]) -> str:
    (addresses,) = _require(config, "addresses")
    url = str(addresses).split(",")[0].strip()
    if not url.startswith(("http://", "https://")):
        raise ConfigError("Addresses must start with http:// or https://")
    request = urllib.request.Request(url)
    if config.get("apikey"):
        request.add_header("Authorization", f"ApiKey {config['apikey']}")
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        body = json.loads(response.read().decode("utf-8"))
    return f"Elasticsearch {body.get('version', {}).get('number', '')}".strip()


# source_type -> tester. Anything else reports UNSUPPORTED rather than guessing.
TESTERS: dict[str, Callable[[dict[str, Any]], str]] = {
    "postgres": _postgres,
    "cockroachdb": _postgres,
    "mysql": _mysql,
    "mssql": _mssql,
    "mongodb": _mongodb,
    "redis": _redis,
    "valkey": _redis,
    "oracle": _oracle,
    "elasticsearch": _elasticsearch,
}


def supported_source_types() -> list[str]:
    return sorted(TESTERS)


def _scrub(text: str, config: dict[str, Any]) -> str:
    """Never echo submitted secrets (passwords, keys, connection URIs with credentials) back in an error message."""
    for name in ("password", "apikey", "uri", "connectionString"):
        secret = str(config.get(name) or "")
        if len(secret) >= 4:
            text = text.replace(secret, "***")
    return text


def _classify(error: Exception) -> tuple[str, str]:
    if isinstance(error, ConfigError):
        return "INVALID_CONFIG", str(error)
    if isinstance(error, RuntimeError) and str(error) == "DRIVER_MISSING":
        return "DRIVER_MISSING", "No SQL Server ODBC driver is installed on the AI server."
    if isinstance(error, ImportError):
        return "DRIVER_MISSING", "The database driver for this source is not installed on the AI server."
    text = f"{type(error).__name__}: {error}".lower()
    if isinstance(error, (TimeoutError, asyncio.TimeoutError)) or "timed out" in text or "timeout" in text:
        return "TIMEOUT", "The server did not respond in time."
    if any(k in text for k in ("password", "authentication", "access denied", "auth failed", "invalid credentials", "ora-01017", "401")):
        return "AUTH_FAILED", "Authentication failed. Check the user and password."
    if any(k in text for k in ("refused", "unreachable", "name or service", "getaddrinfo", "nodename", "could not translate", "no route", "unknown host", "11001", "10061")):
        return "UNREACHABLE", "Could not reach the host. Check the host and port."
    return "CONNECTION_FAILED", str(error) or type(error).__name__


def test_connection(source_type: str, config: dict[str, Any]) -> TestResult:
    tester = TESTERS.get((source_type or "").strip().lower())
    if tester is None:
        return TestResult(False, f"Testing '{source_type}' connections is not supported yet.", "UNSUPPORTED")

    started = time.perf_counter()
    try:
        detail = tester(config)
    except Exception as error:  # noqa: BLE001 - every driver raises its own types
        code, message = _classify(error)
        if code == "CONNECTION_FAILED":
            # Unclassified driver error: record the type so new cases can be mapped; the message may echo input.
            connection_log("WARNING", "FAILURE", "TEST", "integration.dbconn.unclassified", source_type, type(error).__name__)
        return TestResult(False, _scrub(message, config), code, int((time.perf_counter() - started) * 1000))
    return TestResult(True, f"Connected. {detail}".strip(), "", int((time.perf_counter() - started) * 1000))
