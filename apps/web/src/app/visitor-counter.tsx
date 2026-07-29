'use client';

import React, { useEffect, useState } from 'react';
import type { FileFlowLanguage } from './use-fileflow-language';

type OperationCounts = {
  total: number;
};

const copy = {
  en: ['Converted and downloaded', 'files'],
  ru: ['Конвертировано и скачано', 'файлов'],
  es: ['Convertidos y descargados', 'archivos'],
} as const;

export async function recordCompletedOperations(count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 20) return;
  await fetch('/api/operation-counter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent('fileflow-operation-counted'));
}

export function VisitorCounter({ language }: { language: FileFlowLanguage }) {
  const [counts, setCounts] = useState<OperationCounts>();
  useEffect(() => {
    const controller = new AbortController();
    const read = () =>
      void fetch('/api/operation-counter', { signal: controller.signal })
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
