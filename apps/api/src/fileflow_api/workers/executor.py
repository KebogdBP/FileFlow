import resource
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from time import monotonic

from fileflow_api.config import Settings
from fileflow_api.jobs.models import JobStatus
from fileflow_api.jobs.service import JobService
from fileflow_api.safety.service import SafetyService
from fileflow_api.uploads.storage import ObjectStorage
from fileflow_api.workers.contracts import OperationRegistry, WorkRequest


class CloudJobExecutor:
    def __init__(
        self,
        jobs: JobService,
        safety: SafetyService,
        storage: ObjectStorage,
        operations: OperationRegistry,
        settings: Settings,
    ) -> None:
        self._jobs = jobs
        self._safety = safety
        self._storage = storage
        self._operations = operations
        self._settings = settings

    def execute(self, job_id: str) -> JobStatus:
        job = self._jobs.start(job_id)
        handler = self._operations.resolve(job.operation)
        if handler is None:
            return self._jobs.fail(job_id, "unsupported_operation").status
        upload = self._safety.require_clean(job.upload_id)
        if not handler.accepts(upload.content_type):
            return self._jobs.fail(job_id, "unsupported_input_type").status
        started = monotonic()
        try:
            with TemporaryDirectory(prefix=f"fileflow-{job.id}-") as directory:
                workspace = Path(directory)
                source = workspace / "source"
                result_path = workspace / "result"
                self._materialize(upload.object_key, source)
                sources = [source]
                for index, upload_id in enumerate(job.source_upload_ids, start=1):
                    additional = self._safety.require_clean(upload_id)
                    if not handler.accepts(additional.content_type):
                        raise ValueError("additional source has an unsupported input type")
                    path = workspace / f"source-{index}"
                    self._materialize(additional.object_key, path)
                    sources.append(path)

                def report_progress(value: int) -> None:
                    self._jobs.progress(job.id, value)

                result = handler.execute(
                    WorkRequest(
                        input_path=source,
                        input_paths=tuple(sources),
                        output_path=result_path,
                        parameters=job.parameters,
                        report_progress=report_progress,
                    )
                )
                if result_path.is_symlink() or not result_path.is_file():
                    raise ValueError("worker output must be a regular file")
                if (
                    not result.content_type
                    or len(result.content_type) > 127
                    or any(ord(character) < 32 for character in result.content_type)
                ):
                    raise ValueError("worker returned an invalid content type")
                size = result_path.stat().st_size
                if size <= 0 or size > self._settings.worker_max_output_bytes:
                    raise ValueError("worker output violates size limits")
                key = f"temporary/results/{job.id}/result"
                self._storage.upload_file(key, result_path, result.content_type)
                self._jobs.attach_result(job.id, key, result.content_type, size)
            return self._jobs.succeed(job.id).status
        except Exception:
            self._jobs.fail(job.id, "worker_execution_failed")
            raise
        finally:
            current_peak = max(0, resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
            # Linux reports KiB while macOS reports bytes.
            peak_bytes = current_peak if sys.platform == "darwin" else current_peak * 1024
            self._jobs.record_metrics(job.id, int((monotonic() - started) * 1000), peak_bytes)

    def _materialize(self, key: str, destination: Path) -> None:
        written = 0
        with destination.open("xb") as output:
            for chunk in self._storage.iter_object(key):
                written += len(chunk)
                if written > self._settings.max_upload_bytes:
                    raise ValueError("source exceeds configured upload limit")
                output.write(chunk)
