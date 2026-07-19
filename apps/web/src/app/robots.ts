import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fileflow.app').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/account'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
