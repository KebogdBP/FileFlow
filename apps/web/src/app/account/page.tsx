import type { Metadata } from 'next';
import Image from 'next/image';
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
          <Image src="/brand/fileflow-mark.png" alt="" width={34} height={30} priority />
          <strong>FileFlow</strong>
        </Link>
        <Link href="/#workspace-flow">Back to FileFlow</Link>
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
