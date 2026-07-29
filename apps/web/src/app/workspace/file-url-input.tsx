'use client';

import Image from 'next/image';
import React, { useEffect, useId, useRef, useState } from 'react';
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
    badge: 'PRIVATE INPUT',
    title: 'Drop a File or Link',
    nothing: 'Nothing uploaded',
    readyOne: '1 source ready',
    filesReady: 'files ready',
    device: 'From device',
    link: 'From a link',
    release: 'Release to add your file',
    drop: 'Drop a file here',
    formats: `Docs, Images, Video, Audio, PDF or DOCX · select up to ${MAX_BATCH_FILES}`,
    choose: 'Choose a file',
    publicUrl: 'Public media URL',
    useLink: 'Use this link',
    chooseFileInstead: 'Choose a file instead',
    linkHelp: 'YouTube, Instagram, Dropbox, Google Drive or any public HTTPS link',
    local: 'LOCAL',
    linkBadge: 'LINK',
    noImport: 'No import has started',
    privateTitle: 'Your file stays privately on your device',
    localNote:
      'Selecting a file does not upload it. Processing mode is confirmed before every operation.',
    linkNote:
      'FileFlow validates the address only. A later step will explain cloud import before it begins.',
    chooseIntent: 'CHOOSE INTENT',
    whatDo: 'What would you like to do?',
    available: 'available',
    availableOps: 'Available operations',
    onDevice: 'On this device',
    cloud: 'Protected cloud',
    review: 'Review this plan',
    confirmed: 'Intent confirmed',
    confirm: 'Confirm intent',
    confirmedButton: 'Confirmed',
    inspecting: 'Inspecting locally…',
    fileSummary: 'File summary',
    bytesRead: 'bytes read locally',
    metadata: ['Category', 'Format', 'Declared MIME', 'Detected MIME', 'Extension', 'Modified'],
    operationNames: {},
    invalidFile: 'This file cannot be used. Check its type and size.',
    invalidUrl: 'Enter a supported public HTTPS link.',
    engine: [
      'CHECKING',
      'LOCAL ENGINE',
      'UNAVAILABLE',
      'Browser worker readiness',
      'This device allows guarded local jobs up to',
      'Checking browser capabilities…',
      'Cancel check',
      'Test local engine',
      'Local worker is ready.',
    ],
    batch: [
      'BATCH VERIFIED',
      'REVIEW NEEDED',
      'files inspected locally',
      'All files are compatible JPG or PNG images and can share one local operation.',
      'All files are verified PDFs and can be merged in the selected order.',
      'Use a matching batch of verified JPG/PNG images or PDF files.',
      'Clear batch',
    ],
    plan: [
      'RECOMMENDED',
      'Why this fits',
      'What to expect',
      'Where it runs',
      'Safe defaults',
      'Trade-offs',
      'Alternative',
      'Plan only · nothing has started.',
      'You will confirm settings before any processing.',
    ],
    selected: ['Ready for inspection', 'Validated · Ready for import review', 'Remove'],
    urlImport: [
      'CLOUD IMPORT',
      'Import media from',
      'Outcome',
      'A compatible video plus available title, creator and thumbnail metadata.',
      'Where it runs',
      'The platform import runs in an isolated cloud worker.',
      'Safety',
      'The imported result enters quarantine and malware scanning before processing.',
      'Import intent confirmed',
      'Nothing has been imported yet',
      'The URL is ready for the asynchronous import workflow.',
      'Confirm after reviewing the cloud and safety lifecycle.',
      'Confirm import',
    ],
  },
  ru: {
    badge: 'ПРИВАТНЫЙ ВВОД',
    title: 'Начните с файла или ссылки',
    nothing: 'Ничего не загружено',
    readyOne: '1 источник готов',
    filesReady: 'файлов готово',
    device: 'С устройства',
    link: 'По ссылке',
    release: 'Отпустите, чтобы добавить файл',
    drop: 'Перетащите файл сюда',
    formats: `Изображения, видео, аудио, PDF или DOCX · до ${MAX_BATCH_FILES} файлов`,
    choose: 'Выбрать файл',
    publicUrl: 'Публичная ссылка на медиа',
    useLink: 'Использовать ссылку',
    chooseFileInstead: 'Выбрать файл с устройства',
    linkHelp: 'Публичные ссылки YouTube, TikTok, Instagram, VK Видео и Rutube',
    local: 'ЛОКАЛЬНО',
    linkBadge: 'ССЫЛКА',
    noImport: 'Импорт ещё не начался',
    privateTitle: 'Ваш файл остаётся приватно на устройстве',
    localNote:
      'Выбор файла не загружает его. Режим обработки подтверждается перед каждой операцией.',
    linkNote:
      'FileFlow только проверяет адрес. Перед облачным импортом вы увидите подробное объяснение.',
    chooseIntent: 'ВЫБЕРИТЕ ДЕЙСТВИЕ',
    whatDo: 'Что вы хотите сделать?',
    available: 'доступно',
    availableOps: 'Доступные операции',
    onDevice: 'На этом устройстве',
    cloud: 'Защищённое облако',
    review: 'Проверьте план',
    confirmed: 'Действие подтверждено',
    confirm: 'Подтвердить действие',
    confirmedButton: 'Подтверждено',
    inspecting: 'Локальная проверка…',
    fileSummary: 'Сводка по файлу',
    bytesRead: 'байт прочитано локально',
    metadata: [
      'Категория',
      'Формат',
      'Заявленный MIME',
      'Определённый MIME',
      'Расширение',
      'Изменён',
    ],
    operationNames: {
      'compress-pdf': 'Сжать PDF',
      'split-pdf': 'Разделить PDF',
      'merge-pdf': 'Объединить PDF',
      'pdf-to-jpg': 'PDF в JPEG',
      'pdf-to-docx': 'PDF в Word (DOCX)',
      'pdf-to-pptx': 'PDF в PowerPoint (PPTX)',
      'docx-to-pdf': 'DOCX в PDF',
      'compress-video': 'Сжать',
      'video-to-mp4': 'MP4',
      'remove-video-metadata': 'Удалить метаданные',
      'extract-audio': 'Извлечь аудио',
      'optimize-audio': 'Оптимизировать аудио',
      'audio-to-mp3': 'Аудио в MP3',
      'audio-to-wav': 'Аудио в WAV',
      'trim-audio': 'Обрезать аудио',
      'optimize-image': 'Оптимизировать изображение',
      'remove-image-metadata': 'Удалить метаданные',
    },
    invalidFile: 'Этот файл нельзя использовать. Проверьте тип и размер.',
    invalidUrl: 'Введите поддерживаемую публичную HTTPS-ссылку.',
    engine: [
      'ПРОВЕРКА',
      'ЛОКАЛЬНЫЙ ДВИЖОК',
      'НЕДОСТУПНО',
      'Готовность браузерного обработчика',
      'Это устройство поддерживает защищённые локальные задачи до',
      'Проверяем возможности браузера…',
      'Отменить проверку',
      'Проверить локальный движок',
      'Локальный обработчик готов.',
    ],
    batch: [
      'ПАКЕТ ПРОВЕРЕН',
      'НУЖНА ПРОВЕРКА',
      'файлов проверено локально',
      'Все файлы — совместимые JPG или PNG и подходят для одной локальной операции.',
      'Все файлы — проверенные PDF и могут быть объединены в выбранном порядке.',
      'Используйте однородный пакет проверенных JPG/PNG или PDF.',
      'Очистить пакет',
    ],
    plan: [
      'РЕКОМЕНДОВАНО',
      'Почему подходит',
      'Что ожидать',
      'Где выполняется',
      'Безопасные настройки',
      'Компромиссы',
      'Альтернатива',
      'Только план · ничего не запущено.',
      'Вы подтвердите настройки до начала обработки.',
    ],
    selected: ['Готов к проверке', 'Проверено · готово к проверке импорта', 'Удалить'],
    urlImport: [
      'ОБЛАЧНЫЙ ИМПОРТ',
      'Импортировать медиа из',
      'Результат',
      'Совместимое видео, а также доступные название, автор и превью.',
      'Где выполняется',
      'Импорт платформы выполняется в изолированном облачном обработчике.',
      'Безопасность',
      'Перед обработкой результат проходит карантин и проверку на вредоносное ПО.',
      'Импорт подтверждён',
      'Импорт ещё не начался',
      'Ссылка готова для асинхронного импорта.',
      'Подтвердите после проверки облачного режима и мер безопасности.',
      'Подтвердить импорт',
    ],
  },
  es: {
    badge: 'ENTRADA PRIVADA',
    title: 'Empieza con un archivo o enlace',
    nothing: 'Nada cargado',
    readyOne: '1 fuente lista',
    filesReady: 'archivos listos',
    device: 'Desde el dispositivo',
    link: 'Desde un enlace',
    release: 'Suelta para añadir el archivo',
    drop: 'Suelta un archivo aquí',
    formats: `Imágenes, vídeo, audio, PDF o DOCX · hasta ${MAX_BATCH_FILES} archivos`,
    choose: 'Elegir archivo',
    publicUrl: 'URL pública de medios',
    useLink: 'Usar este enlace',
    chooseFileInstead: 'Elegir un archivo del dispositivo',
    linkHelp: 'Enlaces públicos de YouTube, TikTok, Instagram, VK Video y Rutube',
    local: 'LOCAL',
    linkBadge: 'ENLACE',
    noImport: 'La importación aún no ha empezado',
    privateTitle: 'Tu archivo permanece privado en tu dispositivo',
    localNote:
      'Elegir un archivo no lo carga. El modo de procesamiento se confirma antes de cada operación.',
    linkNote:
      'FileFlow solo valida la dirección. Antes de importar en la nube verás una explicación.',
    chooseIntent: 'ELIGE UNA ACCIÓN',
    whatDo: '¿Qué quieres hacer?',
    available: 'disponibles',
    availableOps: 'Operaciones disponibles',
    onDevice: 'En este dispositivo',
    cloud: 'Nube protegida',
    review: 'Revisa este plan',
    confirmed: 'Acción confirmada',
    confirm: 'Confirmar acción',
    confirmedButton: 'Confirmado',
    inspecting: 'Inspección local…',
    fileSummary: 'Resumen del archivo',
    bytesRead: 'bytes leídos localmente',
    metadata: [
      'Categoría',
      'Formato',
      'MIME declarado',
      'MIME detectado',
      'Extensión',
      'Modificado',
    ],
    operationNames: {
      'compress-pdf': 'Comprimir PDF',
      'split-pdf': 'Dividir PDF',
      'merge-pdf': 'Unir PDFs',
      'pdf-to-jpg': 'PDF a JPEG',
      'pdf-to-docx': 'PDF a Word (DOCX)',
      'pdf-to-pptx': 'PDF a PowerPoint (PPTX)',
      'docx-to-pdf': 'DOCX a PDF',
      'compress-video': 'Comprimir vídeo',
      'video-to-mp4': 'Vídeo a MP4',
      'remove-video-metadata': 'Eliminar metadatos del vídeo',
      'extract-audio': 'Extraer audio',
      'optimize-audio': 'Optimizar audio',
      'audio-to-mp3': 'Audio a MP3',
      'audio-to-wav': 'Audio a WAV',
      'trim-audio': 'Recortar audio',
      'optimize-image': 'Optimizar imagen',
      'remove-image-metadata': 'Eliminar metadatos',
    },
    invalidFile: 'No se puede usar este archivo. Comprueba el tipo y el tamaño.',
    invalidUrl: 'Introduce un enlace HTTPS público compatible.',
    engine: [
      'COMPROBANDO',
      'MOTOR LOCAL',
      'NO DISPONIBLE',
      'Preparación del motor del navegador',
      'Este dispositivo admite trabajos locales protegidos de hasta',
      'Comprobando el navegador…',
      'Cancelar prueba',
      'Probar motor local',
      'El motor local está listo.',
    ],
    batch: [
      'LOTE VERIFICADO',
      'REVISIÓN NECESARIA',
      'archivos inspeccionados localmente',
      'Todos son JPG o PNG compatibles y pueden compartir una operación local.',
      'Todos son PDF verificados y pueden unirse en el orden elegido.',
      'Usa un lote uniforme de JPG/PNG o PDF verificados.',
      'Limpiar lote',
    ],
    plan: [
      'RECOMENDADO',
      'Por qué encaja',
      'Qué esperar',
      'Dónde se ejecuta',
      'Valores seguros',
      'Compromisos',
      'Alternativa',
      'Solo es un plan · nada ha comenzado.',
      'Confirmarás los ajustes antes de procesar.',
    ],
    selected: ['Listo para inspección', 'Validado · listo para revisar la importación', 'Eliminar'],
    urlImport: [
      'IMPORTACIÓN EN LA NUBE',
      'Importar medios de',
      'Resultado',
      'Un vídeo compatible con título, autor y miniatura disponibles.',
      'Dónde se ejecuta',
      'La importación se ejecuta en un motor aislado en la nube.',
      'Seguridad',
      'El resultado pasa por cuarentena y análisis de malware antes de procesarse.',
      'Importación confirmada',
      'Aún no se ha importado nada',
      'La URL está lista para el flujo de importación asíncrono.',
      'Confirma después de revisar el ciclo de nube y seguridad.',
      'Confirmar importación',
    ],
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

  function chooseFileInstead() {
    setTab('file');
    setSource(undefined);
    setBatch(undefined);
    setError('');
    setInspection({ status: 'idle' });
    window.requestAnimationFrame(() => inputRef.current?.click());
  }

  return (
    <Card className="input-card" variant="glass">
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
            role="button"
            tabIndex={0}
            aria-label={text.choose}
            data-drag-active={dragActive || undefined}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
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
            <span className="input-picker-button" aria-hidden="true">
              {text.choose}
            </span>
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
        {source ? <SelectedSource source={source} onRemove={reset} language={language} /> : null}
        {batch ? <BatchPanel batch={batch} onRemove={reset} language={language} /> : null}
        {source?.kind === 'file' ? (
          <FileInspectorPanel
            state={inspection}
            file={source.file}
            initialIntent={initialIntent}
            language={language}
          />
        ) : null}
        {source?.kind === 'url' ? (
          <UrlIntentPanel
            platform={source.platform}
            url={source.url}
            language={language}
            onChooseFile={chooseFileInstead}
          />
        ) : null}
      </div>
    </Card>
  );
}

