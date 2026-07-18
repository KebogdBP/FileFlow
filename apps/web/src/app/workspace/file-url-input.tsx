'use client';

import React, { useId, useRef, useState } from 'react';
import { Badge, Button, Card } from '@fileflow/ui';
import {
  FILE_ACCEPT,
  formatFileSize,
  type InputPlatform,
  validateInputFile,
  validateSourceUrl,
} from './input-policy';

type Source = { kind: 'file'; file: File } | { kind: 'url'; url: string; platform: InputPlatform };

export function FileUrlInput() {
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [source, setSource] = useState<Source>();
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  function chooseFile(file?: File) {
    setDragActive(false);
    if (!file) return;
    const result = validateInputFile(file);
    if (!result.ok) {
      setSource(undefined);
      setError(result.error);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError('');
    setSource({ kind: 'file', file: result.value });
  }

  function chooseUrl(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateSourceUrl(urlValue);
    if (!result.ok) {
      setSource(undefined);
      setError(result.error);
      return;
    }
    setError('');
    setSource({ kind: 'url', ...result.value });
  }

  function reset() {
    setSource(undefined);
    setError('');
    setUrlValue('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function selectTab(nextTab: 'file' | 'url') {
    setTab(nextTab);
    setError('');
  }

  return (
    <Card className="input-card" variant="glass">
      <div className="input-card-heading">
        <div>
          <Badge variant="private">PRIVATE INPUT</Badge>
          <h2 id={`${id}-title`}>Start with a file or link</h2>
        </div>
        <span className="input-empty-status">{source ? '1 source ready' : 'Nothing uploaded'}</span>
      </div>

      <div className="input-tabs" role="tablist" aria-label="Input source">
        <button
          type="button"
          role="tab"
          id={`${id}-file-tab`}
          aria-selected={tab === 'file'}
          aria-controls={`${id}-file-panel`}
          onClick={() => selectTab('file')}
        >
          From device
        </button>
        <button
          type="button"
          role="tab"
          id={`${id}-url-tab`}
          aria-selected={tab === 'url'}
          aria-controls={`${id}-url-panel`}
          onClick={() => selectTab('url')}
        >
          From a link
        </button>
      </div>

      {tab === 'file' ? (
        <div
          id={`${id}-file-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-file-tab`}
          className="input-panel"
        >
          <div
            className="file-drop-zone"
            data-drag-active={dragActive || undefined}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                setDragActive(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              className="file-input-native"
              id={`${id}-file`}
              type="file"
              accept={FILE_ACCEPT.join(',')}
              aria-describedby={`${id}-file-help`}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <span className="file-drop-icon" aria-hidden="true">
              ↥
            </span>
            <strong>{dragActive ? 'Release to add your file' : 'Drop a file here'}</strong>
            <span id={`${id}-file-help`}>Images, video, audio, PDF or DOCX · up to 2 GB</span>
            <label className="input-picker-button" htmlFor={`${id}-file`}>
              Choose a file
            </label>
          </div>
        </div>
      ) : (
        <div
          id={`${id}-url-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-url-tab`}
          className="input-panel"
        >
          <form className="url-input-form" onSubmit={chooseUrl} noValidate>
            <label htmlFor={`${id}-url`}>Public media URL</label>
            <div className="url-input-row">
              <input
                id={`${id}-url`}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://youtube.com/watch?v=…"
                value={urlValue}
                aria-invalid={Boolean(error)}
                aria-describedby={`${id}-url-help`}
                onChange={(event) => setUrlValue(event.target.value)}
              />
              <Button type="submit">Use this link</Button>
            </div>
            <span id={`${id}-url-help`}>YouTube, Instagram and TikTok public links</span>
          </form>
        </div>
      )}

      <div className="input-announcement" aria-live="polite" aria-atomic="true">
        {error ? (
          <p className="input-error" role="alert">
            {error}
          </p>
        ) : null}
        {source ? <SelectedSource source={source} onRemove={reset} /> : null}
      </div>

      <div className="input-privacy-note">
        <Badge variant={source?.kind === 'url' ? 'cloud' : 'local'}>
          {source?.kind === 'url' ? 'LINK' : 'LOCAL'}
        </Badge>
        <div>
          <strong>
            {source?.kind === 'url' ? 'No import has started' : 'Your file stays on this device'}
          </strong>
          <p>
            {source?.kind === 'url'
              ? 'FileFlow validates the address only. A later step will explain cloud import before it begins.'
              : 'Selecting a file does not upload it. Processing mode is confirmed before every operation.'}
          </p>
        </div>
      </div>
    </Card>
  );
}

function SelectedSource({ source, onRemove }: { source: Source; onRemove: () => void }) {
  const file = source.kind === 'file' ? source.file : undefined;
  return (
    <div className="selected-source" data-source-kind={source.kind}>
      <span className="selected-source-icon" aria-hidden="true">
        {file ? '◫' : '↗'}
      </span>
      <div>
        <strong>{source.kind === 'file' ? source.file.name : `${source.platform} link`}</strong>
        <span>
          {file
            ? `${formatFileSize(file.size)} · Ready for inspection`
            : 'Validated · Ready for import review'}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRemove}
        aria-label="Remove selected source"
      >
        Remove
      </Button>
    </div>
  );
}
