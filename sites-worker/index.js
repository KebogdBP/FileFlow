const securityHeaders = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
};

export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);

    if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      const indexUrl = new URL(
        `${url.pathname.replace(/\/$/, '') || ''}/index.html`,
        request.url,
      );
      response = await env.ASSETS.fetch(new Request(indexUrl, request));
    }

    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
