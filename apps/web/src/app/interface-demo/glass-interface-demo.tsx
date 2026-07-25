'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';

type FileKind = 'pdf' | 'document' | 'image' | 'video' | 'audio' | 'other';

type FileInfo = {
  name: string;
  size: number;
  kind: FileKind;
};

type Action = {
  id: string;
  title: string;
  hint: string;
  from: string;
  to: string;
  route?: string;
};

const actionsByKind: Record<FileKind, Action[]> = {
  pdf: [
    {
      id: 'pdf-to-docx',
      title: 'PDF в DOCX',
      hint: 'Вернуть редактируемый текст',
      from: 'PDF',
      to: 'DOCX',
    },
    {
      id: 'merge-pdf',
      title: 'Объединить PDF',
      hint: 'Добавить ещё файлы и собрать один',
      from: 'PDF +',
      to: 'PDF',
      route: '/tools/merge-pdf',
    },
    {
      id: 'split-pdf',
      title: 'Разделить PDF',
      hint: 'Оставить только нужные страницы',
      from: 'PDF',
      to: 'PDF',
      route: '/tools/split-pdf',
    },
    {
      id: 'pdf-to-jpg',
      title: 'PDF в картинки',
      hint: 'Сохранить страницы как JPG',
      from: 'PDF',
      to: 'JPG',
      route: '/tools/pdf-to-jpg',
    },
    {
      id: 'compress-pdf',
      title: 'Сжать PDF',
      hint: 'Уменьшить размер документа',
      from: 'PDF',
      to: 'SMALL',
      route: '/tools/compress-pdf',
    },
  ],
  document: [
    {
      id: 'docx-to-pdf',
      title: 'Документ в PDF',
      hint: 'Для отправки и печати',
      from: 'DOCX',
      to: 'PDF',
      route: '/tools/docx-to-pdf',
    },
    {
      id: 'document-cleanup',
      title: 'Убрать метаданные',
      hint: 'Подготовить чистую копию',
      from: 'DOCX',
      to: 'CLEAN',
    },
  ],
  image: [
    {
      id: 'optimize-image',
      title: 'Сделать легче',
      hint: 'Уменьшить размер изображения',
      from: 'IMAGE',
      to: 'WEBP',
      route: '/tools/optimize-image',
    },
    {
      id: 'remove-image-metadata',
      title: 'Убрать метаданные',
      hint: 'Удалить геоданные и сведения камеры',
      from: 'IMAGE',
      to: 'CLEAN',
      route: '/tools/remove-image-metadata',
    },
  ],
  video: [
    {
      id: 'compress-video',
      title: 'Сжать видео',
      hint: 'Подготовить для отправки',
      from: 'VIDEO',
      to: 'SMALL',
      route: '/tools/compress-video',
    },
    {
      id: 'video-to-mp4',
      title: 'Видео в MP4',
      hint: 'Универсальный формат',
      from: 'VIDEO',
      to: 'MP4',
      route: '/tools/video-to-mp4',
    },
    {
      id: 'extract-audio',
      title: 'Извлечь звук',
      hint: 'Сохранить только аудиодорожку',
      from: 'VIDEO',
      to: 'MP3',
      route: '/tools/extract-audio',
    },
    {
      id: 'resize-video',
      title: 'Изменить размер',
      hint: 'Подогнать разрешение',
      from: 'VIDEO',
      to: 'SIZE',
      route: '/tools/resize-video',
    },
  ],
  audio: [
    {
      id: 'audio-to-mp3',
      title: 'Аудио в MP3',
      hint: 'Универсальный формат',
      from: 'AUDIO',
      to: 'MP3',
      route: '/tools/audio-to-mp3',
    },
    {
      id: 'audio-to-wav',
      title: 'Аудио в WAV',
      hint: 'Для монтажа и обработки',
      from: 'AUDIO',
      to: 'WAV',
      route: '/tools/audio-to-wav',
    },
    {
      id: 'trim-audio',
      title: 'Обрезать аудио',
      hint: 'Оставить нужный фрагмент',
      from: 'AUDIO',
      to: 'TRIM',
      route: '/tools/trim-audio',
    },
    {
      id: 'optimize-audio',
      title: 'Сделать легче',
      hint: 'Уменьшить размер файла',
      from: 'AUDIO',
      to: 'SMALL',
      route: '/tools/optimize-audio',
    },
  ],
  other: [
    {
      id: 'inspect-file',
      title: 'Проверить файл',
      hint: 'Посмотреть тип и свойства',
      from: 'FILE',
      to: 'INFO',
    },
  ],
};

