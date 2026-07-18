from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

Parameter = str | int | float | bool | None


@dataclass(frozen=True)
class WorkRequest:
    input_path: Path
    output_path: Path
    parameters: Mapping[str, Parameter]
    report_progress: Callable[[int], None]


@dataclass(frozen=True)
class WorkResult:
    content_type: str


class OperationHandler(Protocol):
    def execute(self, request: WorkRequest) -> WorkResult: ...


class OperationRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, OperationHandler] = {}

    def register(self, operation: str, handler: OperationHandler) -> None:
        if operation in self._handlers:
            raise ValueError(f"Operation is already registered: {operation}")
        self._handlers[operation] = handler

    def resolve(self, operation: str) -> OperationHandler | None:
        return self._handlers.get(operation)
