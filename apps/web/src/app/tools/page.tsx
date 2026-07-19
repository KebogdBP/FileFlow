import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card } from '@fileflow/ui';
import { intentCatalog } from './intent-catalog';
import './tools.css';

export const metadata: Metadata = {
  title: 'Private file tools',
  description: 'Choose an outcome and see exactly whether your file stays local or uses the cloud.',
};

export default function ToolsPage() {
  return (
    <main className="tools-shell">
      <header className="tools-header">
        <Link className="landing-brand" href="/">
          <span className="landing-mark" aria-hidden="true" /> FileFlow
        </Link>
        <Link href="/workspace">Open workspace</Link>
      </header>
      <section className="tools-hero">
        <Badge variant="local">OUTCOME-FIRST TOOLS</Badge>
        <h1>Start with what you need.</h1>
        <p>
          Each tool explains the result, processing mode and privacy trade-off before anything
          begins.
        </p>
      </section>
      <section className="tools-grid" aria-label="File tools">
        {intentCatalog.map((intent) => (
          <Link href={`/tools/${intent.id}`} key={intent.id}>
            <Card variant="interactive">
              <Badge
                variant={
                  intent.executionMode === 'local'
                    ? 'local'
                    : intent.executionMode === 'cloud'
                      ? 'cloud'
                      : 'private'
                }
              >
                {intent.executionMode}
              </Badge>
              <h2>{intent.displayName}</h2>
              <p>{intent.description}</p>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