const kindLabels: Record<FileKind, string> = {
  pdf: 'PDF-документ',
  document: 'документ',
  image: 'изображение',
  video: 'видео',
  audio: 'аудио',
  other: 'файл',
};

const resultPreviews = [
  {
    label: 'PDF',
    title: 'Документ',
    kind: 'document' as const,
    name: 'document.docx',
    size: 860_000,
    actionId: 'docx-to-pdf',
  },
  {
    label: 'DOCX',
    title: 'Редактировать',
    kind: 'pdf' as const,
    name: 'document.pdf',
    size: 2_480_000,
    actionId: 'pdf-to-docx',
  },
  {
    label: 'JPG',
    title: 'Страницы',
    kind: 'pdf' as const,
    name: 'document.pdf',
    size: 2_480_000,
    actionId: 'pdf-to-jpg',
  },
  {
    label: 'MP3',
    title: 'Аудиодорожка',
    kind: 'video' as const,
    name: 'video.mov',
    size: 18_400_000,
    actionId: 'extract-audio',
  },
];

function detectKind(file: File): FileKind {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(extension ?? '')) return 'document';
  return 'other';
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function RailIcon({ name }: { name: 'home' | 'tools' | 'files' | 'activity' | 'settings' }) {
  const paths = {
    home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7h-4v7H5a1 1 0 0 1-1-1Z" />,
    tools: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="2" />
        <rect x="14" y="4" width="6" height="6" rx="2" />
        <rect x="4" y="14" width="6" height="6" rx="2" />
        <rect x="14" y="14" width="6" height="6" rx="2" />
      </>
    ),
    files: (
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
    ),
    activity: <path d="M3 12h4l2.3-5 4.2 10 2.2-5H21" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {paths[name]}
    </svg>
  );
}

