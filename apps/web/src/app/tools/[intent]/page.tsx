import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@fileflow/ui';
import { IntentAnalytics } from './intent-analytics';
import { findIntent, intentCatalog } from '../intent-catalog';

type PageProps = { params: Promise<{ intent: string }> };

export function generateStaticParams() {
  return intentCatalog.map(({ id }) => ({ intent: id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const entry = findIntent((await params).intent);
  if (!entry) return {};
  return {
    title: entry.displayName,
    description: entry.description,
    alternates: { canonical: `/tools/${entry.id}` },
    openGraph: {
      title: `${entry.displayName} | FileFlow`,
      description: entry.description,
      type: 'website',
    },
  };
}

export default async function IntentPage({ params }: PageProps) {
  const entry = findIntent((await params).intent);
  if (!entry) notFound();
  const local = entry.executionMode === 'local';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: entry.displayName,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    description: entry.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return (
    <main className="tools-shell intent-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <IntentAnalytics intent={entry.id} />
      <header className="tools-header">
        <Link className="landing-brand" href="/">
          <Image src="/brand/fileflow-mark.png" alt="" width={34} height={30} priority />
          <strong>FileFlow</strong>
        </Link>
        <Link href="/tools">All tools</Link>
      </header>
      <article className="intent-article">
        <Badge variant={local ? 'local' : entry.executionMode === 'cloud' ? 'cloud' : 'private'}>
          {entry.executionMode.toUpperCase()} PROCESSING
        </Badge>
        <h1>{entry.displayName}</h1>
        <p className="intent-lead">{entry.description}</p>
        <div className="intent-facts">
          <section>
            <h2>What you get</h2>
            <p>
              A validated{' '}
              {entry.supportedOutputs.map((output) => output.toUpperCase()).join(' or ')} result
              using bounded, explainable defaults.
            </p>
          </section>
          <section>
            <h2>Where it runs</h2>
            <p>
              {local
                ? 'This operation runs in your browser. The source file is not uploaded.'
                : 'This operation uses an isolated cloud worker. Upload and temporary retention are shown before processing.'}
            </p>
          </section>
          <section>
            <h2>Before it starts</h2>
            <p>FileFlow inspects the source, explains the plan and waits for your confirmation.</p>
          </section>
        </div>
        <IntentAnalytics intent={entry.id} cta>
          <Link
            className="landing-button landing-button-primary"
            href={`/workspace?intent=${entry.id}`}
          >
            Open this tool <span aria-hidden="true">→</span>
          </Link>
        </IntentAnalytics>
      </article>
    </main>
  );
}
