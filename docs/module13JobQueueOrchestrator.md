# M13 — Job Queue and Orchestrator

M13 adds a durable boundary between API requests and cloud work without implementing media or document processing.

## Delivered

- Redis-backed Celery broker and short-lived result backend;
- separate `safety` and `processing` routes;
- JSON-only messages, late acknowledgement, worker-loss rejection and prefetch of one;
- persisted job state, progress, attempts, timestamps and stable error codes;
- create, inspect and cancel job API contracts;
- mandatory `clean` safety verdict at both enqueue and worker-start boundaries;
- one active job per upload by default;
- queue failure persistence and non-destructive cancellation;
- automatic safety scan dispatch after multipart completion;
- safety worker with bounded exponential retry for transient scanner failures.

The processing task name is reserved as `fileflow.jobs.execute`. M14 supplies the worker implementation; M13 deliberately does not claim that unsupported processing can run.

Configuration uses `FILEFLOW_REDIS_URL`, bounded soft/hard time limits and `FILEFLOW_MAX_ACTIVE_JOBS_PER_UPLOAD`.
