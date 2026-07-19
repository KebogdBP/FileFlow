import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import sitemap from '../sitemap';
import IntentPage, { generateMetadata, generateStaticParams } from './[intent]/page';
import { intentCatalog } from './intent-catalog';
import ToolsPage from './page';

describe('intent SEO', () => {
  it('builds one discoverable route from every registered operation', () => {
    expect(generateStaticParams()).toHaveLength(intentCatalog.length);
    expect(sitemap().filter(({ url }) => url.includes('/tools/'))).toHaveLength(
      intentCatalog.length,
    );
    expect(renderToStaticMarkup(<ToolsPage />)).toContain('Make this PDF smaller');
  });

  it('provides canonical metadata and structured product context', async () => {
    const params = Promise.resolve({ intent: 'compress-pdf' });
    const metadata = await generateMetadata({ params });
    const markup = renderToStaticMarkup(await IntentPage({ params }));
    expect(metadata.alternates).toEqual({ canonical: '/tools/compress-pdf' });
    expect(markup).toContain('application/ld+json');
    expect(markup).toContain('This operation uses an isolated cloud worker.');
    expect(markup).toContain('/workspace?intent=compress-pdf');
  });
});
