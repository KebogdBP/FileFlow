# M17 — Social Media Importers

M17 adds YouTube, Instagram and TikTok media imports.

## Delivered

- URL-only creation contract without mandatory rights attestation;
- unrestricted paths on supported platform hosts, including profile, playlist and live URLs;
- no importer-level availability, live-stream or playlist rejection before extraction;
- exact HTTPS host checks and rejection of credentials, custom ports and lookalike domains;
- dedicated asynchronous import queue and persisted lifecycle;
- maintained yt-dlp release with the upstream default security extras;
- fixed MP4-only format selection, byte ceiling, timeouts and bounded retries;
- generated output template with no client filename or command interpolation;
- single regular-file and MP4 magic-byte validation;
- title, creator and thumbnail metadata without exposing the source URL through API responses;
- imported media enters the same temporary retention, quarantine and malware-scan pipeline as direct uploads;
- downstream M16 operations provide audio extraction and conversion after a clean verdict.

Platform extraction is attempted without product-level content restrictions. Availability still depends on what the upstream extractor can access without credentials and on the single-result media contract. Extractor failures fail closed and must be monitored.

The importer image includes Node 22 because current yt-dlp YouTube extraction requires a supported external JavaScript runtime. Network policy should allow only required platform/CDN destinations and deny private address ranges at the infrastructure layer.
