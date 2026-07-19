import React from 'react';
import Link from 'next/link';

export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link className="landing-brand" href="/" aria-label="FileFlow home">
          <span className="landing-mark" aria-hidden="true" /> FileFlow
        </Link>
        <Link href="/workspace">Open workspace</Link>
      </header>
      <article className="legal-document">
        <p className="legal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        <p className="legal-updated">Effective July 19, 2026</p>
        {children}
      </article>
    </main>
  );
}
