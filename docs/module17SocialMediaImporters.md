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
- video imports at best, 1080p, 720p or 480p;
- direct MP3 imports at 128, 192 or 320 kbps;
- optional exact start/end ranges and one selected playlist item;

YouTube playlist and radio parameters are removed before extraction so one pasted
video URL always produces one import. The importer disables third-party yt-dlp
plugins and uses bounded retries. It keeps yt-dlp's maintained default YouTube
client selection rather than forcing the TV client, which can expose only
DRM-marked formats. The importer explicitly enables the Node 22 JavaScript runtime
bundled in the worker image so yt-dlp can solve YouTube signature and `n`
challenges. MP4/M4A is preferred, with WebM and generic DASH fallbacks remuxed to
the single MP4 artifact required by the FileFlow pipeline.

The runtime selection mirrors the maintained standalone downloader: Deno, Node,
Bun and QuickJS are detected in that order, and the official `ejs:github`
component is enabled by default. Set
`FILEFLOW_SOCIAL_IMPORT_ALLOW_REMOTE_EJS=false` in a restricted network and make
the EJS solver available in the image instead.

Every import still produces exactly one quarantined artifact. For a playlist,
the client may choose an item number (1-500); whole-playlist downloads are not
bundled into one unscannable response. Arbitrary-page HTML scraping is also
intentionally excluded because accepting extractor-discovered URLs outside the
platform allowlist would weaken SSRF controls.

The VPS profile also runs a private `bgutil` Proof-of-Origin token provider.
The processing worker reaches it only over the Docker network and asks yt-dlp
to use the `mweb` client with a fresh, video-bound token. Port 4416 is not
published by Caddy or Docker. This handles current YouTube GVS verification on
datacenter IP addresses without exposing tokens or provider endpoints to users.

If YouTube has already blocked the VPS address at the player API layer, a PO
token cannot repair that address. Configure a reputable HTTP(S) or SOCKS egress
proxy through `FILEFLOW_SOCIAL_IMPORT_PROXY_URL`; the processing worker passes it
to yt-dlp for both metadata and media requests. Keep proxy credentials only in
the server `.env`, never in source control.

Platform extraction is attempted without product-level content restrictions.
Availability still depends on what the upstream extractor can access from the
server's network and on the single-result media contract. Extractor failures fail
closed and are persisted as stable error codes for the web client.

YouTube can require an authenticated browser session for datacenter IP addresses.
When that happens, export a Netscape-format cookies file from an account that is
permitted to access the video, mount it read-only outside the application image,
and set:

```text
FILEFLOW_SOCIAL_IMPORT_COOKIES_FILE=/run/secrets/social-import-cookies.txt
```

Never commit this file, put it in a Docker image, or expose it to the web client.
Rotate or remove it if the account session changes. Without configured cookies the
importer returns `platform_auth_required`; when a configured file is missing it
returns `platform_auth_unavailable`.

If a locally installed yt-dlp plugin breaks otherwise public downloads, start the
process with `FILEFLOW_SOCIAL_IMPORT_DISABLE_PLUGINS=true`. This must be set
before Python imports yt-dlp and cannot be combined with the configured bgutil
PO-token provider, which is itself a plugin.

The importer image includes Node 22 because current yt-dlp YouTube extraction requires a supported external JavaScript runtime. Network policy should allow only required platform/CDN destinations and deny private address ranges at the infrastructure layer.
