# M17 — Social Media Importers

M17 adds rights-aware imports for public YouTube, Instagram and TikTok media.

## Delivered

- explicit `owned`, `authorized` or `public_domain` rights basis and mandatory confirmation;
- exact HTTPS host and public-content path allowlists;
- rejection of credentials, custom ports, lookalike domains, playlists, live streams and access-controlled media;
- dedicated asynchronous import queue and persisted lifecycle;
- maintained yt-dlp release with the upstream default security extras;
- fixed MP4-only format selection, byte ceiling, timeouts and bounded retries;
- generated output template with no client filename or command interpolation;
- single regular-file and MP4 magic-byte validation;
- title, creator and thumbnail metadata without exposing the source URL through API responses;
- imported media enters the same temporary retention, quarantine and malware-scan pipeline as direct uploads;
- downstream M16 operations provide audio extraction and conversion after a clean verdict.

No browser cookies, account login, private profiles, DRM bypass, playlists or live capture are supported. Platform availability and terms can change independently, so extractor failures are expected to fail closed and must be monitored.

The importer image includes Node 22 because current yt-dlp YouTube extraction requires a supported external JavaScript runtime. Network policy should allow only required platform/CDN destinations and deny private address ranges at the infrastructure layer.