function BatchPanel({
  batch,
  onRemove,
  language,
}: {
  batch: readonly BatchInspection[];
  onRemove: () => void;
  language: FileFlowLanguage;
}) {
  const text = workspaceCopy[language];
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
            {ready ? text.batch[0] : text.batch[1]}
          </Badge>
          <strong>
            {batch.length} {text.batch[2]}
          </strong>
          <p>{imageReady ? text.batch[3] : pdfReady ? text.batch[4] : text.batch[5]}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          {text.batch[6]}
        </Button>
      </div>
      {imageReady ? <BatchImageTool images={images} language={language} /> : null}
      {pdfReady ? <CloudJobTool operationId="merge-pdf" files={pdfs} language={language} /> : null}
    </>
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
      <RecommendationPanel
        context={context}
        initialIntent={initialIntent}
        file={file}
        sourceMime={item.detectedMime}
        language={language}
      />
      <section className="file-inspector" aria-label={text.fileSummary}>
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
        <h3 id="intent-title">{text.whatDo}</h3>
      </div>
      <div className="intent-options" role="group" aria-label={text.availableOps}>
        {options.map((option) => {
          const selected = result.plan.operationId === option.id;
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={selected}
              onClick={() => setOperationId(option.id)}
            >
              <span aria-hidden="true">{selected ? '●' : '○'}</span>
              <strong>
                {(text.operationNames as Record<string, string>)[option.id] ?? option.displayName}
              </strong>
            </button>
          );
        })}
      </div>
      <RecommendationPlanView plan={result.plan} language={language} />
      {result.plan.mode === 'cloud' ? (
        <CloudJobTool operationId={result.plan.operationId} files={[file]} language={language} />
      ) : null}
      {result.plan.mode === 'local' &&
      (sourceMime === 'image/jpeg' || sourceMime === 'image/png') ? (
        <LocalImageTool
          file={file}
          sourceMime={sourceMime}
          operationId={result.plan.operationId}
          language={language}
        />
      ) : null}
    </section>
  );
}

