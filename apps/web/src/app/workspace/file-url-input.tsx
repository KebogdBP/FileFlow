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
  recommendOperation,
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

type Source = { kind: 'file'; file: File } | { kind: 'url'; url: string; platform: InputPlatform };
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
  const inputRef = useRef<HTMLInputElement>(null);
  const inspectionRequest = useRef(0);
  const id = useId();

  async function chooseFile(file?: File) {
    setDragActive(false);
    if (!file) return;
    const result = validateInputFile(file);
    if (!result.ok) {
      setSource(undefined);
      setInspection({ status: 'idle' });
      setError(result.error);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError('');
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
    setSource({ kind: 'url', ...result.value });
    setInspection({ status: 'idle' });
  }

  function reset() {
    setSource(undefined);
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
        {source?.kind === 'file' ? <FileInspectorPanel state={inspection} /> : null}
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

function FileInspectorPanel({ state }: { state: InspectionState }) {
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
      <RecommendationPanel
        result={recommendOperation({
          category: item.category,
          mime:
            item.detectedMime ??
            (item.declaredMime === 'Not provided' ? undefined : item.declaredMime),
          size: item.size,
          confidence: item.confidence,
        })}
      />
    </>
  );
}

function RecommendationPanel({ result }: { result: RecommendationResult }) {
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

  return <RecommendationPlanView plan={result.plan} />;
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
