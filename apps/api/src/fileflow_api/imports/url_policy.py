from urllib.parse import parse_qs, urlsplit, urlunsplit

from fastapi import HTTPException

PROVIDER_HOSTS = {
    "youtube": {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"},
    "instagram": {"instagram.com", "www.instagram.com"},
    "tiktok": {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"},
}


def validate_social_url(value: str) -> tuple[str, str]:
    parsed = urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        raise HTTPException(status_code=422, detail="Only public HTTPS platform URLs are allowed.")
    provider = next((name for name, hosts in PROVIDER_HOSTS.items() if host in hosts), None)
    if provider is None or not parsed.path or parsed.path == "/":
        raise HTTPException(status_code=422, detail="Social platform URL is not supported.")
    supported_path = {
        "youtube": (
            host == "youtu.be"
            or parsed.path.startswith(("/shorts/", "/live/"))
            or (parsed.path == "/watch" and bool(parse_qs(parsed.query).get("v")))
        ),
        "instagram": parsed.path.startswith(("/p/", "/reel/", "/tv/")),
        "tiktok": host in {"vm.tiktok.com", "vt.tiktok.com"}
        or (parsed.path.startswith("/@") and "/video/" in parsed.path),
    }[provider]
    if not supported_path:
        raise HTTPException(status_code=422, detail="Social platform URL is not supported.")
    canonical = urlunsplit(("https", host, parsed.path, parsed.query, ""))
    return provider, canonical
