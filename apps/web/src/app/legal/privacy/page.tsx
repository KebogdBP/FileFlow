import React from 'react';
import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Privacy notice' };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy notice"
      title="Privacy you can verify"
      intro="FileFlow minimizes collection and shows where processing happens before it starts."
    >
      <h2>Local processing</h2>
      <p>Files handled locally stay in your browser and are not sent to FileFlow.</p>
      <h2>Cloud processing</h2>
      <p>
        Temporary cloud files are used only to perform the operation you request. They are
        quarantined, scanned, access-controlled and scheduled for automatic deletion after the
        configured retention window.
      </p>
      <h2>Accounts and analytics</h2>
      <p>
        Account data supports sessions, limits and private job history. Product analytics uses a
        bounded event vocabulary and does not include filenames, URLs or file contents.
      </p>
      <h2>Your choices</h2>
      <p>
        You can use local tools without an account and revoke an authenticated session at any time.
      </p>
    </LegalPage>
  );
}
