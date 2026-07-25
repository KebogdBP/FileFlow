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
import { CloudJobTool } from './cloud-job-tool';
import { SocialImportTool } from './social-import-tool';
import type { FileFlowLanguage } from '../use-fileflow-language';

type Source = { kind: 'file'; file: File } | { kind: 'url'; url: string; platform: InputPlatform };
type BatchInspection = { file: File; result: FileInspectionResult };
type InspectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: FileInspection }
  | { status: 'error'; error: string };

const workspaceCopy = {
  en: {
    badge: 'PRIVATE INPUT', title: 'Start with a file or link', nothing: 'Nothing uploaded',
    readyOne: '1 source ready', filesReady: 'files ready', device: 'From device', link: 'From a link',
    release: 'Release to add your file', drop: 'Drop a file here',
    formats: `Images, video, audio, PDF or DOCX · select up to ${MAX_BATCH_FILES}`,
    choose: 'Choose a file', publicUrl: 'Public media URL', useLink: 'Use this link',
    linkHelp: 'YouTube, Instagram and TikTok public links', local: 'LOCAL', linkBadge: 'LINK',
    noImport: 'No import has started', privateTitle: 'Your file stays privately on your device',
    localNote: 'Selecting a file does not upload it. Processing mode is confirmed before every operation.',
    linkNote: 'FileFlow validates the address only. A later step will explain cloud import before it begins.',
    chooseIntent: 'CHOOSE INTENT', whatDo: 'What would you like to do?', available: 'available',
    availableOps: 'Available operations', onDevice: 'On this device', cloud: 'Protected cloud',
    review: 'Review this plan', confirmed: 'Intent confirmed', confirm: 'Confirm intent',
    confirmedButton: 'Confirmed',
    inspecting: 'Inspecting locally…', fileSummary: 'File summary', bytesRead: 'bytes read locally',
    metadata: ['Category', 'Format', 'Declared MIME', 'Detected MIME', 'Extension', 'Modified'],
    operationNames: {},
    invalidFile: 'This file cannot be used. Check its type and size.', invalidUrl: 'Enter a supported public HTTPS link.',
  },
  ru: {
    badge: 'ПРИВАТНЫЙ ВВОД', title: 'Начните с файла или ссылки', nothing: 'Ничего не загружено',
    readyOne: '1 источник готов', filesReady: 'файлов готово', device: 'С устройства', link: 'По ссылке',
    release: 'Отпустите, чтобы добавить файл', drop: 'Перетащите файл сюда',
    formats: `Изображения, видео, аудио, PDF или DOCX · до ${MAX_BATCH_FILES} файлов`,
    choose: 'Выбрать файл', publicUrl: 'Публичная ссылка на медиа', useLink: 'Использовать ссылку',
    linkHelp: 'Публичные ссылки YouTube, Instagram и TikTok', local: 'ЛОКАЛЬНО', linkBadge: 'ССЫЛКА',
    noImport: 'Импорт ещё не начался', privateTitle: 'Ваш файл остаётся приватно на устройстве',
    localNote: 'Выбор файла не загружает его. Режим обработки подтверждается перед каждой операцией.',
    linkNote: 'FileFlow только проверяет адрес. Перед облачным импортом вы увидите подробное объяснение.',
    chooseIntent: 'ВЫБЕРИТЕ ДЕЙСТВИЕ', whatDo: 'Что вы хотите сделать?', available: 'доступно',
    availableOps: 'Доступные операции', onDevice: 'На этом устройстве', cloud: 'Защищённое облако',
    review: 'Проверьте план', confirmed: 'Действие подтверждено', confirm: 'Подтвердить действие',
    confirmedButton: 'Подтверждено',
    inspecting: 'Локальная проверка…', fileSummary: 'Сводка по файлу', bytesRead: 'байт прочитано локально',
    metadata: ['Категория', 'Формат', 'Заявленный MIME', 'Определённый MIME', 'Расширение', 'Изменён'],
    operationNames: {
      'compress-pdf': 'Сжать PDF', 'split-pdf': 'Разделить PDF', 'merge-pdf': 'Объединить PDF',
      'pdf-to-jpg': 'PDF в JPEG', 'docx-to-pdf': 'DOCX в PDF', 'compress-video': 'Сжать видео',
      'resize-video': 'Изменить размер видео', 'extract-audio': 'Извлечь аудио',
      'optimize-image': 'Оптимизировать изображение', 'remove-image-metadata': 'Удалить метаданные',
    },
    invalidFile: 'Этот файл нельзя использовать. Проверьте тип и размер.', invalidUrl: 'Введите поддерживаемую публичную HTTPS-ссылку.',
  },
  es: {
    badge: 'ENTRADA PRIVADA', title: 'Empieza con un archivo o enlace', nothing: 'Nada cargado',
    readyOne: '1 fuente lista', filesReady: 'archivos listos', device: 'Desde el dispositivo', link: 'Desde un enlace',
    release: 'Suelta para añadir el archivo', drop: 'Suelta un archivo aquí',
    formats: `Imágenes, vídeo, audio, PDF o DOCX · hasta ${MAX_BATCH_FILES} archivos`,
    choose: 'Elegir archivo', publicUrl: 'URL pública de medios', useLink: 'Usar este enlace',
    linkHelp: 'Enlaces públicos de YouTube, Instagram y TikTok', local: 'LOCAL', linkBadge: 'ENLACE',
    noImport: 'La importación aún no ha empezado', privateTitle: 'Tu archivo permanece privado en tu dispositivo',
    localNote: 'Elegir un archivo no lo carga. El modo de procesamiento se confirma antes de cada operación.',
    linkNote: 'FileFlow solo valida la dirección. Antes de importar en la nube verás una explicación.',
    chooseIntent: 'ELIGE UNA ACCIÓN', whatDo: '¿Qué quieres hacer?', available: 'disponibles',
    availableOps: 'Operaciones disponibles', onDevice: 'En este dispositivo', cloud: 'Nube protegida',
    review: 'Revisa este plan', confirmed: 'Acción confirmada', confirm: 'Confirmar acción',
    confirmedButton: 'Confirmado',
    inspecting: 'Inspección local…', fileSummary: 'Resumen del archivo', bytesRead: 'bytes leídos localmente',
    metadata: ['Categoría', 'Formato', 'MIME declarado', 'MIME detectado', 'Extensión', 'Modificado'],
    operationNames: {
      'compress-pdf': 'Comprimir PDF', 'split-pdf': 'Dividir PDF', 'merge-pdf': 'Unir PDFs',
      'pdf-to-jpg': 'PDF a JPEG', 'docx-to-pdf': 'DOCX a PDF', 'compress-video': 'Comprimir vídeo',
      'resize-video': 'Redimensionar vídeo', 'extract-audio': 'Extraer audio',
      'optimize-image': 'Optimizar imagen', 'remove-image-metadata': 'Eliminar metadatos',
    },
    invalidFile: 'No se puede usar este archivo. Comprueba el tipo y el tamaño.', invalidUrl: 'Introduce un enlace HTTPS público compatible.',
  },
} as const;

