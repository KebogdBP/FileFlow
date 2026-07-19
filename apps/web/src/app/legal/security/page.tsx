import React from 'react';
import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title="Security at FileFlow"
      intro="Defense in depth protects temporary cloud files while local processing avoids upload entirely."
    >
      <h2>Controls</h2>
      <p>
        Cloud inputs are quarantined until signature and malware checks pass. Jobs use bounded,
        isolated workspaces, private ownership checks and short-lived object access.
      </p>
      <h2>Responsible disclosure</h2>
      <p>
        Report a suspected vulnerability to{' '}
        <a href="mailto:security@fileflow.app">security@fileflow.app</a>. Include reproducible steps
        and avoid accessing other users’ data.
      </p>
      <h2>Response</h2>
      <p>We triage reports, contain exposure, preserve evidence and communicate material impact.</p>
    </LegalPage>
  );
}
