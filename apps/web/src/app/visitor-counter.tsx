'use client';

import React, { useEffect, useState } from 'react';

type VisitCounts = {
  total: number;
  today: number;
};

const sessionKey = 'fileflow-visit-counted';

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
    void fetch('/api/visits', { method, signal: controller.signal })
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
    <div className="ff-visitor-counter" aria-label="Total visits and visits today">
      {counts ? `${counts.total}/${counts.today}` : '\u00a0'}
    </div>
  );
}
