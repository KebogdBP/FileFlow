'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  getLocalProcessingCapability,
  LocalJobRunner,
  type LocalCapability,
  type LocalJobHandle,
  type WorkerTransport,
} from '@fileflow/local-processing';
import {
  availableOperations,
  recommendOperation,
  type RecommendationContext,
  type RecommendationPlan,
  type RecommendationResult,
} from '@fileflow/operation-registry';
import { Badge, Button, Card } from '@fileflow/ui';
import {
  FILE_ACCEPT,
  formatFileSize,
  type InputPlatform,
  validateInputFile,
  validateSourceUrl,
} from './input-policy';
import { inspectFile, type FileInspection, type FileInspectionResult } from './file-inspector';
import { LocalImageTool } from './local-image-tool';
import { BatchImageTool } from './batch-image-tool';
import { MAX_BATCH_FILES, validateBatchCount } from './batch-model';

type Source = { kind: 'file'; file: File } | { kind: 'url'; url: string; platform: InputPlatform };
type BatchInspection = { file: File; result: FileInspectionResult };
type InspectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: FileInspection }
  | { status: 'error'; error: string };

export function FileUrlInput() {
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [source, setSource] = useState<Source>();
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [inspection, setInspection] = useState<InspectionState>({ status: 'idle' });
  const [batch, setBatch] = useState<BatchInspection[]>();
  const inputRef = useRef<HTMLInputElement>(null);
  const inspectionRequest = useRef(0);
  const id = useId();

  async function chooseFiles(files: readonly File[]) {
    setDragActive(false);
    const file = files[0];
    if (!file) return;
    if (files.length > 1) {
      const countError = validateBatchCount(files);
      const invalid = files.map(validateInputFile).find((result) => !result.ok);
      if (countError || (invalid && !invalid.ok)) {
        setBatch(undefined);
        setSource(undefined);
        setError(countError ?? (invalid && !invalid.ok ? invalid.error : 'Invalid batch.'));
        return;
      }
      setError('');
      setSource(undefined);
      setInspection({ status: 'idle' });
      setBatch(
        await Promise.all(
          files.map(async (item) => ({ file: item, result: await inspectFile(item) })),
        ),
      );
      return;
    }
    const result = validateInputFile(file);
    if (!result.ok) {
      setSource(undefined);
      setInspection({ status: 'idle' });
      setError(result.error);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError('');
    setBatch(undefined);
    setSource({ kind: 'file', file: result.value });
    setInspection({ status: 'loading' });
    const request = ++inspectionRequest.current;
    const nextInspection = await inspectFile(result.value);
    if (request !== inspectionRequest.current) return;
    setInspection(toInspectionState(nextInspection));
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
    setBatch(undefined);
    setSource({ kind: 'url', ...result.value });
    setInspection({ status: 'idle' });
  }

  function reset() {
    setSource(undefined);
    setBatch(undefined);
    setError('');
    setUrlValue('');
    inspectionRequest.current += 1;
    setInspection({ status: 'idle' });
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
        <span className="input-empty-status">
          {batch ? `${batch.length} files ready` : source ? '1 source ready' : 'Nothing uploaded'}
        </span>
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
              void chooseFiles([...event.dataTransfer.files]);
            }}
          >
            <input
              ref={inputRef}
              className="file-input-native"
              id={`${id}-file`}
              type="file"
              multiple
              accept={FILE_ACCEPT.join(',')}
              aria-describedby={`${id}-file-help`}
              onChange={(event) => void chooseFiles([...(event.target.files ?? [])])}
            />
            <span className="file-drop-icon" aria-hidden="true">
              ↥
            </span>
            <strong>{dragActive ? 'Release to add your file' : 'Drop a file here'}</strong>
            <span id={`${id}-file-help`}>
              Images, video, audio, PDF or DOCX · select up to {MAX_BATCH_FILES}
            </span>
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
        {batch ? <BatchPanel batch={batch} onRemove={reset} /> : null}
        {source?.kind === 'file' ? (
          <FileInspectorPanel state={inspection} file={source.file} />
        ) : null}
        {source?.kind === 'url' ? <UrlIntentPanel platform={source.platform} /> : null}
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
      <LocalEngineStatus />
    </Card>
  );
}

