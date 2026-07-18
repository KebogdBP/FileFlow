import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card } from '@fileflow/ui';
import { MODULE_MARKER } from './constants';

export const metadata: Metadata = {
  title: 'Private file tools',
  description:
    'Convert, compress and prepare files with local processing whenever possible and visible cloud handling when it is needed.',
};

const outcomes = [
  { icon: '◫', title: 'Make images lighter', detail: 'Convert, resize and remove metadata.' },
  { icon: '▶', title: 'Prepare video', detail: 'Compress, resize and extract audio.' },
  { icon: '∿', title: 'Shape audio', detail: 'Convert, trim and preview waveforms.' },
  { icon: '≡', title: 'Organize documents', detail: 'Merge, split and prepare PDFs.' },
];

export default function HomePage() {
  return (
    <main className="landing-shell">
      <header className="landing-header" aria-label="Main navigation">
        <Link className="landing-brand" href="/" aria-label="FileFlow home">
          <span className="landing-mark" aria-hidden="true" />
          FileFlow
        </Link>
        <nav className="landing-nav" aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#tools">Tools</a>
        </nav>
        <Link className="landing-header-cta" href="/workspace">
          Open workspace
        </Link>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title" data-ff-reveal="1">
        <div className="landing-hero-copy">
          <Badge variant="local">● LOCAL-FIRST FILE TOOLS</Badge>
          <h1 id="landing-title">Your files. Your device. Your call.</h1>
          <p className="landing-lead">
            Convert, compress and prepare files in one calm workspace. FileFlow processes on your
            device whenever possible—and tells you clearly when the cloud is needed.
          </p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" href="/workspace">
              Start with a file <span aria-hidden="true">→</span>
            </Link>
            <a className="landing-button landing-button-secondary" href="#privacy">
              See how privacy works
            </a>
          </div>
          <ul className="landing-trust-list" aria-label="Privacy promises">
            <li>No hidden uploads</li>
            <li>No account required to start</li>
            <li>Processing mode always visible</li>
          </ul>
        </div>

        <Card
          className="workspace-preview"
          id="workspace-preview"
          variant="glass"
          data-ff-reveal="2"
        >
          <div className="workspace-topline">
            <span>New workspace</span>
            <Badge variant="private">PRIVATE BY DEFAULT</Badge>
          </div>
          <div className="workspace-drop-preview">
            <span className="workspace-file-icon" aria-hidden="true">
              ↥
            </span>
            <strong>Drop a file here</strong>
            <span>or choose one from your device</span>
            <span className="workspace-preview-label">Workspace preview</span>
          </div>
          <div className="workspace-mode">
            <Badge variant="local">LOCAL</Badge>
            <div>
              <strong>Stays on this device</strong>
              <span>Supported work runs directly in your browser.</span>
            </div>
            <span className="workspace-check" aria-hidden="true">
              ✓
            </span>
          </div>
        </Card>
      </section>

      <section className="landing-proof" aria-label="Product principles">
        <span>ONE WORKSPACE</span>
        <span>VISIBLE PROCESSING</span>
        <span>PLAIN-LANGUAGE SETTINGS</span>
        <span>SAFE DEFAULTS</span>
      </section>

      <section className="landing-section" id="privacy" aria-labelledby="privacy-title">
        <div className="landing-section-heading">
          <Badge variant="private">PRIVACY YOU CAN SEE</Badge>
          <h2 id="privacy-title">Nothing happens behind your back.</h2>
          <p>
            Every operation explains where it runs, why that mode is needed and what happens to your
            file afterwards.
          </p>
        </div>
        <div className="privacy-grid">
          <Card className="privacy-card">
            <span className="privacy-number">01</span>
            <Badge variant="local">LOCAL</Badge>
            <h3>On-device when possible</h3>
            <p>Lightweight operations stay in your browser. Your file never leaves the device.</p>
          </Card>
          <Card className="privacy-card privacy-card-featured">
            <span className="privacy-number">02</span>
            <Badge variant="cloud">CLOUD</Badge>
            <h3>Cloud only when necessary</h3>
            <p>Heavy tasks show a clear explanation before any upload begins.</p>
          </Card>
          <Card className="privacy-card">
            <span className="privacy-number">03</span>
            <Badge variant="success">AUTO-CLEANUP</Badge>
            <h3>Temporary means temporary</h3>
            <p>Cloud files are kept only for the operation and then automatically removed.</p>
          </Card>
        </div>
      </section>

      <section
        className="landing-section landing-process"
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <div className="landing-section-heading landing-section-heading-left">
          <Badge variant="neutral">ONE CLEAR FLOW</Badge>
          <h2 id="how-title">From file to result, without the guesswork.</h2>
        </div>
        <ol className="process-list">
          <li>
            <span>1</span>
            <div>
              <strong>Add your file</strong>
              <p>Start from your device in one workspace.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Choose the outcome</strong>
              <p>Pick what you need, not a confusing codec.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Review the plan</strong>
              <p>See quality, privacy mode and expected result.</p>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <strong>Get the result</strong>
              <p>Download a checked file with a clear summary.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="landing-section" id="tools" aria-labelledby="tools-title">
        <div className="landing-section-heading">
          <Badge variant="neutral">BUILT AROUND OUTCOMES</Badge>
          <h2 id="tools-title">One place for the files you use every day.</h2>
          <p>FileFlow is designed around familiar tasks instead of endless format directories.</p>
        </div>
        <div className="outcome-grid">
          {outcomes.map((outcome) => (
            <Card className="outcome-card" key={outcome.title}>
              <span className="outcome-icon" aria-hidden="true">
                {outcome.icon}
              </span>
              <h3>{outcome.title}</h3>
              <p>{outcome.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <Badge variant="local">FILES SHOULD FEEL SIMPLE</Badge>
        <h2 id="final-title">A clearer way to work with files is taking shape.</h2>
        <p>Private by default. Honest about the cloud. Designed around your result.</p>
        <Link className="landing-button landing-button-primary" href="/workspace">
          Explore the workspace <span aria-hidden="true">→</span>
        </Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/">
          <span className="landing-mark" aria-hidden="true" /> FileFlow
        </Link>
        <p>Private file tools that explain every step.</p>
        <span>{MODULE_MARKER}</span>
      </footer>
    </main>
  );
}
