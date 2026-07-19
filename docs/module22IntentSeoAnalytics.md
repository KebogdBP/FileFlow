# M22 — Intent SEO and Product Analytics

M22 makes FileFlow's outcome-first tools discoverable and measures the path into the workspace
without collecting file, URL, account or device identity data.

## Intent SEO

- `/tools` lists every operation from the shared operation registry;
- `/tools/[intent]` statically generates one focused page per registered operation;
- each page provides unique metadata, a canonical URL, privacy/execution copy and WebApplication
  structured data;
- CTAs preserve the selected intent in `/workspace?intent=...`, where it becomes the initial
  operation when compatible with the inspected file;
- `sitemap.xml` contains all intent pages and `robots.txt` keeps the private account route out of
  search results;
- `NEXT_PUBLIC_SITE_URL` controls production canonical and sitemap origins.

## Privacy-safe analytics

The first-party endpoint accepts only two enum events:

```text
intent_viewed
workspace_opened
```

The payload may contain only a bounded registry-style intent identifier. Extra fields are rejected,
so filenames, source URLs, account identifiers and arbitrary metadata cannot enter this event table.
The server assigns the timestamp and does not persist IP addresses or user-agent strings.

```text
POST /api/v1/analytics/events
```

Events are stored in `product_events` through the M22 Alembic migration. Failed analytics requests
never block the product flow.

## Verification

Tests cover registry-to-route parity, sitemap coverage, canonical metadata, structured data,
workspace intent continuity, accepted events and rejection of identifying fields.