export function FileUrlInput({
  initialIntent,
  initialUrl,
  language = 'en',
}: {
  initialIntent?: string;
  initialUrl?: string;
  language?: FileFlowLanguage;
}) {
  const text = workspaceCopy[language];
  const [tab, setTab] = useState<'file' | 'url'>(initialUrl ? 'url' : 'file');
  const [source, setSource] = useState<Source>();
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [urlValue, setUrlValue] = useState(initialUrl ?? '');
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
      setError(language === 'en' ? result.error : text.invalidFile);
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
      setError(language === 'en' ? result.error : text.invalidUrl);
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
          <Badge variant="private">{text.badge}</Badge>
          <h2 id={`${id}-title`}>{text.title}</h2>
        </div>
        <span className="input-empty-status">
          {batch ? `${batch.length} ${text.filesReady}` : source ? text.readyOne : text.nothing}
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
          {text.device}
        </button>
        <button
          type="button"
          role="tab"
          id={`${id}-url-tab`}
          aria-selected={tab === 'url'}
          aria-controls={`${id}-url-panel`}
          onClick={() => selectTab('url')}
        >
          {text.link}
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
            <strong>{dragActive ? text.release : text.drop}</strong>
            <span id={`${id}-file-help`}>{text.formats}</span>
            <label className="input-picker-button" htmlFor={`${id}-file`}>
              {text.choose}
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
            <label htmlFor={`${id}-url`}>{text.publicUrl}</label>
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
              <Button type="submit">{text.useLink}</Button>
            </div>
            <span id={`${id}-url-help`}>{text.linkHelp}</span>
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
          <FileInspectorPanel
            state={inspection}
            file={source.file}
            initialIntent={initialIntent}
            language={language}
          />
        ) : null}
        {source?.kind === 'url' ? (
          <UrlIntentPanel platform={source.platform} url={source.url} />
        ) : null}
      </div>

      <div className="input-privacy-note">
        <Badge variant={source?.kind === 'url' ? 'cloud' : 'local'}>
          {source?.kind === 'url' ? text.linkBadge : text.local}
        </Badge>
        <div>
          <strong>
            {source?.kind === 'url' ? text.noImport : text.privateTitle}
          </strong>
          <p>
            {source?.kind === 'url'
              ? text.linkNote
              : text.localNote}
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
  const pdfs: File[] = [];
  for (const { file, result } of batch) {
    if (!result.ok || result.inspection.confidence === 'mismatch') continue;
    const sourceMime = result.inspection.detectedMime;
    if (sourceMime === 'image/jpeg' || sourceMime === 'image/png')
      images.push({ file, sourceMime });
    if (sourceMime === 'application/pdf') pdfs.push(file);
  }
  const imageReady = images.length === batch.length;
  const pdfReady = pdfs.length === batch.length;
  const ready = imageReady || pdfReady;
  return (
    <>
      <div className="batch-summary">
        <div>
          <Badge variant={ready ? 'success' : 'warning'}>
            {ready ? 'BATCH VERIFIED' : 'REVIEW NEEDED'}
          </Badge>
          <strong>{batch.length} files inspected locally</strong>
          <p>
            {imageReady
              ? 'All files are compatible JPG or PNG images and can share one local operation.'
              : pdfReady
                ? 'All files are verified PDFs and can be merged in the selected order.'
                : 'Use a matching batch of verified JPG/PNG images or PDF files.'}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          Clear batch
        </Button>
      </div>
      {imageReady ? <BatchImageTool images={images} /> : null}
      {pdfReady ? <CloudJobTool operationId="merge-pdf" files={pdfs} /> : null}
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

function FileInspectorPanel({
  state,
  file,
  initialIntent,
  language,
}: {
  state: InspectionState;
  file: File;
  initialIntent?: string;
  language: FileFlowLanguage;
}) {
  const text = workspaceCopy[language];
  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <div className="file-inspector file-inspector-loading" aria-busy="true">
        <span className="inspector-spinner" aria-hidden="true" />
        <strong>{text.inspecting}</strong>
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
            <h3 id="file-inspector-title">{text.fileSummary}</h3>
          </div>
          <span>{item.bytesRead} {text.bytesRead}</span>
        </div>
        <dl className="file-metadata-grid">
          <div>
            <dt>{text.metadata[0]}</dt>
            <dd>{item.category}</dd>
          </div>
          <div>
            <dt>{text.metadata[1]}</dt>
            <dd>{item.detectedFormat ?? item.extension.toUpperCase()}</dd>
          </div>
          <div>
            <dt>{text.metadata[2]}</dt>
            <dd>{item.declaredMime}</dd>
          </div>
          <div>
            <dt>{text.metadata[3]}</dt>
            <dd>{item.detectedMime ?? 'Not verified'}</dd>
          </div>
          <div>
            <dt>{text.metadata[4]}</dt>
            <dd>{item.extension === 'none' ? 'None' : `.${item.extension}`}</dd>
          </div>
          <div>
            <dt>{text.metadata[5]}</dt>
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
        context={context}
        initialIntent={initialIntent}
        file={file}
        sourceMime={item.detectedMime}
        language={language}
      />
    </>
  );
}