export function GlassInterfaceDemo() {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = fileInfo ? actionsByKind[fileInfo.kind] : [];
  const selected = suggestions.find((action) => action.id === selectedId) ?? suggestions[0];

  function rememberFile(file: File | undefined) {
    if (!file) return;
    const next = { name: file.name, size: file.size, kind: detectKind(file) };
    setFileInfo(next);
    setSelectedId(actionsByKind[next.kind][0]?.id ?? null);
  }

  function showResultPreview(preview: (typeof resultPreviews)[number]) {
    setFileInfo({ name: preview.name, size: preview.size, kind: preview.kind });
    setSelectedId(preview.actionId);
  }

  function resetFile() {
    setFileInfo(null);
    setSelectedId(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    rememberFile(event.dataTransfer.files[0]);
  }

  return (
    <main className="glass-demo-shell">
      <div className="glass-ambient glass-ambient-one" aria-hidden="true" />
      <div className="glass-ambient glass-ambient-two" aria-hidden="true" />

      <div className="glass-app-frame">
        <aside className="glass-rail" aria-label="Разделы демо">
          <Link className="glass-logo" href="/" aria-label="FileFlow — на главную">
            <Image src="/brand/fileflow-mark.png" alt="" width={38} height={34} priority />
          </Link>
          <nav className="glass-rail-nav" aria-label="Навигация">
            <button type="button" aria-label="Главная">
              <RailIcon name="home" />
            </button>
            <button
              className="is-active"
              type="button"
              aria-label="Инструменты"
              aria-current="page"
            >
              <RailIcon name="tools" />
            </button>
            <button type="button" aria-label="Файлы">
              <RailIcon name="files" />
            </button>
            <button type="button" aria-label="Активность">
              <RailIcon name="activity" />
            </button>
          </nav>
          <button className="glass-rail-settings" type="button" aria-label="Настройки">
            <RailIcon name="settings" />
          </button>
          <span className="glass-avatar" aria-hidden="true">
            FF
          </span>
        </aside>

        <section className="glass-stage">
          <header className="glass-topbar">
            <Link className="glass-wordmark" href="/">
              <Image src="/brand/fileflow-mark.png" alt="" width={31} height={28} priority />
              <span>FileFlow</span>
            </Link>
            <span className="glass-demo-pill">
              <i /> file in — options out
            </span>
            <Link className="glass-back-link" href="/workspace">
              Рабочая версия <span>↗</span>
            </Link>
          </header>

          <div className="glass-content">
            <section className="glass-heading" aria-labelledby="glass-demo-title">
              <p>Fast-forward для ваших файлов</p>
              <h1 id="glass-demo-title">
                Сбрось файл.
                <br />
                Выбери результат.
              </h1>
            </section>

            <section className="glass-file-entry" aria-label="Добавление файла">
              <div
                className={`glass-drop-zone${isDragging ? ' is-dragging' : ''}${fileInfo ? ' has-files' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.odt,.rtf,.txt,image/*,video/*,audio/*"
                  onChange={(event) => rememberFile(event.target.files?.[0])}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="glass-drop-button"
                  onClick={() => inputRef.current?.click()}
                >
                  <span className="glass-drop-symbol" aria-hidden="true">
                    {fileInfo ? '✓' : '↑'}
                  </span>
                  <span className="glass-drop-copy">
                    <strong>{fileInfo ? fileInfo.name : 'Перетащите любой файл'}</strong>
                    <small>
                      {fileInfo
                        ? `${kindLabels[fileInfo.kind]} · ${formatBytes(fileInfo.size)} · нажмите, чтобы заменить`
                        : 'или загрузить с вашего устройства'}
                    </small>
                  </span>
                </button>
                <div className="glass-result-showcase">
                  <div className="glass-showcase-head">
                    <span>{fileInfo ? 'Доступные действия' : 'Выберите результат'}</span>
                    {fileInfo && (
                      <button type="button" onClick={resetFile}>
                        Сбросить
                      </button>
                    )}
                  </div>
                  <div className="glass-result-grid">
                    {fileInfo
                      ? suggestions.map((action) => {
                          const active = action.id === selected?.id;
                          return (
                            <button
                              className={`glass-result-button${active ? ' is-selected' : ''}`}
                              type="button"
                              key={action.id}
                              onClick={() => setSelectedId(action.id)}
                              aria-pressed={active}
                            >
                              <strong>
                                <i>→</i>
                                {action.to}
                              </strong>
                              <small>{action.title}</small>
                            </button>
                          );
                        })
                      : resultPreviews.map((preview) => (
                          <button
                            className="glass-result-button"
                            type="button"
                            key={preview.label}
                            onClick={() => showResultPreview(preview)}
                          >
                            <strong>
                              <i>→</i>
                              {preview.label}
                            </strong>
                            <small>{preview.title}</small>
                          </button>
                        ))}
                  </div>
                </div>
                <span className="glass-privacy-note">Файл остаётся на вашем устройстве</span>
              </div>
            </section>

            {fileInfo && selected ? (
              <div className="glass-next-step" aria-live="polite">
                <span>
                  <b>{selected.title}</b>
                  <small>{fileInfo.name}</small>
                </span>
                {selected.route ? (
                  <Link href={selected.route}>
                    Продолжить <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <button type="button" disabled>
                    Скоро в FileFlow
                  </button>
                )}
              </div>
            ) : (
              <section className="glass-awaiting" aria-label="Поддерживаемые типы файлов">
                <p>
                  Загрузите файл — FileFlow уберёт лишние варианты и покажет только подходящие
                  действия.
                </p>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
