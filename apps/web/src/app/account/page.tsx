import type { Metadata } from 'next';
import { AccountShellContent } from './account-shell-content';
import './account.css';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Sign in to see cloud processing history and current FileFlow limits.',
};

export default function AccountPage() {
  return (
    <main className="account-shell">
      <AccountShellContent />
    </main>
  );
}
