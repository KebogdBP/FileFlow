import os
import resource
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProcessLimits:
    timeout_seconds: int
    cpu_seconds: int
    memory_bytes: int
    output_bytes: int
    open_files: int


class SafeSubprocessRunner:
    """Runs server-defined argv without a shell and with OS resource ceilings."""

    def __init__(self, limits: ProcessLimits) -> None:
        self._limits = limits

    def run(self, argv: Sequence[str], workspace: Path) -> None:
        if not argv or not Path(argv[0]).is_absolute():
            raise ValueError("worker executable must use an absolute path")
        environment = {"PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8"}
        result = subprocess.run(
            list(argv),
            cwd=workspace,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
            timeout=self._limits.timeout_seconds,
            check=False,
            close_fds=True,
            preexec_fn=self._apply_limits,
        )
        if result.returncode != 0:
            raise RuntimeError(f"worker process failed with exit code {result.returncode}")

    def _apply_limits(self) -> None:
        resource.setrlimit(resource.RLIMIT_CPU, (self._limits.cpu_seconds,) * 2)
        resource.setrlimit(resource.RLIMIT_AS, (self._limits.memory_bytes,) * 2)
        resource.setrlimit(resource.RLIMIT_FSIZE, (self._limits.output_bytes,) * 2)
        resource.setrlimit(resource.RLIMIT_NOFILE, (self._limits.open_files,) * 2)
        os.umask(0o077)
