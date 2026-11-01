from functools import lru_cache
from pathlib import Path

_MESSAGES_FILE = Path(__file__).with_name("messages.properties")


@lru_cache(maxsize=1)
def _load() -> dict[str, str]:
    messages: dict[str, str] = {}
    with _MESSAGES_FILE.open(encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith(("#", "!")):
                continue
            key, separator, value = line.partition("=")
            if separator:
                messages[key.strip()] = value.strip()
    return messages


def get_message(key: str, *args) -> str:
    template = _load().get(key)
    if template is None:
        return key
    return template.format(*args) if args else template
