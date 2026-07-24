'use client';

import React, { useRef, useState } from 'react';
import { Badge, Button, Select } from '@fileflow/ui';
import Image from 'next/image';
import { createSocialImport, waitForSocialImport, type SocialImport } from '../cloud-api';
import { CloudJobTool } from './cloud-job-tool';

export function SocialImportTool({ url }: { url: string }) {
  const [operation, setOperation] = useState('compress-video');
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'running'; stage: string }
    | { status: 'completed'; item: SocialImport }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const aborter = useRef<AbortController | null>(null);

  async function start() {
    const controller = new AbortController();
    aborter.current = controller;
    setState({ status: 'running', stage: 'Queueing import' });
    try {
      const created = await createSocialImport(url, controller.signal);
      setState({ status: 'running', stage: `Importing from ${created.provider}` });
      const completed = await waitForSocialImport(created.id, controller.signal);
      setState({ status: 'completed', item: completed });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'Import cancelled locally. The server task may finish in the background.'
            : error instanceof Error
              ? error.message
              : 'Import failed.',
      });
    } finally {
      aborter.current = null;
    }
  }

  return (
    <div className="social-import-tool">
      {state.status === 'idle' || state.status === 'error' ? (
        <Button type="button" onClick={() => void start()}>
          Start cloud import
        </Button>
      ) : null}
      {state.status === 'running' ? (
        <div className="cloud-tool-actions">
          <Badge variant="cloud">IMPORTING</Badge>
          <strong>{state.stage}</strong>
          <Button type="button" variant="secondary" onClick={() => aborter.current?.abort()}>
            Stop waiting
          </Button>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <p className="input-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === 'completed' && state.item.upload_id ? (
        <>
          <div className="import-result">
            {state.item.thumbnail_url ? (
              <Image
                src={state.item.thumbnail_url}
                alt="Imported media thumbnail"
                width={120}
                height={68}
                unoptimized
              />
            ) : null}
            <div>
              <Badge variant="success">IMPORTED</Badge>
              <strong>{state.item.title ?? 'Imported video'}</strong>
              <span>{state.item.creator ?? state.item.provider}</span>
            </div>
          </div>
          <Select
            id="import-operation"
            label="What next?"
            value={operation}
            onChange={(event) => setOperation(event.target.value)}
          >
            <option value="compress-video">Compress video</option>
            <option value="video-to-mp4">Convert to MP4</option>
            <option value="resize-video">Resize video</option>
            <option value="extract-audio">Extract audio</option>
          </Select>
          <CloudJobTool operationId={operation} existingUploadId={state.item.upload_id} />
        </>
      ) : null}
    </div>
  );
}
