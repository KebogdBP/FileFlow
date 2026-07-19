# M20 — Batch Processing

M20 adds honest, bounded image batching to the unified workspace.

## Delivered

- multi-file picker and drag-and-drop intake for up to 20 supported files;
- local signature inspection for every item before a shared operation is offered;
- a compatible JPG/PNG gate that prevents mixed or mismatched sources entering the batch;
- shared WebP quality and maximum-dimension settings;
- sequential browser-worker execution to bound memory use;
- per-item lifecycle, aggregate progress and whole-batch cancellation;
- individual signature-validated WebP downloads;
- no upload or cloud-job claim for local image batches;
- responsive and accessible status presentation;
- unit and interaction coverage for limits, grouped progress and batch planning.

Cloud operations continue to use the existing reviewed handoff. Durable server-side fan-out and
account history belong with authenticated quotas and history in M21.
