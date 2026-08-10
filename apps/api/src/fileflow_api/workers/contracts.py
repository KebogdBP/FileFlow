from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

Parameter = str | int | float | bool | None


class WorkerExecutionFailure(RuntimeError):
    """A safe, stable failure code that may be returned to a client."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class InvalidJobParameters(WorkerExecutionFailure):
    """The submitted operation settings do not match the selected operation."""

    def __init__(self) -> None:
        super().__init__("invalid_job_parameters")


@dataclass(frozen=True)
class WorkRequest:
    input_path: Path
    input_paths: tuple[Path, ...]
    output_path: Path
    parameters: Mapping[str, Parameter]
    report_progress: Callable[[int], None]


@dataclass(frozen=True)
class WorkResult:
    content_type: str


class OperationHandler(Protocol):
    def accepts(self, content_type: str) -> bool: ...

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
