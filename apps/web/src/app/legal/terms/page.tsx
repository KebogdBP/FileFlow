import React from 'react';
import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Beta terms' };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Beta terms"
      title="Terms for the FileFlow beta"
      intro="These terms set expectations for invited testers while the service is being validated."
    >
      <h2>Closed beta</h2>
      <p>
        The service is a closed beta. Access may be limited, changed or withdrawn during testing.
      </p>
      <h2>Your files</h2>
      <p>
        You keep ownership of your files and must have the right to process any content you submit.
      </p>
      <h2>Availability</h2>
      <p>
        Beta features are provided as available and may fail. Keep independent copies of important
        files.
      </p>
      <h2>Acceptable use</h2>
      <p>Do not use FileFlow to distribute malware, violate rights or evade platform safeguards.</p>
    </LegalPage>
  );
}
