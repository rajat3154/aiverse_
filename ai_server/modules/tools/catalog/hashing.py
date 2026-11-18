
import hashlib
import json
from dataclasses import asdict
from typing import Any

from modules.tools.core.contracts import ToolDefinition


def canonical_json(value: Any) -> str:
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",", ":"),default=str)

def calculate_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()

def tool_definition_hash(tool: ToolDefinition) -> str:
    return calculate_hash(asdict(tool))