function UrlIntentPanel({
  platform,
  url,
  language,
  onChooseFile,
}: {
  platform: InputPlatform;
  url: string;
  language: FileFlowLanguage;
  onChooseFile: () => void;
}) {
  const text = workspaceCopy[language];
  const [confirmed, setConfirmed] = useState(false);
  const isImportableMedia = ['youtube', 'instagram', 'tiktok', 'vk', 'rutube'].includes(platform);

  if (!isImportableMedia) {
    return (
      <section
        className="intent-workspace url-intent direct-link-intent"
        aria-labelledby="url-intent-title"
      >
        <div className="intent-heading">
          <div>
            <Badge variant="success">{text.linkBadge}</Badge>
            <h3 id="url-intent-title">
              {platform === 'google-drive'
                ? 'Google Drive link ready'
                : platform === 'dropbox'
                  ? 'Dropbox link ready'
                  : 'Public link ready'}
            </h3>
          </div>
        </div>
        <p>
          Open the source, save the file to this device, then choose it here so FileFlow can inspect
          the real format before showing safe actions.
        </p>
        <div className="intent-confirmation">
          <a className="direct-link-open" href={url} target="_blank" rel="noreferrer">
            Open source
          </a>
          <Button type="button" variant="secondary" onClick={onChooseFile}>
            {text.chooseFileInstead}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="intent-workspace url-intent" aria-labelledby="url-intent-title">
      <div className="intent-heading">
        <div>
          <Badge variant="cloud">{text.urlImport[0]}</Badge>
          <h3 id="url-intent-title">
            {text.urlImport[1]} {platform}
          </h3>
        </div>
      </div>
      <div className="recommendation-explanation">
        <div>
          <strong>{text.urlImport[2]}</strong>
          <p>{text.urlImport[3]}</p>
        </div>
        <div>
          <strong>{text.urlImport[4]}</strong>
          <p>{text.urlImport[5]}</p>
        </div>
        <div>
          <strong>{text.urlImport[6]}</strong>
          <p>{text.urlImport[7]}</p>
        </div>
      </div>
      <div className="intent-confirmation" data-confirmed={confirmed || undefined}>
        <div>
          <strong>{confirmed ? text.urlImport[8] : text.urlImport[9]}</strong>
          <p>{confirmed ? text.urlImport[10] : text.urlImport[11]}</p>
        </div>
        <Button type="button" onClick={() => setConfirmed(true)} disabled={confirmed}>
          {confirmed ? text.confirmedButton : text.urlImport[12]}
        </Button>
        <Button type="button" variant="secondary" onClick={onChooseFile}>
          {text.chooseFileInstead}
        </Button>
      </div>
      {confirmed ? (
        <SocialImportTool url={url} language={language} onChooseFile={onChooseFile} />
      ) : null}
    </section>
  );
}

const localizedPlanCopy = {
  ru: {
    outcome: 'После обработки вы получите проверенный файл в выбранном формате.',
    reason: 'Действие соответствует типу выбранного файла и поддерживается движком FileFlow.',
    expectation: 'Результат создаётся с безопасными ограничениями и проверяется перед скачиванием.',
    privacyLocal: 'Обработка выполняется на этом устройстве. Исходный файл не загружается.',
    privacyCloud: 'Файл временно обрабатывается в защищённом облаке и автоматически удаляется.',
    defaultLabels: ['Результат', 'Качество', 'Настройки'],
    defaultReason: 'Безопасное значение для выбранной операции.',
    tradeoff: 'Изменение формата или сжатие может повлиять на размер и качество результата.',
    alternativeOutcome: 'Альтернативное действие для этого типа файла.',
  },
  es: {
    outcome: 'Después del procesamiento recibirás un archivo verificado en el formato elegido.',
    reason: 'La acción corresponde al tipo de archivo y está admitida por el motor de FileFlow.',
    expectation: 'El resultado usa límites seguros y se verifica antes de la descarga.',
    privacyLocal: 'Se procesa en este dispositivo. El archivo original no se carga.',
    privacyCloud: 'El archivo se procesa temporalmente en la nube protegida y se elimina después.',
    defaultLabels: ['Resultado', 'Calidad', 'Ajustes'],
    defaultReason: 'Valor seguro para la operación seleccionada.',
    tradeoff: 'Cambiar el formato o comprimir puede afectar al tamaño y a la calidad.',
    alternativeOutcome: 'Acción alternativa para este tipo de archivo.',
  },
} as const;

const localizedPlanValues: Record<Exclude<FileFlowLanguage, 'en'>, Record<string, string>> = {
  ru: {
    Balanced: 'Сбалансировано',
    Validated: 'Проверено',
    Preserve: 'Сохранить',
    'Print-ready': 'Для печати',
    'Keep up to 1080p': 'Сохранить до 1080p',
    'Remove private data': 'Удалить приватные данные',
  },
  es: {
    Balanced: 'Equilibrado',
    Validated: 'Verificado',
    Preserve: 'Conservar',
    'Print-ready': 'Listo para imprimir',
    'Keep up to 1080p': 'Conservar hasta 1080p',
    'Remove private data': 'Eliminar datos privados',
  },
};

function localizeRecommendationPlan(
  plan: RecommendationPlan,
  language: FileFlowLanguage,
): RecommendationPlan {
  if (language === 'en') return plan;
  const copy = localizedPlanCopy[language];
  const operationNames = workspaceCopy[language].operationNames as Record<string, string>;
  return {
    ...plan,
    title: operationNames[plan.operationId] ?? plan.title,
    outcome: copy.outcome,
    reason: copy.reason,
    expectation: copy.expectation,
    privacy: plan.mode === 'local' ? copy.privacyLocal : copy.privacyCloud,
    defaults: plan.defaults.map((item, index) => ({
      ...item,
      label: copy.defaultLabels[index] ?? copy.defaultLabels[2],
      value: localizedPlanValues[language][item.value] ?? item.value,
      reason: copy.defaultReason,
    })),
    tradeoffs: plan.tradeoffs.length ? [copy.tradeoff] : [],
    alternatives: plan.alternatives.map((alternative) => ({
      ...alternative,
      title: operationNames[alternative.operationId] ?? alternative.title,
      outcome: copy.alternativeOutcome,
    })),
  };
}

function RecommendationPlanView({
  plan,
  language,
}: {
  plan: RecommendationPlan;
  language: FileFlowLanguage;
}) {
  const visiblePlan = localizeRecommendationPlan(plan, language);
  return (
    <section className="recommendation-panel recommendation-summary" aria-live="polite">
      <strong>{visiblePlan.title}</strong>
      <span>{visiblePlan.outcome}</span>
    </section>
  );
}

function SelectedSource({
  source,
  onRemove,
  language,
}: {
  source: Source;
  onRemove: () => void;
  language: FileFlowLanguage;
}) {
  const text = workspaceCopy[language];
  const file = source.kind === 'file' ? source.file : undefined;
  return (
    <div className="selected-source" data-source-kind={source.kind}>
      <SourcePreview source={source} />
      <div>
        <strong>{source.kind === 'file' ? source.file.name : `${source.platform} link`}</strong>
        <span>
          {file ? `${formatFileSize(file.size)} · ${text.selected[0]}` : text.selected[1]}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRemove}
        aria-label={text.selected[2]}
      >
        {text.selected[2]}
      </Button>
    </div>
  );
}

function SourcePreview({ source }: { source: Source }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const file = source.kind === 'file' ? source.file : undefined;

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file || !previewUrl) {
    return (
      <span className="selected-source-icon" aria-hidden="true">
        {source.kind === 'file' ? 'FILE' : '↗'}
      </span>
    );
  }
  if (file.type.startsWith('image/')) {
    return (
      <Image
        className="selected-source-preview"
        src={previewUrl}
        alt=""
        width={64}
        height={64}
        unoptimized
      />
    );
  }
  if (file.type.startsWith('video/')) {
    return <video className="selected-source-preview" src={previewUrl} muted playsInline />;
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return (
      <object
        className="selected-source-preview"
        data={`${previewUrl}#page=1&toolbar=0&navpanes=0`}
        type="application/pdf"
        aria-label=""
      />
    );
  }
  return (
    <span className="selected-source-icon" aria-hidden="true">
      {file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}
    </span>
  );
}
