import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountDashboard } from './account-dashboard';
import './account.css';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Sign in to see cloud processing history and current FileFlow limits.',
};

export default function AccountPage() {
  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="landing-brand" href="/" aria-label="FileFlow home">
          <span className="landing-mark" aria-hidden="true" /> FileFlow
        </Link>
        <Link href="/workspace">Workspace</Link>
      </header>
      <section className="account-intro">
        <p className="input-eyebrow">PRIVATE ACCOUNT</p>
        <h1>Your cloud work, in one place.</h1>
        <p>Local operations stay local. Sign in only when you want cloud history and limits.</p>
      </section>
      <AccountDashboard />
    </main>
  );
}
