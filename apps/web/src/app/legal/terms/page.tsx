import React from 'react';
import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Beta terms' };
export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
