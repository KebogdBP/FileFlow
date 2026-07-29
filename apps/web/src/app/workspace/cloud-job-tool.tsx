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
import type { FileFlowLanguage } from '../use-fileflow-language';

const cloudCopy = {
  en: {
    protected: 'PROTECTED CLOUD',
    messages: [
      'Sign in to use protected cloud processing.',
      'Preparing upload',
      'No clean upload is available for processing.',
      'Queueing job',
      'Queued',
      'Processing',
      'Processing cancelled.',
      'Cloud processing failed.',
    ],
    imported: 'Imported media',
    files: 'file(s)',
    auth: ['Cloud jobs require a free account.', 'Sign in or create one'],
    actions: ['Cancel', 'Run again', 'Upload and process'],
    retention: 'Files are quarantined, scanned and removed after the retention window.',
    result: ['VERIFIED RESULT', 'Ready', 'Download result'],
    controls: [
      'Quality (CRF)',
      'Encoding speed',
      'Fast',
      'Balanced',
      'Smaller file',
      'Maximum height',
      'MP3 bitrate',
      'Start (seconds)',
      'Duration (seconds)',
      'Compression',
      'Smallest',
      'Print',
      'First page',
      'Last page',
      'Page',
      'Resolution',
      'JPG quality',
    ],
  },
  ru: {
    protected: 'ЗАЩИЩЁННОЕ ОБЛАКО',
    messages: [
      'Войдите, чтобы использовать защищённую облачную обработку.',
      'Подготовка загрузки',
      'Нет проверенного файла для обработки.',
      'Постановка задачи в очередь',
      'В очереди',
      'Обработка',
      'Обработка отменена.',
      'Не удалось выполнить облачную обработку.',
    ],
    imported: 'Импортированное медиа',
    files: 'файл(ов)',
    auth: ['Для облачных задач нужен бесплатный аккаунт.', 'Войти или зарегистрироваться'],
    actions: ['Отменить', 'Запустить снова', 'Загрузить и обработать'],
    retention: 'Файлы проходят карантин и проверку, затем автоматически удаляются.',
    result: ['ПРОВЕРЕННЫЙ РЕЗУЛЬТАТ', 'Готово', 'Скачать результат'],
    controls: [
      'Качество (CRF)',
      'Скорость кодирования',
      'Быстро',
      'Баланс',
      'Меньший файл',
      'Максимальная высота',
      'Битрейт MP3',
      'Начало (секунды)',
      'Длительность (секунды)',
      'Сжатие',
      'Минимальный размер',
      'Для печати',
      'Первая страница',
      'Последняя страница',
      'Страница',
      'Разрешение',
      'Качество JPEG',
    ],
  },
  es: {
    protected: 'NUBE PROTEGIDA',
    messages: [
      'Inicia sesión para usar el procesamiento protegido en la nube.',
      'Preparando la carga',
      'No hay ningún archivo verificado para procesar.',
      'Añadiendo el trabajo a la cola',
      'En cola',
      'Procesando',
      'Procesamiento cancelado.',
      'El procesamiento en la nube ha fallado.',
    ],
    imported: 'Medio importado',
    files: 'archivo(s)',
    auth: [
      'Los trabajos en la nube requieren una cuenta gratuita.',
      'Inicia sesión o crea una cuenta',
    ],
    actions: ['Cancelar', 'Ejecutar de nuevo', 'Cargar y procesar'],
    retention: 'Los archivos pasan cuarentena y análisis, y después se eliminan.',
    result: ['RESULTADO VERIFICADO', 'Listo', 'Descargar resultado'],
    controls: [
      'Calidad (CRF)',
      'Velocidad de codificación',
      'Rápida',
      'Equilibrada',
      'Archivo más pequeño',
      'Altura máxima',
      'Bitrate MP3',
      'Inicio (segundos)',
      'Duración (segundos)',
      'Compresión',
      'Más pequeño',
      'Impresión',
      'Primera página',
      'Última página',
      'Página',
      'Resolución',
      'Calidad JPEG',
    ],
  },
} as const;