function RecommendationPanel({
  context,
  initialIntent,
  file,
  sourceMime,
  language,
}: {
  context: RecommendationContext;
  initialIntent?: string;
  file: File;
  sourceMime?: string;
  language: FileFlowLanguage;
}) {
  const text = workspaceCopy[language];
  const [operationId, setOperationId] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const options = availableOperations(context);
  const selectedOperation = options.some((option) => option.id === operationId)
    ? operationId
    : options.some((option) => option.id === initialIntent)
      ? initialIntent
      : undefined;
  const result: RecommendationResult = recommendOperation(context, selectedOperation);

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
          <Badge variant="private">{text.chooseIntent}</Badge>
          <h3 id="intent-title">{text.whatDo}</h3>
        </div>
        <span>{options.length} {text.available}</span>
      </div>
      <div className="intent-options" role="group" aria-label={text.availableOps}>
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
              <strong>
                {(text.operationNames as Record<string, string>)[option.id] ?? option.displayName}
              </strong>
              <small>
                {option.executionMode === 'local' ? text.onDevice : text.cloud}
              </small>
            </button>
          );
        })}
      </div>
      <RecommendationPlanView plan={result.plan} />
      <div className="intent-confirmation" data-confirmed={confirmed || undefined}>
        <div>
          <strong>{confirmed ? text.confirmed : text.review}</strong>
          <p>
            {confirmed
              ? result.plan.mode === 'local'
                ? 'The local tool is ready below. Your source stays on this device.'
                : 'This operation is ready for the protected upload and job workflow.'
              : 'Confirm the operation after reviewing its mode, defaults and trade-offs.'}
          </p>
        </div>
        <Button type="button" onClick={() => setConfirmed(true)} disabled={confirmed}>
          {confirmed ? text.confirmedButton : text.confirm}
        </Button>
      </div>
      {confirmed && result.plan.mode === 'cloud' ? (
        <CloudJobTool operationId={result.plan.operationId} files={[file]} />
      ) : null}
      {confirmed &&
      result.plan.mode === 'local' &&
      (sourceMime === 'image/jpeg' || sourceMime === 'image/png') ? (
        <LocalImageTool file={file} sourceMime={sourceMime} operationId={result.plan.operationId} />
      ) : null}
    </section>
  );
}

function UrlIntentPanel({ platform, url }: { platform: InputPlatform; url: string }) {
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
      {confirmed ? <SocialImportTool url={url} /> : null}
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
