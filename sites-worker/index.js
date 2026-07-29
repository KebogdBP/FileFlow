const securityHeaders = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/operation-counter') {
      return operationCounter(request, env);
    }
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      const indexUrl = new URL(`${url.pathname.replace(/\/$/, '') || ''}/index.html`, request.url);
      response = await env.ASSETS.fetch(new Request(indexUrl, request));
    }

    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  },
};

async function operationCounter(request, env) {
  if (!env.DB) return Response.json({ error: 'Counter unavailable' }, { status: 503 });
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS operation_counters (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO operation_counters (id, total, updated_at)
       VALUES (1, 0, CURRENT_TIMESTAMP)`,
    ),
  ]);

  if (request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    const count = Number(payload.count);
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      return Response.json({ error: 'Invalid count' }, { status: 400 });
    }
    await env.DB.prepare(
      `UPDATE operation_counters
       SET total = total + ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
    )
      .bind(count)
      .run();
  } else if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  }

  const row = await env.DB.prepare('SELECT total FROM operation_counters WHERE id = 1').first();
  return Response.json(
    { total: Number(row?.total ?? 0) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
