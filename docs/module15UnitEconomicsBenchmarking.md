# M15 — Unit Economics and Benchmarking

M15 makes cloud-operation economics measurable before format-specific workers are added.

## Delivered

- worker runtime and peak-memory telemetry persisted per job;
- input/output byte accounting from trusted server metadata;
- deterministic Decimal-based cost model for compute, memory, temporary storage, egress and requests;
- configurable pricing assumptions through `FILEFLOW_COST_*` settings;
- per-operation budgets for wall time, memory, output expansion and estimated cost;
- machine-readable benchmark report checker with non-zero exit on regression;
- initial budgets for representative image, video and document workloads.

Run a benchmark report through the gate:

```sh
cd apps/api
.venv/bin/python -m fileflow_api.economics.cli path/to/report.json benchmarks/budgets.json
```

Report entries contain `runtime_ms`, `peak_memory_bytes`, `input_bytes` and `output_bytes`. M16 and M18 must generate reports from fixed, redistributable fixtures before enabling each operation.

The default prices are planning assumptions, not vendor quotations. Deployment configuration must supply reviewed regional prices, and comparisons are only meaningful when the worker shape, fixture checksum and tool version stay fixed.
