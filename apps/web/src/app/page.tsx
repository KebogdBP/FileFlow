import { Button } from '@fileflow/ui';
import Link from 'next/link';
import { MODULE_MARKER } from './constants';

export default function HomePage() {
  return (
    <main className="shell">
      <header className="header">
        <Link className="brand" href="/">
          <span className="mark" />
          FileFlow
        </Link>
        <nav className="nav">
          <a href="#tools">Tools</a>
          <a href="#privacy">Privacy</a>
          <Button variant="secondary">Sign in</Button>
        </nav>
      </header>
      <section className="hero">
        <p className="eyebrow">MODULE {MODULE_MARKER} · DESIGN SYSTEM</p>
        <h1>Private file tools.</h1>
        <p className="lead">
          The visual foundation is ready for every FileFlow workflow, in light, dark and system
          themes.
        </p>
        <div className="actions">
          <Button>Design system ready</Button>
          <Button variant="secondary">Next: Audiovisual system</Button>
        </div>
      </section>
      <section className="statusGrid" id="tools">
        {[
          ['Web app', 'Next.js App Router'],
          ['Monorepo', 'pnpm + Turborepo'],
          ['Language', 'TypeScript'],
          ['Quality', 'ESLint + Prettier'],
        ].map(([t, v]) => (
          <article className="card" key={t}>
            <span>{t}</span>
            <strong>{v}</strong>
          </article>
        ))}
      </section>
      <section id="privacy">
        <h2>Privacy first</h2>
        <p>File processing runs locally whenever possible.</p>
      </section>
    </main>
  );
}
