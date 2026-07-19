import json
import os
import sys
from collections.abc import Callable
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

JsonObject = dict[str, Any]
ApiCall = Callable[[str, str, JsonObject | None], JsonObject]

TOOLS: list[JsonObject] = [
    {
        "name": "fileflow_get_limits",
        "description": "Read the authenticated FileFlow account's cloud-job usage and limit.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "fileflow_create_job",
        "description": "Start a cloud operation for an already uploaded and safety-cleared file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "upload_id": {"type": "string", "pattern": "^[a-f0-9]{32}$"},
                "operation": {"type": "string", "minLength": 2, "maxLength": 64},
                "parameters": {"type": "object"},
                "source_upload_ids": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["upload_id", "operation"],
            "additionalProperties": False,
        },
    },
    {
        "name": "fileflow_get_job",
        "description": "Read status, progress and result metadata for an owned FileFlow job.",
        "inputSchema": {
            "type": "object",
            "properties": {"job_id": {"type": "string", "pattern": "^[a-f0-9]{32}$"}},
            "required": ["job_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "fileflow_cancel_job",
        "description": "Cancel an owned queued or running FileFlow job.",
        "inputSchema": {
            "type": "object",
            "properties": {"job_id": {"type": "string", "pattern": "^[a-f0-9]{32}$"}},
            "required": ["job_id"],
            "additionalProperties": False,
        },
    },
]


class FileFlowApi:
    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    def call(self, method: str, path: str, payload: JsonObject | None = None) -> JsonObject:
        body = json.dumps(payload).encode() if payload is not None else None
        request = Request(
            f"{self._base_url}{path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "User-Agent": "fileflow-mcp/0.1.0",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                content = response.read()
        except HTTPError as error:
            content = error.read()
            detail = json.loads(content) if content else {"message": error.reason}
            raise RuntimeError(json.dumps(detail, separators=(",", ":"))) from error
        return json.loads(content) if content else {}


def handle(request: JsonObject, api_call: ApiCall) -> JsonObject | None:
    request_id = request.get("id")
    method = request.get("method")
    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2025-11-25",
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "fileflow", "version": "0.1.0"},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}
    if method != "tools/call":
        return _error(request_id, -32601, "Method not found")

    params = request.get("params") or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}
    try:
        if name == "fileflow_get_limits":
            result = api_call("GET", "/api/v1/account/limits", None)
        elif name == "fileflow_create_job":
            result = api_call("POST", "/api/v1/jobs", arguments)
        elif name in {"fileflow_get_job", "fileflow_cancel_job"}:
            job_id = arguments.get("job_id")
            if not isinstance(job_id, str) or len(job_id) != 32:
                raise ValueError("job_id must be a 32-character identifier")
            verb = "GET" if name == "fileflow_get_job" else "DELETE"
            result = api_call(verb, f"/api/v1/jobs/{job_id}", None)
        else:
            return _error(request_id, -32602, "Unknown tool")
    except (RuntimeError, ValueError) as error:
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {"isError": True, "content": [{"type": "text", "text": str(error)}]},
        }
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": {
            "content": [{"type": "text", "text": json.dumps(result, separators=(",", ":"))}],
            "structuredContent": result,
        },
    }


def _error(request_id: Any, code: int, message: str) -> JsonObject:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def main() -> None:
    api_key = os.environ.get("FILEFLOW_API_KEY", "")
    if not api_key:
        raise SystemExit("FILEFLOW_API_KEY is required")
    api = FileFlowApi(os.environ.get("FILEFLOW_API_URL", "http://localhost:8000"), api_key)
    for line in sys.stdin:
        try:
            response = handle(json.loads(line), api.call)
        except (json.JSONDecodeError, TypeError):
            response = _error(None, -32700, "Parse error")
        if response is not None:
            sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
