const securityHeaders = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function moscowDay() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function readCounts(db, day) {
  const [total, today] = await Promise.all([
    db.prepare('SELECT count FROM site_totals WHERE id = 1').first(),
    db.prepare('SELECT count FROM visit_counts WHERE day = ?').bind(day).first(),
  ]);
  return {
    total: Number(total?.count ?? 0),
    today: Number(today?.count ?? 0),
  };
}

async function visitorCounts(request, env) {
  const day = moscowDay();
  if (request.method === 'POST') {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO site_totals (id, count) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET count = count + 1',
      ),
      env.DB.prepare(
        'INSERT INTO visit_counts (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1',
      ).bind(day),
    ]);
  } else if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...jsonHeaders, allow: 'GET, POST' },
    });
  }

  return new Response(JSON.stringify(await readCounts(env.DB, day)), {
    headers: jsonHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/visits') {
      return visitorCounts(request, env);
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
