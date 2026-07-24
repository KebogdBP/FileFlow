'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Select, Slider } from '@fileflow/ui';
import {
  API_URL,
  accountToken,
  createCloudJob,
  downloadJobResult,
  uploadCloudFile,
  waitForCleanUpload,
  waitForCloudJob,
  type CloudJob,
} from '../cloud-api';
import { formatFileSize } from './input-policy';

type State =
  | { status: 'idle' }
  | { status: 'running'; progress: number; stage: string }
  | { status: 'completed'; job: CloudJob; url: string; filename: string }
  | { status: 'error'; message: string };

export function CloudJobTool({
  operationId,
  files = [],
  existingUploadId,
}: {
  operationId: string;
  files?: readonly File[];
  existingUploadId?: string;
}) {
  const [parameters, setParameters] = useState<Record<string, string | number>>(() =>
    defaultParameters(operationId),
  );
  const [state, setState] = useState<State>({ status: 'idle' });
  const aborter = useRef<AbortController | null>(null);
  const jobId = useRef<string | null>(null);
  const resultUrl = useRef<string | null>(null);
  const token = accountToken();

  useEffect(() => {
    return () => {
      aborter.current?.abort();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  async function run() {
    const accessToken = accountToken();
    if (!accessToken) {
      setState({ status: 'error', message: 'Sign in to use protected cloud processing.' });
      return;
    }
    const controller = new AbortController();
    aborter.current = controller;
    setState({ status: 'running', progress: 0, stage: 'Preparing upload' });
    try {
      const uploadIds: string[] = [];
      if (existingUploadId) {
        uploadIds.push(
          await waitForCleanUpload(
            existingUploadId,
            (progress, stage) => setState({ status: 'running', progress, stage }),
            controller.signal,
          ),
        );
      } else {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          if (!file) continue;
          const base = (index / files.length) * 85;
          const share = 85 / files.length;
          const id = await uploadCloudFile(
            file,
            (progress, stage) =>
              setState({
                status: 'running',
                progress: Math.round(base + (progress / 100) * share),
                stage: `${stage} · ${file.name}`,
              }),
            controller.signal,
          );
          uploadIds.push(id);
        }
      }
      const primary = uploadIds[0];
      if (!primary) throw new Error('No clean upload is available for processing.');
      setState({ status: 'running', progress: 88, stage: 'Queueing job' });
      const job = await createCloudJob(
        primary,
        uploadIds.slice(1),
        operationId,
        parameters,
        accessToken,
        controller.signal,
      );
      jobId.current = job.id;
      const completed = await waitForCloudJob(
        job.id,
        accessToken,
        (next) =>
          setState({
            status: 'running',
            progress: Math.max(90, Math.round(90 + next.progress / 10)),
            stage: next.status === 'queued' ? 'Queued' : `Processing · ${next.progress}%`,
          }),
        controller.signal,
      );
      const result = await downloadJobResult(completed.id, accessToken);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      const url = URL.createObjectURL(result.blob);
      resultUrl.current = url;
      setState({ status: 'completed', job: completed, url, filename: result.filename });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'Processing cancelled.'
            : error instanceof Error
              ? error.message
              : 'Cloud processing failed.',
      });
    } finally {
      aborter.current = null;
    }
  }

  async function cancel() {
    aborter.current?.abort();
    const accessToken = accountToken();
    if (jobId.current && accessToken) {
      await fetch(`${API_URL}/jobs/${jobId.current}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  }

  const running = state.status === 'running';
  return (
    <section className="cloud-job-tool" aria-label={`${operationId} cloud processing`}>
      <div className="cloud-tool-heading">
        <div>
          <Badge variant="cloud">PROTECTED CLOUD</Badge>
          <h4>{operationTitle(operationId)}</h4>
        </div>
        <span>
          {existingUploadId
            ? 'Imported media'
            : `${files.length} file(s) · ${formatFileSize(totalSize)}`}
        </span>
      </div>
      <OperationControls
        operationId={operationId}
        parameters={parameters}
        disabled={running}
        update={(name, value) => setParameters((current) => ({ ...current, [name]: value }))}
      />
      {!token ? (
        <p className="cloud-auth-note">
          Cloud jobs require a free account. <a href="/account">Sign in or create one</a>.
        </p>
      ) : null}
      <div className="cloud-tool-actions">
        <Button type="button" onClick={running ? () => void cancel() : () => void run()}>
          {running ? 'Cancel' : state.status === 'completed' ? 'Run again' : 'Upload and process'}
        </Button>
        <span>Files are quarantined, scanned and removed after the retention window.</span>
      </div>
      {running ? (
        <div className="cloud-progress" aria-live="polite">
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
        <div className="cloud-result">
          <div>
            <Badge variant="success">VERIFIED RESULT</Badge>
            <strong>{state.filename}</strong>
            <small>
              {state.job.result_size_bytes ? formatFileSize(state.job.result_size_bytes) : 'Ready'}
              {state.job.runtime_ms ? ` · ${(state.job.runtime_ms / 1000).toFixed(1)} s` : ''}
            </small>
          </div>
          <a className="image-download" href={state.url} download={state.filename}>
            Download result
          </a>
        </div>
      ) : null}
    </section>
  );
}

function OperationControls({
  operationId,
  parameters,
  disabled,
  update,
}: {
  operationId: string;
  parameters: Record<string, string | number>;
  disabled: boolean;
  update: (name: string, value: string | number) => void;
}) {
  if (['compress-video', 'video-to-mp4', 'resize-video'].includes(operationId)) {
    return (
      <div className="cloud-controls">
        <Slider
          id={`${operationId}-quality`}
          label="Quality (CRF)"
          min={18}
          max={32}
          value={Number(parameters.quality)}
          valueLabel={String(parameters.quality)}
          disabled={disabled}
          onChange={(event) => update('quality', Number(event.target.value))}
        />
        <Select
          id={`${operationId}-preset`}
          label="Encoding speed"
          value={String(parameters.preset)}
          disabled={disabled}
          onChange={(event) => update('preset', event.target.value)}
        >
          <option value="fast">Fast</option>
          <option value="medium">Balanced</option>
          <option value="slow">Smaller file</option>
        </Select>
        <Select
          id={`${operationId}-height`}
          label="Maximum height"
          value={String(parameters.max_height)}
          disabled={disabled}
          onChange={(event) => update('max_height', Number(event.target.value))}
        >
          <option value="1080">1080p</option>
          <option value="720">720p</option>
          <option value="480">480p</option>
        </Select>
      </div>
    );
  }
  if (['extract-audio', 'audio-to-mp3', 'optimize-audio'].includes(operationId)) {
    return (
      <div className="cloud-controls">
        <Select
          id={`${operationId}-bitrate`}
          label="MP3 bitrate"
          value={String(parameters.bitrate_kbps)}
          disabled={disabled}
          onChange={(event) => update('bitrate_kbps', Number(event.target.value))}
        >
          <option value="128">128 kbps</option>
          <option value="192">192 kbps</option>
          <option value="256">256 kbps</option>
        </Select>
      </div>
    );
  }
  if (operationId === 'trim-audio') {
    return (
      <div className="cloud-controls">
        <label>
          Start (seconds)
          <input
            type="number"
            min="0"
            max="86400"
            value={Number(parameters.start_ms) / 1000}
            disabled={disabled}
            onChange={(event) => update('start_ms', Math.round(Number(event.target.value) * 1000))}
          />
        </label>
        <label>
          Duration (seconds)
          <input
            type="number"
            min="0.1"
            max="86400"
            step="0.1"
            value={Number(parameters.duration_ms) / 1000}
            disabled={disabled}
            onChange={(event) =>
              update('duration_ms', Math.round(Number(event.target.value) * 1000))
            }
          />
        </label>
      </div>
    );
  }
  if (operationId === 'compress-pdf') {
    return (
      <div className="cloud-controls">
        <Select
          id="pdf-quality"
          label="Compression"
          value={String(parameters.quality)}
          disabled={disabled}
          onChange={(event) => update('quality', event.target.value)}
        >
          <option value="screen">Smallest</option>
          <option value="balanced">Balanced</option>
          <option value="print">Print</option>
        </Select>
      </div>
    );
  }
  if (operationId === 'split-pdf') {
    return (
      <div className="cloud-controls">
        <label>
          First page
          <input
            type="number"
            min="1"
            value={parameters.start_page}
            disabled={disabled}
            onChange={(event) => update('start_page', Number(event.target.value))}
          />
        </label>
        <label>
          Last page
          <input
            type="number"
            min="1"
            value={parameters.end_page}
            disabled={disabled}
            onChange={(event) => update('end_page', Number(event.target.value))}
          />
        </label>
      </div>
    );
  }
  if (operationId === 'pdf-to-jpg') {
    return (
      <div className="cloud-controls">
        <label>
          Page
          <input
            type="number"
            min="1"
            value={parameters.page}
            disabled={disabled}
            onChange={(event) => update('page', Number(event.target.value))}
          />
        </label>
        <Select
          id="pdf-dpi"
          label="Resolution"
          value={String(parameters.dpi)}
          disabled={disabled}
          onChange={(event) => update('dpi', Number(event.target.value))}
        >
          <option value="72">72 DPI</option>
          <option value="150">150 DPI</option>
          <option value="300">300 DPI</option>
        </Select>
        <Slider
          id="jpg-quality"
          label="JPG quality"
          min={40}
          max={95}
          value={Number(parameters.quality)}
          valueLabel={`${parameters.quality}%`}
          disabled={disabled}
          onChange={(event) => update('quality', Number(event.target.value))}
        />
      </div>
    );
  }
  return null;
}

function defaultParameters(operationId: string): Record<string, string | number> {
  if (['compress-video', 'video-to-mp4', 'resize-video'].includes(operationId))
    return { quality: 23, preset: 'medium', max_height: 1080 };
  if (['extract-audio', 'audio-to-mp3', 'optimize-audio'].includes(operationId))
    return { bitrate_kbps: 192 };
  if (operationId === 'trim-audio') return { start_ms: 0, duration_ms: 30000 };
  if (operationId === 'compress-pdf') return { quality: 'balanced' };
  if (operationId === 'split-pdf') return { start_page: 1, end_page: 1 };
  if (operationId === 'pdf-to-jpg') return { page: 1, dpi: 150, quality: 85 };
  return {};
}

function operationTitle(operationId: string) {
  return operationId
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
