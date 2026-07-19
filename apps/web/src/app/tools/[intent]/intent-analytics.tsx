'use client';

import React from 'react';
import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

function record(name: 'intent_viewed' | 'workspace_opened', intent: string) {
  void fetch(`${API_URL}/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, intent }),
    keepalive: true,
  }).catch(() => undefined);
}

export function IntentAnalytics({
  intent,
  cta = false,
  children,
}: {
  intent: string;
  cta?: boolean;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (!cta) record('intent_viewed', intent);
  }, [cta, intent]);
  if (!cta) return null;
  return <span onClick={() => record('workspace_opened', intent)}>{children}</span>;
}