function BatchPanel({
  batch,
  onRemove,
}: {
  batch: readonly BatchInspection[];
  onRemove: () => void;
}) {
  const images: { file: File; sourceMime: 'image/jpeg' | 'image/png' }[] = [];
  for (const { file, result } of batch) {
    if (!result.ok || result.inspection.confidence === 'mismatch') continue;
    const sourceMime = result.inspection.detectedMime;
    if (sourceMime === 'image/jpeg' || sourceMime === 'image/png')
      images.push({ file, sourceMime });
  }
  const ready = images.length === batch.length;
  return (
    <>
      <div className="batch-summary">
        <div>
          <Badge variant={ready ? 'success' : 'warning'}>
            {ready ? 'BATCH VERIFIED' : 'REVIEW NEEDED'}
          </Badge>
          <strong>{batch.length} files inspected locally</strong>
          <p>
            {ready
              ? 'All files are compatible JPG or PNG images and can share one local operation.'
              : `${batch.length - images.length} file(s) cannot join this image batch. Use matching verified JPG or PNG files.`}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          Clear batch
        </Button>
      </div>
      {ready ? <BatchImageTool images={images} /> : null}
    </>
  );
}

type EngineState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; stage: string }
  | { status: 'completed' }
  | { status: 'error'; message: string };

