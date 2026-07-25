import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@fileflow/ui';
import { WorkspaceLaunch } from './workspace-launch';
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
          <Image src="/brand/fileflow-mark.png" alt="" width={34} height={30} priority />
          <strong>FileFlow</strong>
        </Link>
        <Badge variant="private">M20 · BATCH PROCESSING</Badge>
        <Link href="/account">Account</Link>
      </header>
      <section className="input-hero" aria-labelledby="input-page-title" data-ff-reveal="1">
        <p className="input-eyebrow">NEW WORKSPACE</p>
        <h1 id="input-page-title">What are you working with?</h1>
        <p>
          Add one source or a matching image batch, choose your intent and review exactly where the
          operation will run.
        </p>
      </section>
      <section aria-label="File and URL input" data-ff-reveal="2">
        <WorkspaceLaunch />
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