const pageSelectionCopy = {
  en: { mode: 'Pages to extract', all: 'All pages', selected: 'Selected pages', pages: 'Pages' },
  ru: {
    mode: 'Какие страницы извлечь',
    all: 'Все страницы',
    selected: 'Выбранные страницы',
    pages: 'Страницы (например, 1,3-5)',
  },
  es: {
    mode: 'Páginas para extraer',
    all: 'Todas las páginas',
    selected: 'Páginas seleccionadas',
    pages: 'Páginas (por ejemplo, 1,3-5)',
  },
} as const;

type State =
  | { status: 'idle' }
  | { status: 'running'; progress: number; stage: string }
  | { status: 'completed'; job: CloudJob; url: string; filename: string }
  | { status: 'error'; message: string };

export function CloudJobTool({
  operationId,
  files = [],
  existingUploadId,
  language = 'en',
}: {
  operationId: string;
  files?: readonly File[];
  existingUploadId?: string;
  language?: FileFlowLanguage;
}) {
  const text = cloudCopy[language];
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
      setState({ status: 'error', message: text.messages[0] });
      return;
    }
    const controller = new AbortController();
    aborter.current = controller;
    setState({ status: 'running', progress: 0, stage: text.messages[1] });
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
      if (!primary) throw new Error(text.messages[2]);
      setState({ status: 'running', progress: 88, stage: text.messages[3] });
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
            stage:
              next.status === 'queued'
                ? text.messages[4]
                : `${text.messages[5]} · ${next.progress}%`,
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
            ? text.messages[6]
            : error instanceof Error
              ? error.message
              : text.messages[7],
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
          <Badge variant="cloud">{text.protected}</Badge>
          <h4>{operationTitle(operationId, language)}</h4>
        </div>
        <span>
          {existingUploadId
            ? text.imported
            : `${files.length} ${text.files} · ${formatFileSize(totalSize)}`}
        </span>
      </div>
      <OperationControls
        operationId={operationId}
        parameters={parameters}
        disabled={running}
        language={language}
        update={(name, value) => setParameters((current) => ({ ...current, [name]: value }))}
      />
      {!token ? (
        <p className="cloud-auth-note">
          {text.auth[0]} <a href="/account">{text.auth[1]}</a>.
        </p>
      ) : null}
      <div className="cloud-tool-actions">
        <Button type="button" onClick={running ? () => void cancel() : () => void run()}>
          {running
            ? text.actions[0]
            : state.status === 'completed'
              ? text.actions[1]
              : text.actions[2]}
        </Button>
        <span>{text.retention}</span>
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
            <Badge variant="success">{text.result[0]}</Badge>
            <strong>{state.filename}</strong>
            <small>
              {state.job.result_size_bytes
                ? formatFileSize(state.job.result_size_bytes)
                : text.result[1]}
              {state.job.runtime_ms ? ` · ${(state.job.runtime_ms / 1000).toFixed(1)} s` : ''}
            </small>
          </div>
          <a className="image-download" href={state.url} download={state.filename}>
            {text.result[2]}
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
  language,
  update,
}: {
  operationId: string;
  parameters: Record<string, string | number>;
  disabled: boolean;
  language: FileFlowLanguage;
  update: (name: string, value: string | number) => void;
}) {
  const labels = cloudCopy[language].controls;
  if (['compress-video', 'video-to-mp4', 'resize-video'].includes(operationId)) {
    return (
      <div className="cloud-controls">
        <Slider
          id={`${operationId}-quality`}
          label={labels[0]}
          min={18}
          max={32}
          value={Number(parameters.quality)}
          valueLabel={String(parameters.quality)}
          disabled={disabled}
          onChange={(event) => update('quality', Number(event.target.value))}
        />
        <Select
          id={`${operationId}-preset`}
          label={labels[1]}
          value={String(parameters.preset)}
          disabled={disabled}
          onChange={(event) => update('preset', event.target.value)}
        >
          <option value="fast">{labels[2]}</option>
          <option value="medium">{labels[3]}</option>
          <option value="slow">{labels[4]}</option>
        </Select>
        <Select
          id={`${operationId}-height`}
          label={labels[5]}
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
          label={labels[6]}
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
          {labels[7]}
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
          {language === 'ru'
            ? 'Конец (секунды)'
            : language === 'es'
              ? 'Fin (segundos)'
              : 'End (seconds)'}
          <input
            type="number"
            min="0.1"
            max="86400"
            step="0.1"
            value={Number(parameters.end_ms) / 1000}
            disabled={disabled}
            onChange={(event) => update('end_ms', Math.round(Number(event.target.value) * 1000))}
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
          label={labels[9]}
          value={String(parameters.quality)}
          disabled={disabled}
          onChange={(event) => update('quality', event.target.value)}
        >
          <option value="screen">{labels[10]}</option>
          <option value="balanced">{labels[3]}</option>
          <option value="print">{labels[11]}</option>
        </Select>
      </div>
    );
  }
  if (operationId === 'split-pdf') {
    const pageText = pageSelectionCopy[language];
    const allPages = parameters.pages === 'all';
    return (
      <div className="cloud-controls">
        <Select
          id="pdf-page-mode"
          label={pageText.mode}
          value={allPages ? 'all' : 'selected'}
          disabled={disabled}
          onChange={(event) => update('pages', event.target.value === 'all' ? 'all' : '1')}
        >
          <option value="all">{pageText.all}</option>
          <option value="selected">{pageText.selected}</option>
        </Select>
        {!allPages ? (
          <label>
            {pageText.pages}
            <input
              type="text"
              inputMode="numeric"
              placeholder="1,3-5"
              value={parameters.pages}
              disabled={disabled}
              onChange={(event) => update('pages', event.target.value)}
            />
          </label>
        ) : null}
      </div>
    );
  }
  if (operationId === 'pdf-to-jpg') {
    return (
      <div className="cloud-controls">
        <label>
          {labels[14]}
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
          label={labels[15]}
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
          label={labels[16]}
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
  if (operationId === 'trim-audio') return { start_ms: 0, end_ms: 30000 };
  if (operationId === 'compress-pdf') return { quality: 'balanced' };
  if (operationId === 'split-pdf') return { pages: 'all' };
  if (operationId === 'pdf-to-jpg') return { page: 1, dpi: 150, quality: 85 };
  return {};
}

const operationTitles: Record<Exclude<FileFlowLanguage, 'en'>, Record<string, string>> = {
  ru: {
    'compress-video': 'Сжать видео',
    'video-to-mp4': 'Видео в MP4',
    'resize-video': 'Изменить размер видео',
    'extract-audio': 'Извлечь аудио',
    'optimize-audio': 'Оптимизировать аудио',
    'audio-to-mp3': 'Аудио в MP3',
    'audio-to-wav': 'Аудио в WAV',
    'trim-audio': 'Обрезать аудио',
    'merge-pdf': 'Объединить PDF',
    'compress-pdf': 'Сжать PDF',
    'split-pdf': 'Разделить PDF',
    'pdf-to-jpg': 'PDF в JPEG',
    'pdf-to-docx': 'PDF в Word (DOCX)',
    'pdf-to-pptx': 'PDF в PowerPoint (PPTX)',
    'docx-to-pdf': 'DOCX в PDF',
  },
  es: {
    'compress-video': 'Comprimir vídeo',
    'video-to-mp4': 'Vídeo a MP4',
    'resize-video': 'Redimensionar vídeo',
    'extract-audio': 'Extraer audio',
    'optimize-audio': 'Optimizar audio',
    'audio-to-mp3': 'Audio a MP3',
    'audio-to-wav': 'Audio a WAV',
    'trim-audio': 'Recortar audio',
    'merge-pdf': 'Unir PDFs',
    'compress-pdf': 'Comprimir PDF',
    'split-pdf': 'Dividir PDF',
    'pdf-to-jpg': 'PDF a JPEG',
    'pdf-to-docx': 'PDF a Word (DOCX)',
    'pdf-to-pptx': 'PDF a PowerPoint (PPTX)',
    'docx-to-pdf': 'DOCX a PDF',
  },
};

function operationTitle(operationId: string, language: FileFlowLanguage) {
  if (language !== 'en') {
    const translated = operationTitles[language][operationId];
    if (translated) return translated;
  }
  return operationId
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
