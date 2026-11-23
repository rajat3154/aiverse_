"""Reads the official MCP Toolbox documentation to learn which database sources exist and how to connect to them.

For every ``docs/en/integrations/<slug>/source.md`` page it takes the source type, the documentation link and the
connection fields from the page's "Reference" table, so new sources and renamed fields show up without a code change.
Field names are upstream's own (``host``, ``uri``, ``serviceName``...), which is also what the connection tests use.
"""
import json
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Any

from modules.database_toolbox.logs import toolbox_log

GITHUB_API_URL = "https://api.github.com/repos/googleapis/mcp-toolbox/git/trees/main?recursive=1"
RAW_GITHUB_URL = "https://raw.githubusercontent.com/googleapis/mcp-toolbox/main/"
DOCUMENTATION_URL = "https://mcp-toolbox.dev/documentation/integrations/{slug}/source/"

REQUEST_TIMEOUT = 8
MAX_WORKERS = 12

_TEXT_TYPES = {"string", "[]string", "string[]"}  # lists are entered as comma-separated text
_NUMBER_TYPES = {"integer", "int", "int32", "int64", "uint", "uint32", "uint64"}
_SKIPPED_NAMES = {"type", "kind", "name"}
_SECRET = re.compile(r"password|passphrase|secret|token|api_?key|private_?key|client_?key$", re.IGNORECASE)


def _fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "AIVERSE-Database-Catalog"})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse_fields(document: str) -> list[dict[str, Any]]:
    """Connection fields from the page's Reference tables: text and number fields, with upstream's required flag."""
    start = document.find("## Reference")
    if start < 0:
        return []
    example_port = re.search(r"(?m)^port:\s*[\"']?(\d+)", document)
    fields: dict[str, dict[str, Any]] = {}
    table: list[list[str]] = []

    def flush() -> None:
        if len(table) < 2:
            return
        header = [c.lower().strip("*` ") for c in table[0]]
        name_at = next((i for i, c in enumerate(header) if c in ("field", "parameter")), None)
        type_at = header.index("type") if "type" in header else None
        if name_at is None or type_at is None:
            return
        required_at = header.index("required") if "required" in header else None
        optional_table = "default" in header or "values" in header
        for row in table[1:]:
            if len(row) <= max(name_at, type_at):
                continue
            name = row[name_at].strip("*` ")
            kind = row[type_at].strip("*` ").lower()
            if not name or name in _SKIPPED_NAMES or "." in name or name in fields:
                continue
            if kind in _NUMBER_TYPES or name == "port":
                field_type = "integer"
            elif kind in _TEXT_TYPES:
                field_type = "string"
            else:
                continue  
            if required_at is not None:
                required = len(row) > required_at and row[required_at].strip("*` ").lower() == "true"
            else:
                required = not optional_table
            if _SECRET.search(name) and field_type == "string":
                field_type = "secret"
            entry: dict[str, Any] = {"name": name, "type": field_type, "required": required}
            if name == "port" and example_port:
                entry["default"] = int(example_port.group(1))
            fields[name] = entry

    for line in document[start:].splitlines():
        if line.startswith("|"):
            if not re.match(r"^\|[\s:|-]+\|?\s*$", line):
                table.append(_cells(line))
        else:
            flush()
            table = []
    flush()
    return list(fields.values())


def _fetch_source_document(path: str) -> dict[str, Any] | None:
    try:
        request = urllib.request.Request(f"{RAW_GITHUB_URL}{path}", headers={"User-Agent": "AIVERSE-Database-Catalog"})
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            document = response.read().decode("utf-8")
    except (OSError, ValueError, urllib.error.URLError) as exc:
        toolbox_log("WARNING", "FAILURE", "FETCH_SOURCE", "tool.toolbox.discovery.document.failed", path, type(exc).__name__)
        return None

    slug = path.split("/")[-2]
    title = re.search(r"(?m)^title:\s*[\"']?(.+?)[\"']?\s*$", document)
    declared = re.search(r"(?is)kind:\s*source\b.{0,500}?(?m:^type:\s*[\"']?([a-z0-9-]+))", document)
    return {
        "source_type": (declared.group(1).strip() if declared else slug).lower(),
        "directory": slug,
        "name": re.sub(r"\s+Source$", "", title.group(1).strip().strip("\"'") if title else slug.replace("-", " ").title(), flags=re.IGNORECASE),
        "documentation_url": DOCUMENTATION_URL.format(slug=slug),
        "fields": parse_fields(document),
    }


@lru_cache(maxsize=1)
def _discover() -> tuple[str, dict[str, dict[str, Any]]]:
    tree = _fetch_json(GITHUB_API_URL)
    commit = tree.get("sha", "unknown")
    paths = sorted(
        item["path"] for item in tree.get("tree", [])
        if item.get("type") == "blob" and item["path"].startswith("docs/en/integrations/") and item["path"].endswith("/source.md")
    )
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        documents = [d for d in executor.map(_safe_fetch, paths) if d]
    found: dict[str, dict[str, Any]] = {}
    for document in sorted(documents, key=lambda d: d["directory"] != d["source_type"]):
        found.setdefault(document["source_type"], document)
    if not found:
        raise RuntimeError("No source integrations could be discovered from the official Toolbox repository")
    toolbox_log("INFO", "COMPLETED", "DISCOVER", "tool.toolbox.discovery.completed", len(found), len(paths), commit[:7])
    return commit, found


def _safe_fetch(path: str) -> dict[str, Any] | None:
    try:
        return _fetch_source_document(path)
    except Exception as exc: 
        toolbox_log("WARNING", "FAILURE", "FETCH_SOURCE", "tool.toolbox.discovery.document.failed", path, type(exc).__name__)
        return None


def discover_upstream_sources(refresh: bool = False) -> tuple[str, dict[str, dict[str, Any]]]:
    """(upstream commit, {source_type: {name, documentation_url, fields}}). Blocking: call it from a worker thread."""
    if refresh:
        _discover.cache_clear()
    return _discover()
