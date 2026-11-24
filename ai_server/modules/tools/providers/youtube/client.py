import json
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

API_KEY_ENV = "YOUTUBE_API_KEY"
MAX_RESULTS = 50
NO_KEY_TOOLS = {"youtube_get_transcript"}
TOOLS_FILE = Path(__file__).parent / "data" / "tools.json"


def load_specs() -> list[dict[str, Any]]:
    return json.loads(TOOLS_FILE.read_text(encoding="utf-8"))


def _video_url(value: str) -> str:
    value = value.strip()
    if "://" not in value:
        return value
    parsed = urlparse(value)
    host = parsed.netloc.lower().removeprefix("www.")
    video_id = None
    if host == "youtu.be":
        video_id = parsed.path.strip("/").split("/")[0]
    elif host.endswith("youtube.com"):
        video_id = parse_qs(parsed.query).get("v", [None])[0]
        parts = [part for part in parsed.path.split("/") if part]
        if not video_id and len(parts) >= 2 and parts[0] in {"shorts", "embed", "live"}:
            video_id = parts[1]
    if not video_id:
        raise ValueError("Provide a valid YouTube video URL or video ID.")
    return f"https://www.youtube.com/watch?v={video_id}"


def _playlist_url(value: str) -> str:
    value = value.strip()
    playlist_id = value if "://" not in value else parse_qs(urlparse(value).query).get("list", [None])[0]
    if not playlist_id:
        raise ValueError("Provide a valid YouTube playlist URL or playlist ID.")
    return f"https://www.youtube.com/playlist?list={playlist_id}"


def _text(arguments: dict[str, Any], key: str) -> str:
    value = arguments.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"'{key}' is required.")
    return value.strip()

def _count(arguments: dict[str, Any], default: int) -> int:
    try:
        return max(1, min(MAX_RESULTS, int(arguments.get("max_results", default))))
    except (TypeError, ValueError) as exc:
        raise ValueError("'max_results' must be a number.") from exc

def retrieve(tool_id: str, arguments: dict[str, Any], api_key: str | None) -> list[Any]:
    from langchain_youtube import (
        YouTubeCommentsRetriever,
        YouTubePlaylistRetriever,
        YouTubeSearchRetriever,
        YouTubeTranscriptRetriever,
        YouTubeVideoRetriever,
    )

    if tool_id == "youtube_search_videos":
        retriever = YouTubeSearchRetriever(api_key=api_key, max_results=_count(arguments, 10), order=arguments.get("order", "relevance"))
        return retriever.invoke(_text(arguments, "query"))
    if tool_id == "youtube_get_transcript":
        languages = arguments.get("languages") or ["en"]
        if not isinstance(languages, list) or not all(isinstance(item, str) for item in languages):
            raise ValueError("'languages' must be an array of language codes.")
        try:
            chunk_size = max(200, min(10000, int(arguments.get("chunk_size", 3000))))
        except (TypeError, ValueError) as exc:
            raise ValueError("'chunk_size' must be a number.") from exc
        return YouTubeTranscriptRetriever(languages=languages, chunk_size=chunk_size).invoke(_video_url(_text(arguments, "video_url")))
    if tool_id == "youtube_get_playlist_videos":
        retriever = YouTubePlaylistRetriever(api_key=api_key, playlist_url=_playlist_url(_text(arguments, "playlist_url")), max_results=_count(arguments, 50))
        return retriever.invoke("fetch")
    if tool_id == "youtube_get_video":
        return YouTubeVideoRetriever(api_key=api_key).invoke(_video_url(_text(arguments, "video_url")))
    retriever = YouTubeCommentsRetriever(api_key=api_key, max_results=_count(arguments, 20), order=arguments.get("order", "relevance"))
    return retriever.invoke(_video_url(_text(arguments, "video_url")))
