import React from 'react';
import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Privacy notice' };
export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
