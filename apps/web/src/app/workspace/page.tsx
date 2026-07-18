import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@fileflow/ui';
import { FileUrlInput } from './file-url-input';
import './workspace.css';

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Add a local file or supported public media URL to your private FileFlow workspace.',
};

export default function WorkspacePage() {
  return (
    <main className="input-shell">
      <header className="input-header">
        <Link className="landing-brand" href="/" aria-label="FileFlow home">
          <span className="landing-mark" aria-hidden="true" /> FileFlow
        </Link>
        <Badge variant="local">M08 · LOCAL CORE</Badge>
      </header>
      <section className="input-hero" aria-labelledby="input-page-title" data-ff-reveal="1">
        <p className="input-eyebrow">NEW WORKSPACE</p>
        <h1 id="input-page-title">What are you working with?</h1>
        <p>
          Add one source. Nothing is uploaded or processed until FileFlow explains the next step.
        </p>
      </section>
      <section aria-label="File and URL input" data-ff-reveal="2">
        <FileUrlInput />
      </section>
      <aside className="input-scope-note" aria-label="What happens next">
        <strong>Review before processing</strong>
        <p>
          FileFlow identifies the source, explains its recommendation and shows where the operation
          would run. Nothing starts without confirmation.
        </p>
      </aside>
    </main>
  );
}
