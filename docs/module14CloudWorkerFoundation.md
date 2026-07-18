# M14 — Cloud Worker Foundation

M14 turns queued processing jobs into a controlled worker lifecycle without adding format-specific transformations.

## Delivered

- server-owned operation registry; clients cannot submit commands or executable paths;
- clean-upload verification again immediately before execution;
- private per-job temporary workspace with generated input and output names;
- streamed S3 input materialization with configured byte ceilings;
- output size validation and S3-compatible result persistence;
- persisted result MIME, size and private object key;
- deterministic `queued → running → succeeded/failed` transitions and progress callback;
- registered Celery processing task with unsupported-operation failure handling;
- subprocess runner with no shell, minimal environment, closed file descriptors and OS limits for CPU, address space, output size, open files and wall-clock time;
- automatic temporary workspace cleanup on success and failure.

M16 and M18 register media and document handlers. They must construct argv from validated server-side presets and must never pass client strings as commands.

Run a processing consumer with `pnpm api:worker:processing`. Production workers should additionally run in an unprivileged, read-only container with no outbound network unless a specific operation requires an allowlisted destination.
