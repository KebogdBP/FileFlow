from typing import Any

from fileflow_api.mcp.server import TOOLS, handle


def test_mcp_lists_bounded_tools() -> None:
    response = handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, lambda *_: {})

    assert response is not None
    assert response["result"]["tools"] == TOOLS
    assert {tool["name"] for tool in TOOLS} == {
        "fileflow_get_limits",
        "fileflow_create_job",
        "fileflow_get_job",
        "fileflow_cancel_job",
    }


def test_mcp_forwards_job_calls_without_exposing_credentials() -> None:
    calls: list[tuple[str, str, dict[str, Any] | None]] = []

    def api_call(method: str, path: str, payload: dict[str, Any] | None) -> dict[str, Any]:
        calls.append((method, path, payload))
        return {"id": "a" * 32, "status": "queued"}

    response = handle(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "fileflow_create_job",
                "arguments": {"upload_id": "b" * 32, "operation": "compress-pdf"},
            },
        },
        api_call,
    )

    assert calls == [("POST", "/api/v1/jobs", {"upload_id": "b" * 32, "operation": "compress-pdf"})]
    assert response is not None
    assert response["result"]["structuredContent"]["status"] == "queued"


def test_mcp_returns_tool_errors_as_results() -> None:
    response = handle(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "fileflow_get_job", "arguments": {"job_id": "short"}},
        },
        lambda *_: {},
    )

    assert response is not None
    assert response["result"]["isError"] is True
