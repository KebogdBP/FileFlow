'use client';

import React, { useEffect, useState } from 'react';
import { FileUrlInput } from './file-url-input';

type LaunchState = {
  ready: boolean;
  intent?: string;
  source?: string;
};

export function WorkspaceLaunch() {
  const [launch, setLaunch] = useState<LaunchState>({ ready: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLaunch({
      ready: true,
      intent: params.get('intent') ?? undefined,
      source: params.get('source') ?? undefined,
    });
  }, []);

  if (!launch.ready) {
    return (
      <div className="input-card workspace-launch-loading" aria-busy="true">
        Preparing your private workspace…
      </div>
    );
  }

  return <FileUrlInput initialIntent={launch.intent} initialUrl={launch.source} />;
}
