import ipaddress
from urllib.parse import urlsplit, urlunsplit

from fastapi import HTTPException

PROVIDER_HOSTS = {
    "youtube": {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"},
    "instagram": {"instagram.com", "www.instagram.com"},
    "tiktok": {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"},
    "facebook": {
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "web.facebook.com",
        "fb.watch",
    },
    "vk": {
        "vk.com",
        "www.vk.com",
        "m.vk.com",
        "vk.ru",
        "www.vk.ru",
        "vkvideo.ru",
        "www.vkvideo.ru",
    },
    "rutube": {"rutube.ru", "www.rutube.ru"},
}


def validate_social_url(value: str) -> tuple[str, str]:
    parsed = urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        raise HTTPException(status_code=422, detail="Only safe HTTPS platform URLs are allowed.")
    provider = next((name for name, hosts in PROVIDER_HOSTS.items() if host in hosts), None)
    if provider is None:
        raise HTTPException(status_code=422, detail="Social platform URL is not supported.")
    canonical = urlunsplit(("https", host, parsed.path, parsed.query, ""))
    return provider, canonical


def validate_public_url(value: str) -> tuple[str, str]:
    parsed = urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username
        or parsed.password
        or parsed.port
        or host == "localhost"
        or host.endswith(".localhost")
    ):
        raise HTTPException(status_code=422, detail="Only safe public HTTPS URLs are allowed.")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise HTTPException(status_code=422, detail="Only safe public HTTPS URLs are allowed.")
    canonical = urlunsplit(("https", host, parsed.path, parsed.query, ""))
    return "generic", canonical