function LocalEngineStatus() {
  const [capability, setCapability] = useState<LocalCapability>();
  const [state, setState] = useState<EngineState>({ status: 'idle' });
  const handle = useRef<LocalJobHandle | null>(null);

  useEffect(() => setCapability(getLocalProcessingCapability()), []);

  function runReadinessCheck() {
    if (!capability?.supported) return;
    const runner = new LocalJobRunner({
      capability,
      timeoutMs: 10_000,
      createWorker: () =>
        new Worker(new URL('./local-readiness.worker.ts', import.meta.url), {
          type: 'module',
        }) as WorkerTransport,
    });
    setState({ status: 'running', progress: 0, stage: 'Preparing' });
    const job = runner.run(
      {
        id: `readiness-${Date.now()}`,
        operationId: 'readiness',
        input: new ArrayBuffer(8),
      },
      ({ progress, stage }) => setState({ status: 'running', progress, stage }),
    );
    handle.current = job;
    void job.promise
      .then(() => setState({ status: 'completed' }))
      .catch((error: unknown) =>
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Local readiness check failed.',
        }),
      );
  }

  const running = state.status === 'running';
  return (
    <section className="local-engine-status" aria-labelledby="local-engine-title">
      <div>
        <Badge variant={capability?.supported ? 'local' : 'neutral'}>
          {capability === undefined
            ? 'CHECKING'
            : capability.supported
              ? 'LOCAL ENGINE'
              : 'UNAVAILABLE'}
        </Badge>
        <h3 id="local-engine-title">Browser worker readiness</h3>
        <p>
          {capability?.supported
            ? `This device allows guarded local jobs up to ${formatFileSize(capability.maxInputBytes)}.`
            : (capability?.reason ?? 'Checking browser capabilities…')}
        </p>
      </div>
      <div className="local-engine-actions">
        {running ? (
          <Button type="button" variant="secondary" onClick={() => handle.current?.cancel()}>
            Cancel check
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={!capability?.supported}
            onClick={runReadinessCheck}
          >
            Test local engine
          </Button>
        )}
      </div>
      <div className="local-engine-feedback" aria-live="polite">
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
        {state.status === 'completed' ? (
          <p className="engine-success">Local worker is ready.</p>
        ) : null}
        {state.status === 'error' ? (
          <p className="input-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function toInspectionState(result: FileInspectionResult): InspectionState {
  return result.ok
    ? { status: 'ready', value: result.inspection }
    : { status: 'error', error: result.error };
}

function FileInspectorPanel({ state, file }: { state: InspectionState; file: File }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <div className="file-inspector file-inspector-loading" aria-busy="true">
        <span className="inspector-spinner" aria-hidden="true" />
        <strong>Inspecting locally…</strong>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <p className="input-error" role="alert">
        {state.error}
      </p>
    );
  }
  const item = state.value;
  const context: RecommendationContext = {
    category: item.category,
    mime:
      item.detectedMime ?? (item.declaredMime === 'Not provided' ? undefined : item.declaredMime),
    size: item.size,
    confidence: item.confidence,
  };
  return (
    <>
      <section className="file-inspector" aria-labelledby="file-inspector-title">
        <div className="file-inspector-heading">
          <div>
            <Badge variant={item.confidence === 'mismatch' ? 'warning' : 'success'}>
              {item.confidence === 'verified' ? 'VERIFIED' : item.confidence.toUpperCase()}
            </Badge>
            <h3 id="file-inspector-title">File summary</h3>
          </div>
          <span>{item.bytesRead} bytes read locally</span>
        </div>
        <dl className="file-metadata-grid">
          <div>
            <dt>Category</dt>
            <dd>{item.category}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{item.detectedFormat ?? item.extension.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Declared MIME</dt>
            <dd>{item.declaredMime}</dd>
          </div>
          <div>
            <dt>Detected MIME</dt>
            <dd>{item.detectedMime ?? 'Not verified'}</dd>
          </div>
          <div>
            <dt>Extension</dt>
            <dd>{item.extension === 'none' ? 'None' : `.${item.extension}`}</dd>
          </div>
          <div>
            <dt>Modified</dt>
            <dd>{item.lastModified ?? 'Not provided'}</dd>
          </div>
        </dl>
        <p
          className={
            item.confidence === 'mismatch' ? 'inspector-notice warning' : 'inspector-notice'
          }
        >
          {item.notice}
        </p>
      </section>
      <RecommendationPanel context={context} />
      {item.confidence !== 'mismatch' &&
      (item.detectedMime === 'image/jpeg' || item.detectedMime === 'image/png') ? (
        <LocalImageTool file={file} sourceMime={item.detectedMime} />
      ) : null}
    </>
  );
}

function RecommendationPanel({ context }: { context: RecommendationContext }) {
  const [operationId, setOperationId] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const result: RecommendationResult = recommendOperation(context, operationId);
  const options = availableOperations(context);

  if (result.status !== 'ready') {
    return (
      <section className="recommendation-blocked" aria-labelledby="recommendation-title">
        <Badge variant={result.status === 'blocked' ? 'warning' : 'neutral'}>
          {result.status === 'blocked' ? 'REVIEW NEEDED' : 'NO SAFE MATCH'}
        </Badge>
        <h3 id="recommendation-title">Recommendation paused</h3>
        <p>{result.reason}</p>
      </section>
    );
  }

  return (
    <section className="intent-workspace" aria-labelledby="intent-title">
      <div className="intent-heading">
        <div>
          <Badge variant="private">CHOOSE INTENT</Badge>
          <h3 id="intent-title">What would you like to do?</h3>
        </div>
        <span>{options.length} available</span>
      </div>
      <div className="intent-options" role="group" aria-label="Available operations">
        {options.map((option) => {
          const selected = result.plan.operationId === option.id;
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={selected}
              onClick={() => {
                setOperationId(option.id);
                setConfirmed(false);
              }}
            >
              <span aria-hidden="true">{selected ? '●' : '○'}</span>
              <strong>{option.displayName}</strong>
              <small>
                {option.executionMode === 'local' ? 'On this device' : 'Protected cloud'}
              </small>
            </button>
          );
        })}
      </div>
      <RecommendationPlanView plan={result.plan} />
      <div className="intent-confirmation" data-confirmed={confirmed || undefined}>
        <div>
          <strong>{confirmed ? 'Intent confirmed' : 'Review this plan'}</strong>
          <p>
            {confirmed
              ? result.plan.mode === 'local'
                ? 'The local tool is ready below. Your source stays on this device.'
                : 'This operation is ready for the protected upload and job workflow.'
              : 'Confirm the operation after reviewing its mode, defaults and trade-offs.'}
          </p>
        </div>
        <Button type="button" onClick={() => setConfirmed(true)} disabled={confirmed}>
          {confirmed ? 'Confirmed' : 'Confirm intent'}
        </Button>
      </div>
    </section>
  );
}

