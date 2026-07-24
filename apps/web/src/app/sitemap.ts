import type { MetadataRoute } from 'next';
import { intentCatalog } from './tools/intent-catalog';

export const dynamic = 'force-static';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fileflow.app').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/workspace', '/tools', ...intentCatalog.map(({ id }) => `/tools/${id}`)].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: path.startsWith('/tools/') ? 'monthly' : 'weekly',
      priority: path === '' ? 1 : path === '/tools' ? 0.9 : 0.8,
    }),
  );
}
