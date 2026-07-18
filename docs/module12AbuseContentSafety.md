# M12 — Abuse and Content Safety Foundation

M12 keeps every completed cloud upload quarantined until its bytes pass server-side checks.

## Delivered

- persisted `pending`, `scanning`, `clean`, `rejected` and `error` verdicts;
- declared-size verification against S3 object metadata;
- magic-byte detection for supported image, audio, video, PDF and DOCX containers;
- declared MIME versus detected signature verification;
- streaming ClamAV `INSTREAM` adapter without buffering whole files;
- immediate deletion of signature-mismatched and malware-positive objects;
- `require_clean` gate for every future job consumer;
- scanner failures fail closed and are persisted for controlled retry.

M13 may enqueue scans and processing jobs, but processing must call `require_clean` before reading an object. A client-provided filename, MIME value, ETag or extension is never a safety verdict.

ClamAV is configured with `FILEFLOW_MALWARE_SCANNER_HOST`, `FILEFLOW_MALWARE_SCANNER_PORT` and `FILEFLOW_MALWARE_SCANNER_TIMEOUT_SECONDS`.

The backend Compose profile includes the official ClamAV 1.4 LTS base image and persists its signature database. Initial startup can take longer while FreshClam populates that volume; the scanner must be healthy before safety work is dispatched.
