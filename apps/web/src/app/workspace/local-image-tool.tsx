'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getLocalProcessingCapability,
  LocalJobRunner,
  type LocalJobHandle,
  type WorkerTransport,
} from '@fileflow/local-processing';
import { Badge, Button, Select, Slider } from '@fileflow/ui';
import { formatFileSize } from './input-policy';
import { savingPercent, validateWebPResult, webPFileName } from './image-result';

type ToolState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; stage: string }
  | { status: 'completed'; url: string; size: number; width: number; height: number }
  | { status: 'error'; message: string };

export function LocalImageTool({
  file,
  sourceMime,
  operationId = 'optimize-image',
}: {
  file: File;
  sourceMime: string;
  operationId?: string;
}) {
  const [quality, setQuality] = useState(82);
  const [maxDimension, setMaxDimension] = useState(0);
  const [state, setState] = useState<ToolState>({ status: 'idle' });
  const handle = useRef<LocalJobHandle | null>(null);
  const resultUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      handle.current?.cancel();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);

  async function processImage() {
    const capability = getLocalProcessingCapability();
    if (!capability.supported) {
      setState({
        status: 'error',
        message: capability.reason ?? 'Local processing is unavailable.',
      });
      return;
    }
    if (file.size > capability.maxInputBytes) {
      setState({
        status: 'error',
        message: 'This image is too large for reliable processing on this device.',
      });
      return;
    }

    setState({ status: 'running', progress: 0, stage: 'Reading source' });
    try {
      const input = await file.arrayBuffer();
      const runner = new LocalJobRunner({
        capability,
        createWorker: () =>
          new Worker(new URL('./local-image.worker.ts', import.meta.url), {
            type: 'module',
          }) as WorkerTransport,
      });
      const job = runner.run(
        {
          id: `image-${Date.now()}`,
          operationId,
          input,
          options: { sourceMime, quality: quality / 100, maxDimension },
        },
        ({ progress, stage }) => setState({ status: 'running', progress, stage }),
      );
      handle.current = job;
      const result = await job.promise;
      const validation = validateWebPResult(result.output);
      if (!validation.ok) throw new Error(validation.error);
      const width = Number(result.metadata?.width ?? 0);
      const height = Number(result.metadata?.height ?? 0);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      const url = URL.createObjectURL(new Blob([result.output], { type: 'image/webp' }));
      resultUrl.current = url;
      setState({ status: 'completed', url, size: validation.size, width, height });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Image processing failed.',
      });
    }
  }

  const running = state.status === 'running';
  return (
    <section className="local-image-tool" aria-labelledby="local-image-title">
      <div className="image-tool-heading">
        <div>
          <Badge variant="local">LOCAL IMAGE TOOL</Badge>
          <h3 id="local-image-title">
            {operationId === 'remove-image-metadata'
              ? 'Create a metadata-free WebP'
              : 'Create a lighter WebP'}
          </h3>
        </div>
        <span>Re-encoding removes embedded metadata</span>
      </div>
      <div className="image-tool-controls">
        <Slider
          id="image-quality"
          label="Quality"
          min={40}
          max={100}
          value={quality}
          valueLabel={`${quality}%`}
          disabled={running}
          onChange={(event) => setQuality(Number(event.target.value))}
        />
        <Select
          id="image-size"
          label="Maximum dimension"
          value={maxDimension}
          disabled={running}
          onChange={(event) => setMaxDimension(Number(event.target.value))}
        >
          <option value={0}>Keep original dimensions</option>
          <option value={1920}>1920 px</option>
          <option value={1280}>1280 px</option>
          <option value={800}>800 px</option>
        </Select>
      </div>
      <div className="image-tool-action">
        {running ? (
          <Button type="button" variant="secondary" onClick={() => handle.current?.cancel()}>
            Cancel
          </Button>
        ) : (
          <Button type="button" onClick={() => void processImage()}>
            {operationId === 'remove-image-metadata'
              ? 'Remove metadata locally'
              : 'Create WebP locally'}
          </Button>
        )}
        <span>Source: {formatFileSize(file.size)} · never uploaded</span>
      </div>
      <div className="image-tool-feedback" aria-live="polite">
        {running ? (
          <div>
            <span>
              <span style={{ width: `${state.progress}%` }} />
            </span>
            <small>
              {state.stage} · {state.progress}%
            </small>
          </div>
        ) : null}
        {state.status === 'error' ? (
          <p className="input-error" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === 'completed' ? (
          <div className="image-result-card">
            <div>
              <Badge variant={state.size < file.size ? 'success' : 'warning'}>VALID WEBP</Badge>
              <strong>
                {state.width} × {state.height}
              </strong>
              <span>
                {formatFileSize(file.size)} → {formatFileSize(state.size)} ·{' '}
                {savingPercent(file.size, state.size)}% saved
              </span>
            </div>
            <a className="image-download" href={state.url} download={webPFileName(file.name)}>
              Download WebP
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
