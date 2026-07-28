# Social video downloader research

Updated: 2026-07-29.

## What working services actually do

There is no official cross-platform "download API". A typical service accepts a
public post URL, validates the hostname, resolves the platform's public page or
player metadata on a server, selects one or more CDN media streams, downloads or
proxies them with the required request headers, and uses FFmpeg to merge,
remux, trim, or extract audio.

Representative open-source service Cobalt uses this shape:

1. strict service URL matching;
2. a platform adapter for metadata and expiring CDN URLs;
3. service-scoped cookies when public anonymous access is insufficient;
4. a proxy/stream layer that preserves required headers;
5. FFmpeg for separate audio/video tracks and local-processing responses;
6. rate limits and instance protection.

FileFlow follows the same architecture with maintained yt-dlp extractors instead
of copying Cobalt's AGPL-licensed platform adapters. The processing stays on the
server because browser CORS, short-lived URLs, IP binding, cookies, separate
DASH tracks, and TLS fingerprinting make a client-only implementation unreliable.

## Platform-specific path

### YouTube

yt-dlp reads the public player response, solves the current JavaScript signature
and `n` challenges through its EJS package and Node 22, selects compatible
audio/video streams, downloads the fragments, and asks FFmpeg to merge or remux
them. Datacenter traffic can additionally require a video/session-bound
Proof-of-Origin token. FileFlow uses an internal bgutil provider with the `mweb`
client and falls back to the public TV client.

A PO token does not repair an IP address that YouTube has already blocked.
That case requires a clean egress IP. Cookies may satisfy a login challenge but
put the associated account at risk and must never be accepted from end users or
exposed to the frontend.

### Instagram

Anonymous public-post extraction currently depends on Instagram's web/embed
metadata flows. The stable yt-dlp 2026.06.09 extractor broke when these responses
changed; 2026.07.04 includes the rewritten extractor. FileFlow retries with a
Chrome TLS fingerprint. Some posts still require a fresh, server-owned
Netscape-format cookie file, and Instagram can invalidate or rate-limit it.

### Facebook

Public reels and video pages expose expiring SD/HD CDN media references in page
or player data. FileFlow now accepts exact Facebook and `fb.watch` hosts and
uses yt-dlp. A second attempt uses Chrome request impersonation because
Facebook's page/API path can gate responses on the TLS and header fingerprint.
Private, friends-only, DRM-protected, or login-only videos are intentionally not
made accessible.

### TikTok

The public video page contains hydrated post metadata with playback URLs,
variants, author data, and sometimes photo/audio assets. Short links must first
resolve to the canonical post. yt-dlp performs this extraction; FileFlow retries
with browser impersonation and preserves the platform/CDN request context during
the server-side download.

## Production algorithm in FileFlow

1. Accept only HTTPS URLs on an exact allowlist; reject credentials, custom
   ports, local IPs, and lookalike domains.
2. Queue the work outside the API process.
3. Run the newest tested yt-dlp build with bounded retries, timeouts, file-size
   limits, a generated output template, and no shell interpolation.
4. For YouTube, enable Node/EJS and the internal PO-token provider.
5. For Meta/TikTok, retry through `curl_cffi` browser impersonation.
6. Optionally load a read-only server cookie jar and/or an egress proxy.
7. Merge/remux to MP4 or extract MP3 with FFmpeg.
8. Verify the output container and byte limit, quarantine it, malware-scan it,
   and expose only the resulting FileFlow object.
9. Persist stable errors so operations can distinguish authentication,
   rate-limit, blocked-IP, unavailable-media, and stale-extractor failures.

## Operations

Rebuild the backend image whenever yt-dlp is updated:

```sh
docker compose -f deploy/hetzner-test/compose.yaml build --pull api
docker compose -f deploy/hetzner-test/compose.yaml up -d api processing-worker
```

For platforms that require a session, export only the necessary cookies in
Netscape format, store them outside the repository, mount them read-only at
`/run/secrets/social-import-cookies.txt`, and set
`FILEFLOW_SOCIAL_IMPORT_COOKIES_FILE` to that container path. Use a dedicated
low-privilege account, rotate the file, and expect platform-side invalidation.

Monitor error-code counts. A sudden rise in `extractor_outdated` calls for a
tested yt-dlp update; `platform_rate_limited` calls for lower concurrency and
backoff; `platform_ip_blocked` calls for clean server egress. Do not attempt to
bypass DRM, private access controls, paid access, regional restrictions, or
account security challenges.

## Legal/product boundary

Only process public material the user owns or is authorized to save. Platform
terms still apply. In particular, the official YouTube API policies prohibit
API clients from downloading or storing YouTube audiovisual content without
prior written approval; the YouTube Data API is therefore not a legitimate
replacement for the extraction pipeline. Obtain legal review before offering a
public or commercial downloader, publish a takedown process, rate-limit abuse,
and retain source/result data only as long as needed.

## Primary references

- [yt-dlp EJS setup](https://github.com/yt-dlp/yt-dlp/wiki/EJS)
- [yt-dlp PO-token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [yt-dlp FAQ: cookies, headers, IP-bound media URLs](https://github.com/yt-dlp/yt-dlp/wiki/FAQ)
- [yt-dlp known platform issues](https://github.com/yt-dlp/yt-dlp/issues/3766)
- [yt-dlp 2026.07.04 release](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.07.04)
- [Cobalt source and architecture](https://github.com/imputnet/cobalt)
- [Cobalt API capabilities](https://github.com/imputnet/cobalt/blob/main/api/README.md)
- [YouTube API developer policies](https://developers.google.com/youtube/terms/developer-policies)
