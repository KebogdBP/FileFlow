'use client';

import React, { useEffect, useState } from 'react';
import { API_URL } from './cloud-api';
import type { FileFlowLanguage } from './use-fileflow-language';

type VisitCounts = {
  total: number;
  today: number;
};

type OperationCounts = {
  total: number;
};

const sessionKey = 'fileflow-visit-counted';

const copy = {
  en: ['Converted and downloaded', 'files'],
  ru: ['Конвертировано и скачано', 'файлов'],
  es: ['Convertidos y descargados', 'archivos'],
} as const;

export async function recordCompletedOperations(count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 20) return;
  await fetch(`${API_URL}/analytics/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent('fileflow-operation-counted'));
}

export function OperationCounter({ language }: { language: FileFlowLanguage }) {
  const [counts, setCounts] = useState<OperationCounts>();

  useEffect(() => {
    const controller = new AbortController();
    const read = () =>
      void fetch(`${API_URL}/analytics/operations`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Operation counter unavailable');
          return response.json() as Promise<OperationCounts>;
        })
        .then(setCounts)
        .catch(() => undefined);
    read();
    window.addEventListener('fileflow-operation-counted', read);

    return () => {
      controller.abort();
      window.removeEventListener('fileflow-operation-counted', read);
    };
  }, []);

  return (
    <div className="ff-visitor-counter" aria-live="polite">
      {counts
        ? `${copy[language][0]} — ${counts.total.toLocaleString(language)} ${copy[language][1]}`
        : '\u00a0'}
    </div>
  );
}

export function VisitorCounter() {
  const [counts, setCounts] = useState<VisitCounts>();

  useEffect(() => {
    let method = 'POST';
    try {
      if (window.sessionStorage.getItem(sessionKey)) {
        method = 'GET';
      }
    } catch {
      method = 'POST';
    }

    const controller = new AbortController();
    void fetch(`${API_URL}/analytics/visits`, { method, signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Visit counter unavailable');
        return response.json() as Promise<VisitCounts>;
      })
      .then((nextCounts) => {
        setCounts(nextCounts);
        if (method === 'POST') {
          try {
            window.sessionStorage.setItem(sessionKey, '1');
          } catch {
            // The count still works when browser storage is unavailable.
          }
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  return (
    <div
      className="ff-visitor-counter ff-visitor-counter--visits"
      aria-label="Total visits and visits today"
    >
      {counts ? `${counts.total}/${counts.today}` : '\u00a0'}
    </div>
  );
}
