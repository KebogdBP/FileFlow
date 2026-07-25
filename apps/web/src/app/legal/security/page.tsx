import React from 'react';
import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Security' };
export default function SecurityPage() {
  return <LegalPage kind="security" />;
}