function UrlIntentPanel({ platform }: { platform: InputPlatform }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="intent-workspace url-intent" aria-labelledby="url-intent-title">
      <div className="intent-heading">
        <div>
          <Badge variant="cloud">CLOUD IMPORT</Badge>
          <h3 id="url-intent-title">Import media from {platform}</h3>
        </div>
      </div>
      <div className="recommendation-explanation">
        <div>
          <strong>Outcome</strong>
          <p>A compatible video plus available title, creator and thumbnail metadata.</p>
        </div>
        <div>
          <strong>Where it runs</strong>
          <p>The platform import runs in an isolated cloud worker.</p>
        </div>
        <div>
          <strong>Safety</strong>
          <p>The imported result enters quarantine and malware scanning before processing.</p>
        </div>
      </div>
      <div className="intent-confirmation" data-confirmed={confirmed || undefined}>
        <div>
          <strong>{confirmed ? 'Import intent confirmed' : 'Nothing has been imported yet'}</strong>
          <p>
            {confirmed
              ? 'The URL is ready for the asynchronous import workflow.'
              : 'Confirm after reviewing the cloud and safety lifecycle.'}
          </p>
        </div>
        <Button type="button" onClick={() => setConfirmed(true)} disabled={confirmed}>
          {confirmed ? 'Confirmed' : 'Confirm import'}
        </Button>
      </div>
    </section>
  );
}

function RecommendationPlanView({ plan }: { plan: RecommendationPlan }) {
  return (
    <section className="recommendation-panel" aria-labelledby="recommendation-title">
      <div className="recommendation-heading">
        <div>
          <Badge variant="private">RECOMMENDED</Badge>
          <h3 id="recommendation-title">{plan.title}</h3>
          <p>{plan.outcome}</p>
        </div>
        <Badge variant={plan.mode === 'local' ? 'local' : 'cloud'}>{plan.mode.toUpperCase()}</Badge>
      </div>

      <div className="recommendation-explanation">
        <div>
          <strong>Why this fits</strong>
          <p>{plan.reason}</p>
        </div>
        <div>
          <strong>What to expect</strong>
          <p>{plan.expectation}</p>
        </div>
        <div>
          <strong>Where it runs</strong>
          <p>{plan.privacy}</p>
        </div>
      </div>

      <div>
        <h4>Safe defaults</h4>
        <dl className="recommendation-defaults">
          {plan.defaults.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                <strong>{item.value}</strong>
                <span>{item.reason}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="recommendation-tradeoffs">
        <strong>Trade-offs</strong>
        <ul>
          {plan.tradeoffs.map((tradeoff) => (
            <li key={tradeoff}>{tradeoff}</li>
          ))}
        </ul>
      </div>

      {plan.alternatives.length ? (
        <div className="recommendation-alternatives">
          <h4>Alternative</h4>
          {plan.alternatives.map((alternative) => (
            <div key={alternative.operationId}>
              <span>
                <strong>{alternative.title}</strong>
                <small>{alternative.outcome}</small>
              </span>
              <Badge variant={alternative.mode === 'local' ? 'local' : 'cloud'}>
                {alternative.mode.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}

      <div className="recommendation-plan-status">
        <span aria-hidden="true">◇</span>
        <p>
          <strong>Plan only · nothing has started.</strong> You will confirm settings before any
          processing.
        </p>
      </div>
    </section>
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
