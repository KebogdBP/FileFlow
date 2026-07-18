import socket
import struct
from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class MalwareVerdict(StrEnum):
    CLEAN = "clean"
    INFECTED = "infected"


@dataclass(frozen=True)
class ScanResult:
    verdict: MalwareVerdict
    threat: str | None = None


class MalwareScanner(Protocol):
    def scan(self, chunks: Iterable[bytes]) -> ScanResult: ...


class ClamAVScanner:
    """ClamAV INSTREAM client; content is streamed and never buffered in full."""

    def __init__(self, host: str, port: int, timeout: float) -> None:
        self._host = host
        self._port = port
        self._timeout = timeout

    def scan(self, chunks: Iterable[bytes]) -> ScanResult:
        with socket.create_connection((self._host, self._port), self._timeout) as connection:
            connection.settimeout(self._timeout)
            connection.sendall(b"zINSTREAM\0")
            for chunk in chunks:
                connection.sendall(struct.pack("!I", len(chunk)))
                connection.sendall(chunk)
            connection.sendall(struct.pack("!I", 0))
            response = self._receive(connection).removesuffix("\0")
        if response.endswith(" OK"):
            return ScanResult(MalwareVerdict.CLEAN)
        if response.endswith(" FOUND"):
            threat = response.removeprefix("stream: ").removesuffix(" FOUND")
            return ScanResult(MalwareVerdict.INFECTED, threat=threat[:200])
        raise RuntimeError(f"Unexpected malware scanner response: {response[:200]}")

    @staticmethod
    def _receive(connection: socket.socket) -> str:
        payload = bytearray()
        while len(payload) <= 4096:
            chunk = connection.recv(1024)
            if not chunk:
                break
            payload.extend(chunk)
            if b"\0" in chunk:
                break
        return payload.decode("utf-8", errors="replace")
