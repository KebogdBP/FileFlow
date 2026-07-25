'use client';

import {
  AudioLines,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Combine,
  Crop,
  FileArchive,
  FileImage,
  FileOutput,
  FileText,
  Film,
  Grid2X2,
  History,
  Home,
  Image as ImageIcon,
  Languages,
  Link2,
  LockKeyhole,
  Menu,
  Merge,
  Mic2,
  Moon,
  Music2,
  PanelLeftClose,
  Scissors,
  ShieldCheck,
  Sparkles,
  Split,
  Subtitles,
  Sun,
  UploadCloud,
  UserRound,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa6';
import { useFileFlowLanguage, type FileFlowLanguage } from './use-fileflow-language';
import { FileUrlInput } from './workspace/file-url-input';

type Language = FileFlowLanguage;

type ToolItem = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone: 'blue' | 'violet' | 'mint' | 'coral';
  intent?: string;
  planned?: boolean;
};

const primaryTools: ToolItem[] = [
  {
    title: 'Compress PDF',
    description: 'Reduce size, preserve readability',
    icon: FileArchive,
    tone: 'coral',
    intent: 'compress-pdf',
  },
  {
    title: 'Split PDF',
    description: 'Extract only the pages you need',
    icon: Split,
    tone: 'violet',
    intent: 'split-pdf',
  },
  {
    title: 'Merge PDFs',
    description: 'Combine up to 20 documents',
    icon: Combine,
    tone: 'blue',
    intent: 'merge-pdf',
  },
  {
    title: 'PDF to JPEG',
    description: 'Turn pages into checked images',
    icon: FileImage,
    tone: 'mint',
    intent: 'pdf-to-jpg',
  },
  {
    title: 'DOCX to PDF',
    description: 'Create a stable shareable document',
    icon: FileOutput,
    tone: 'blue',
    intent: 'docx-to-pdf',
  },
  {
    title: 'Compress video',
    description: 'Smaller MP4 for fast sharing',
    icon: Film,
    tone: 'violet',
    intent: 'compress-video',
  },
  {
    title: 'Resize video',
    description: 'Set resolution for any screen',
    icon: Crop,
    tone: 'mint',
    intent: 'resize-video',
  },
  {
    title: 'Extract audio',
    description: 'Save the soundtrack as MP3',
    icon: Music2,
    tone: 'violet',
    intent: 'extract-audio',
  },
];

const advancedTools: ToolItem[] = [
  {
    title: 'Trim video',
    description: 'Keep an exact time range',
    icon: Scissors,
    tone: 'coral',
    planned: true,
  },
  {
    title: 'Change aspect ratio',
    description: 'Landscape, portrait or square',
    icon: Crop,
    tone: 'blue',
    planned: true,
  },
  {
    title: 'Create GIF',
    description: 'Turn a clip into a compact loop',
    icon: ImageIcon,
    tone: 'violet',
    planned: true,
  },
  {
    title: 'Extract subtitles',
    description: 'Save embedded subtitle tracks',
    icon: Subtitles,
    tone: 'mint',
    planned: true,
  },
  {
    title: 'AI transcription',
    description: 'Speech to searchable text',
    icon: Mic2,
    tone: 'blue',
    planned: true,
  },
  {
    title: 'Save thumbnail',
    description: 'Export a clean preview frame',
    icon: FileImage,
    tone: 'coral',
    planned: true,
  },
  {
    title: 'Merge videos',
    description: 'Join clips into one timeline',
    icon: Merge,
    tone: 'violet',
    planned: true,
  },
  {
    title: 'Normalize audio',
    description: 'Balance loudness consistently',
    icon: AudioLines,
    tone: 'mint',
    planned: true,
  },
];

const navItems = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Tools', icon: Grid2X2, href: '#tools' },
  { label: 'Workspace', icon: WandSparkles, href: '#workspace-flow' },
  { label: 'History', icon: History, href: '/account' },
  { label: 'Privacy', icon: ShieldCheck, href: '#privacy' },
];

const copy = {
  en: {
    nav: ['Home', 'Tools', 'Workspace', 'History', 'Privacy'],
    security: 'Security',
    privacy: 'Privacy',
    signIn: 'Sign in',
    createAccount: 'Create account',
    privateWorkspace: 'Private file workspace',
    headline: 'Convert, compress and download —',
    headlineAccent: ' all in one flow.',
    lead: 'Fast tools for documents, images, video and audio. Local processing whenever possible, with transparent cloud handling when it is needed.',
    trust: ['Fast by default', 'Privacy visible', 'Results checked'],
    drop: 'Drop files here',
    dropActive: 'Release to add your file',
    fileTypes: 'PDF, DOCX, images, video and audio',
    browse: 'Browse files',
    pasteLink: 'Paste a link',
    importMedia: 'Import public media safely',
    urlPlaceholder: 'YouTube, Instagram or TikTok URL',
    startLink: 'Start with link',
    urlError: 'Paste a public YouTube, Instagram or TikTok HTTPS link.',
    smartActions: 'Smart actions',
    chooseOutcome: 'Choose an outcome',
    bestOptions: 'Best options for',
    outcomeLead: 'Start with what you need. File Flow handles the format details.',
    viewAll: 'View all tools',
    nextMedia: 'Next-generation media',
    moreWays: 'More ways to shape every file.',
    moreWaysLead: 'A focused media toolkit designed for creators, teams and repeatable workflows.',
    privacyArchitecture: 'Privacy architecture',
    privacyTitle: 'You always know where your file goes.',
    privacySteps: [
      ['Inspect locally', 'The browser checks file identity before any operation.'],
      ['Review the plan', 'Local or cloud mode is explained before processing.'],
      ['Clean up', 'Temporary cloud sources follow automatic retention rules.'],
    ],
    productFoundation: 'Product foundation',
    reliable: 'Built for reliable workflows',
    reliableLead: 'Batch processing, job status, validated outputs and account history already share one product architecture.',
    openWorkspace: 'Open workspace',
    oneWorkspace: 'One workspace',
    effortless: 'Make file work feel effortless.',
    effortlessLead: 'Start without an account, then sign in when you need history and repeatable workflows.',
    openFlow: 'Open File Flow',
    explore: 'Explore tools',
    footer: 'Private file tools with visible processing.',
    roadmap: 'Roadmap',
  },
  ru: {
    nav: ['Главная', 'Инструменты', 'Рабочая область', 'История', 'Приватность'],
    security: 'Безопасность',
    privacy: 'Приватность',
    signIn: 'Войти',
    createAccount: 'Регистрация',
    privateWorkspace: 'Приватная работа с файлами',
    headline: 'Конвертируйте, сжимайте и скачивайте —',
    headlineAccent: ' всё в одном потоке.',
    lead: 'Быстрые инструменты для документов, изображений, видео и аудио. Локальная обработка везде, где это возможно, и прозрачная работа облака там, где оно необходимо.',
    trust: ['Быстро по умолчанию', 'Приватность видна', 'Результат проверен'],
    drop: 'Перетащите файлы сюда',
    dropActive: 'Отпустите, чтобы добавить файл',
    fileTypes: 'PDF, DOCX, изображения, видео и аудио',
    browse: 'Выбрать файлы',
    pasteLink: 'Вставьте ссылку',
    importMedia: 'Безопасный импорт публичных медиа',
    urlPlaceholder: 'Ссылка YouTube, Instagram или TikTok',
    startLink: 'Начать со ссылки',
    urlError: 'Вставьте публичную HTTPS-ссылку YouTube, Instagram или TikTok.',
    smartActions: 'Умные действия',
    chooseOutcome: 'Выберите результат',
    bestOptions: 'Лучшие варианты для',
    outcomeLead: 'Скажите, что нужно получить — File Flow разберётся с форматами.',
    viewAll: 'Все инструменты',
    nextMedia: 'Медиа нового поколения',
    moreWays: 'Больше возможностей для каждого файла.',
    moreWaysLead: 'Продуманный набор медиа-инструментов для авторов, команд и повторяемых процессов.',
    privacyArchitecture: 'Архитектура приватности',
    privacyTitle: 'Вы всегда знаете, куда отправляется файл.',
    privacySteps: [
      ['Локальная проверка', 'Браузер проверяет тип файла до начала операции.'],
      ['Просмотр плана', 'Локальный или облачный режим объясняется заранее.'],
      ['Очистка', 'Временные облачные файлы автоматически удаляются.'],
    ],
    productFoundation: 'Основа продукта',
    reliable: 'Создано для надёжных процессов',
    reliableLead: 'Пакетная обработка, статусы задач, проверка результатов и история аккаунта работают в одной архитектуре.',
    openWorkspace: 'Открыть рабочую область',
    oneWorkspace: 'Одна рабочая область',
    effortless: 'Работать с файлами стало легко.',
    effortlessLead: 'Начните без аккаунта, а затем войдите, когда понадобится история и повторяемые процессы.',
    openFlow: 'Открыть FileFlow',
    explore: 'Смотреть инструменты',
    footer: 'Приватные файловые инструменты с прозрачной обработкой.',
    roadmap: 'В планах',
  },
  es: {
    nav: ['Inicio', 'Herramientas', 'Espacio de trabajo', 'Historial', 'Privacidad'],
    security: 'Seguridad',
    privacy: 'Privacidad',
    signIn: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
    privateWorkspace: 'Espacio de archivos privado',
    headline: 'Convierte, comprime y descarga —',
    headlineAccent: ' todo en un solo flujo.',
    lead: 'Herramientas rápidas para documentos, imágenes, vídeo y audio. Procesamiento local cuando sea posible y nube transparente cuando sea necesaria.',
    trust: ['Rápido por defecto', 'Privacidad visible', 'Resultados verificados'],
    drop: 'Suelta los archivos aquí',
    dropActive: 'Suelta para añadir el archivo',
    fileTypes: 'PDF, DOCX, imágenes, vídeo y audio',
    browse: 'Elegir archivos',
    pasteLink: 'Pega un enlace',
    importMedia: 'Importa medios públicos con seguridad',
    urlPlaceholder: 'URL de YouTube, Instagram o TikTok',
    startLink: 'Empezar con enlace',
    urlError: 'Pega un enlace HTTPS público de YouTube, Instagram o TikTok.',
    smartActions: 'Acciones inteligentes',
    chooseOutcome: 'Elige un resultado',
    bestOptions: 'Mejores opciones para',
    outcomeLead: 'Elige lo que necesitas. File Flow se ocupa de los formatos.',
    viewAll: 'Ver herramientas',
    nextMedia: 'Medios de nueva generación',
    moreWays: 'Más formas de transformar cada archivo.',
    moreWaysLead: 'Un conjunto de herramientas para creadores, equipos y flujos repetibles.',
    privacyArchitecture: 'Arquitectura de privacidad',
    privacyTitle: 'Siempre sabes adónde va tu archivo.',
    privacySteps: [
      ['Inspección local', 'El navegador verifica el archivo antes de cualquier operación.'],
      ['Revisar el plan', 'El modo local o en la nube se explica antes de procesar.'],
      ['Limpieza', 'Los archivos temporales en la nube se eliminan automáticamente.'],
    ],
    productFoundation: 'Base del producto',
    reliable: 'Creado para flujos fiables',
    reliableLead: 'Procesamiento por lotes, estados, resultados verificados e historial comparten una arquitectura.',
    openWorkspace: 'Abrir espacio de trabajo',
    oneWorkspace: 'Un espacio de trabajo',
    effortless: 'Trabajar con archivos, sin esfuerzo.',
    effortlessLead: 'Empieza sin cuenta e inicia sesión cuando necesites historial y flujos repetibles.',
    openFlow: 'Abrir FileFlow',
    explore: 'Explorar herramientas',
    footer: 'Herramientas privadas con procesamiento visible.',
    roadmap: 'Próximamente',
  },
} as const;

const toolTranslations: Record<Exclude<Language, 'en'>, Record<string, [string, string]>> = {
  ru: {
    'Compress PDF': ['Сжать PDF', 'Уменьшить размер, сохранить читаемость'],
    'Split PDF': ['Разделить PDF', 'Извлечь только нужные страницы'],
    'Merge PDFs': ['Объединить PDF', 'Соединить до 20 документов'],
    'PDF to JPEG': ['PDF в JPEG', 'Превратить страницы в изображения'],
    'DOCX to PDF': ['DOCX в PDF', 'Создать стабильный документ для отправки'],
    'Compress video': ['Сжать видео', 'Компактный MP4 для быстрой отправки'],
    'Resize video': ['Изменить размер видео', 'Настроить разрешение для экрана'],
    'Extract audio': ['Извлечь аудио', 'Сохранить звуковую дорожку в MP3'],
    'Trim video': ['Обрезать видео', 'Оставить точный отрезок времени'],
    'Change aspect ratio': ['Изменить формат кадра', 'Горизонтальный, вертикальный или квадрат'],
    'Create GIF': ['Создать GIF', 'Превратить фрагмент в компактную анимацию'],
    'Extract subtitles': ['Извлечь субтитры', 'Сохранить встроенные дорожки субтитров'],
    'AI transcription': ['AI-транскрибация', 'Преобразовать речь в текст'],
    'Save thumbnail': ['Сохранить превью', 'Экспортировать чистый кадр'],
    'Merge videos': ['Объединить видео', 'Соединить ролики в одну дорожку'],
    'Normalize audio': ['Нормализовать аудио', 'Выровнять громкость'],
  },
  es: {
    'Compress PDF': ['Comprimir PDF', 'Reduce el tamaño y conserva la legibilidad'],
    'Split PDF': ['Dividir PDF', 'Extrae solo las páginas necesarias'],
    'Merge PDFs': ['Unir PDFs', 'Combina hasta 20 documentos'],
    'PDF to JPEG': ['PDF a JPEG', 'Convierte páginas en imágenes'],
    'DOCX to PDF': ['DOCX a PDF', 'Crea un documento estable para compartir'],
    'Compress video': ['Comprimir vídeo', 'MP4 más pequeño para compartir'],
    'Resize video': ['Redimensionar vídeo', 'Ajusta la resolución a cualquier pantalla'],
    'Extract audio': ['Extraer audio', 'Guarda la pista de sonido como MP3'],
    'Trim video': ['Recortar vídeo', 'Conserva un intervalo exacto'],
    'Change aspect ratio': ['Cambiar proporción', 'Horizontal, vertical o cuadrado'],
    'Create GIF': ['Crear GIF', 'Convierte un clip en un bucle compacto'],
    'Extract subtitles': ['Extraer subtítulos', 'Guarda las pistas incrustadas'],
    'AI transcription': ['Transcripción con IA', 'Convierte voz en texto'],
    'Save thumbnail': ['Guardar miniatura', 'Exporta un fotograma limpio'],
    'Merge videos': ['Unir vídeos', 'Combina clips en una línea de tiempo'],
    'Normalize audio': ['Normalizar audio', 'Equilibra el volumen'],
  },
};

const localizedCopy = {
  en: {
    nav: ['Home', 'Tools', 'Workspace', 'History', 'Privacy'],
    security: 'Security',
    privacy: 'Privacy',
    signIn: 'Sign in',
    createAccount: 'Create account',
    eyebrow: 'Private file workspace',
    headline: 'Convert, compress and download —',
    headlineAccent: ' all in one flow.',
    lead: 'Fast tools for documents, images, video and audio. Local processing whenever possible, with transparent cloud handling when it is needed.',
    trust: ['Fast by default', 'Privacy visible', 'Results checked'],
    drop: 'Drop files here',
    dropActive: 'Release to add your file',
    fileTypes: 'PDF, DOCX, images, video and audio',
    browse: 'Browse files',
    pasteLink: 'Paste a link',
    importMedia: 'Import public media safely',
    urlPlaceholder: 'YouTube, Instagram or TikTok URL',
    startLink: 'Start with link',
    urlError: 'Paste a public YouTube, Instagram or TikTok HTTPS link.',
    smartActions: 'Smart actions',
    chooseOutcome: 'Choose an outcome',
    bestOptions: 'Best options for',
    outcomeLead: 'Start with what you need. FileFlow handles the format details.',
    viewAll: 'View all tools',
    nextMedia: 'Next-generation media',
    moreWays: 'More ways to shape every file.',
    moreWaysLead: 'A focused media toolkit designed for creators, teams and repeatable workflows.',
    privacyArchitecture: 'Privacy architecture',
    privacyTitle: 'You always know where your file goes.',
    privacySteps: [
      ['Inspect locally', 'The browser checks file identity before any operation.'],
      ['Review the plan', 'Local or cloud mode is explained before processing.'],
      ['Clean up', 'Temporary cloud sources follow automatic retention rules.'],
    ],
    securityTitle: 'Security at FileFlow',
    securityLead: 'Layered protection for cloud operations, while local processing avoids upload entirely.',
    securityItems: ['Quarantine and malware scanning', 'Isolated processing environments', 'Short-lived access to temporary files'],
    privacyDetailTitle: 'Privacy you can verify',
    privacyDetailLead: 'Local files stay in your browser. Cloud processing is explained before it starts and follows automatic retention rules.',
    privacyItems: ['Local tools work without an account', 'No filenames or contents in analytics', 'Sessions can be revoked at any time'],
    termsTitle: 'Clear beta terms',
    termsLead: 'You keep ownership of your files and control what you submit. Keep independent copies of important files.',
    termsItems: ['Your files remain yours', 'No malware or rights violations', 'Beta features may change'],
    footer: 'Private file tools with visible processing.',
    terms: 'Terms',
    roadmap: 'Roadmap',
  },
  ru: {
    nav: ['\u0413\u043b\u0430\u0432\u043d\u0430\u044f', '\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b', '\u0420\u0430\u0431\u043e\u0447\u0430\u044f \u043e\u0431\u043b\u0430\u0441\u0442\u044c', '\u0418\u0441\u0442\u043e\u0440\u0438\u044f', '\u041f\u0440\u0438\u0432\u0430\u0442\u043d\u043e\u0441\u0442\u044c'],
    security: '\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c',
    privacy: '\u041f\u0440\u0438\u0432\u0430\u0442\u043d\u043e\u0441\u0442\u044c',
    signIn: '\u0412\u043e\u0439\u0442\u0438',
    createAccount: '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f',
    eyebrow: '\u041f\u0440\u0438\u0432\u0430\u0442\u043d\u0430\u044f \u0440\u0430\u0431\u043e\u0442\u0430 \u0441 \u0444\u0430\u0439\u043b\u0430\u043c\u0438',
    headline: '\u041a\u043e\u043d\u0432\u0435\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435, \u0441\u0436\u0438\u043c\u0430\u0439\u0442\u0435 \u0438 \u0441\u043a\u0430\u0447\u0438\u0432\u0430\u0439\u0442\u0435 —',
    headlineAccent: ' \u0432\u0441\u0451 \u0432 \u043e\u0434\u043d\u043e\u043c \u043f\u043e\u0442\u043e\u043a\u0435.',
    lead: '\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b \u0434\u043b\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432, \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439, \u0432\u0438\u0434\u0435\u043e \u0438 \u0430\u0443\u0434\u0438\u043e. \u041b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u0432\u0435\u0437\u0434\u0435, \u0433\u0434\u0435 \u044d\u0442\u043e \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e.',
    trust: ['\u0411\u044b\u0441\u0442\u0440\u043e \u043f\u043e \u0443\u043c\u043e\u043b\u0447\u0430\u043d\u0438\u044e', '\u041f\u0440\u0438\u0432\u0430\u0442\u043d\u043e\u0441\u0442\u044c \u0432\u0438\u0434\u043d\u0430', '\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u0435\u043d'],
    drop: '\u041f\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0444\u0430\u0439\u043b\u044b \u0441\u044e\u0434\u0430',
    dropActive: '\u041e\u0442\u043f\u0443\u0441\u0442\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0444\u0430\u0439\u043b',
    fileTypes: 'PDF, DOCX, \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f, \u0432\u0438\u0434\u0435\u043e \u0438 \u0430\u0443\u0434\u0438\u043e',
    browse: '\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b\u044b',
    pasteLink: '\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443',
    importMedia: '\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0438\u043c\u043f\u043e\u0440\u0442 \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0445 \u043c\u0435\u0434\u0438\u0430',
    urlPlaceholder: '\u0421\u0441\u044b\u043b\u043a\u0430 YouTube, Instagram \u0438\u043b\u0438 TikTok',
    startLink: '\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u043e \u0441\u0441\u044b\u043b\u043a\u0438',
    urlError: '\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u0443\u044e HTTPS-\u0441\u0441\u044b\u043b\u043a\u0443 YouTube, Instagram \u0438\u043b\u0438 TikTok.',
    smartActions: '\u0423\u043c\u043d\u044b\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f',
    chooseOutcome: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442',
    bestOptions: '\u041b\u0443\u0447\u0448\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b \u0434\u043b\u044f',
    outcomeLead: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 — FileFlow \u0440\u0430\u0437\u0431\u0435\u0440\u0451\u0442\u0441\u044f \u0441 \u0444\u043e\u0440\u043c\u0430\u0442\u043e\u043c.',
    viewAll: '\u0412\u0441\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b',
    nextMedia: '\u041c\u0435\u0434\u0438\u0430 \u043d\u043e\u0432\u043e\u0433\u043e \u043f\u043e\u043a\u043e\u043b\u0435\u043d\u0438\u044f',
    moreWays: '\u0411\u043e\u043b\u044c\u0448\u0435 \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0435\u0439 \u0434\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u0444\u0430\u0439\u043b\u0430.',
    moreWaysLead: '\u041d\u0430\u0431\u043e\u0440 \u043c\u0435\u0434\u0438\u0430-\u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u043e\u0432 \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u0440\u043e\u0432, \u043a\u043e\u043c\u0430\u043d\u0434 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0435\u043c\u044b\u0445 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432.',
    privacyArchitecture: 'Архитектура приватности',
    privacyTitle: 'Вы всегда знаете, куда отправляется файл.',
    privacySteps: [
      ['Локальная проверка', 'Браузер проверяет тип файла перед любой операцией.'],
      ['Проверка плана', 'Локальный или облачный режим объясняется до обработки.'],
      ['Автоочистка', 'Временные облачные файлы удаляются по правилам хранения.'],
    ],
    securityTitle: 'Безопасность FileFlow',
    securityLead: 'Многоуровневая защита облачных операций, а локальная обработка полностью исключает загрузку.',
    securityItems: ['Карантин и проверка на вредоносное ПО', 'Изолированные среды обработки', 'Кратковременный доступ к временным файлам'],
    privacyDetailTitle: 'Проверяемая приватность',
    privacyDetailLead: 'Локальные файлы остаются в браузере. Облачная обработка объясняется заранее и подчиняется автоочистке.',
    privacyItems: ['Локальные инструменты без аккаунта', 'Без имён и содержимого файлов в аналитике', 'Сессию можно отозвать в любой момент'],
    termsTitle: 'Понятные условия бета-версии',
    termsLead: 'Вы сохраняете права на файлы и решаете, что отправлять. Храните отдельные копии важных материалов.',
    termsItems: ['Ваши файлы остаются вашими', 'Запрещены вредоносные файлы и нарушение прав', 'Бета-функции могут изменяться'],
    footer: 'Приватные инструменты с прозрачной обработкой.',
    terms: 'Условия',
    roadmap: '\u0412 \u043f\u043b\u0430\u043d\u0430\u0445',
  },
  es: {
    nav: ['Inicio', 'Herramientas', 'Espacio de trabajo', 'Historial', 'Privacidad'],
    security: 'Seguridad',
    privacy: 'Privacidad',
    signIn: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
    eyebrow: 'Espacio de archivos privado',
    headline: 'Convierte, comprime y descarga —',
    headlineAccent: ' todo en un solo flujo.',
    lead: 'Herramientas rápidas para documentos, imágenes, vídeo y audio. Procesamiento local cuando sea posible y nube transparente cuando sea necesaria.',
    trust: ['Rápido por defecto', 'Privacidad visible', 'Resultados verificados'],
    drop: 'Suelta los archivos aquí',
    dropActive: 'Suelta para añadir el archivo',
    fileTypes: 'PDF, DOCX, imágenes, vídeo y audio',
    browse: 'Elegir archivos',
    pasteLink: 'Pega un enlace',
    importMedia: 'Importa medios públicos con seguridad',
    urlPlaceholder: 'URL de YouTube, Instagram o TikTok',
    startLink: 'Empezar con enlace',
    urlError: 'Pega un enlace HTTPS público de YouTube, Instagram o TikTok.',
    smartActions: 'Acciones inteligentes',
    chooseOutcome: 'Elige un resultado',
    bestOptions: 'Mejores opciones para',
    outcomeLead: 'Elige el resultado. FileFlow se ocupa de los formatos.',
    viewAll: 'Ver herramientas',
    nextMedia: 'Medios de nueva generación',
    moreWays: 'Más formas de transformar cada archivo.',
    moreWaysLead: 'Herramientas para creadores, equipos y flujos repetibles.',
    privacyArchitecture: 'Arquitectura de privacidad',
    privacyTitle: 'Siempre sabes adónde va tu archivo.',
    privacySteps: [
      ['Inspección local', 'El navegador verifica el tipo de archivo antes de cualquier operación.'],
      ['Revisar el plan', 'El modo local o en la nube se explica antes de procesar.'],
      ['Limpieza', 'Los archivos temporales siguen reglas de eliminación automática.'],
    ],
    securityTitle: 'Seguridad en FileFlow',
    securityLead: 'Protección por capas para operaciones en la nube; el procesamiento local evita la carga por completo.',
    securityItems: ['Cuarentena y análisis de malware', 'Entornos de procesamiento aislados', 'Acceso breve a archivos temporales'],
    privacyDetailTitle: 'Privacidad verificable',
    privacyDetailLead: 'Los archivos locales permanecen en el navegador. El uso de la nube se explica antes y sigue reglas de retención.',
    privacyItems: ['Herramientas locales sin cuenta', 'Analítica sin nombres ni contenido', 'La sesión puede revocarse en cualquier momento'],
    termsTitle: 'Términos beta claros',
    termsLead: 'Conservas la propiedad de tus archivos y decides qué enviar. Mantén copias independientes de los archivos importantes.',
    termsItems: ['Tus archivos siguen siendo tuyos', 'Sin malware ni infracciones de derechos', 'Las funciones beta pueden cambiar'],
    footer: 'Herramientas privadas con procesamiento visible.',
    terms: 'Términos',
    roadmap: 'Próximamente',
  },
} as const;

void copy;

function detectSuggestedIntents(name: string): ToolItem[] {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return primaryTools.slice(0, 4);
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension ?? '')) {
    return primaryTools.filter((tool) =>
      ['compress-video', 'resize-video', 'extract-audio'].includes(tool.intent ?? ''),
    );
  }
  if (['doc', 'docx'].includes(extension ?? '')) {
    return primaryTools.filter((tool) => tool.intent === 'docx-to-pdf');
  }
  return primaryTools;
}

export function GlassHome() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileNav, setMobileNav] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const { language, setLanguage } = useFileFlowLanguage();
  const [userProfile, setUserProfile] = useState<{ displayName: string } | null>(null);
  const t = localizedCopy[language];
  const suggestedTools = useMemo(
    () => (selectedFile ? detectSuggestedIntents(selectedFile.name) : primaryTools),
    [selectedFile],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem('fileflow-theme');
    const darkPreferred = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved === 'dark' || (!saved && darkPreferred) ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('fileflow-theme', theme);
  }, [theme]);

  useEffect(() => {
    const readProfile = () => {
      try {
        const saved = window.localStorage.getItem('fileflow-user-profile');
        setUserProfile(saved ? (JSON.parse(saved) as { displayName: string }) : null);
      } catch {
        setUserProfile(null);
      }
    };
    readProfile();
    window.addEventListener('storage', readProfile);
    window.addEventListener('fileflow-profile-change', readProfile);
    return () => {
      window.removeEventListener('storage', readProfile);
      window.removeEventListener('fileflow-profile-change', readProfile);
    };
  }, []);

  function acceptFile(file?: File) {
    if (!file) return;
    setSelectedFile(file);
    window.setTimeout(() => {
      document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 220);
  }

  function submitUrl(event: React.FormEvent) {
    event.preventDefault();
    try {
      const parsed = new URL(sourceUrl);
      const supported = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com'].some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
      );
      if (!supported || parsed.protocol !== 'https:') throw new Error();
      setUrlError('');
      window.location.assign(`/workspace?source=${encodeURIComponent(sourceUrl)}`);
    } catch {
      setUrlError(t.urlError);
    }
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.34, ease: 'easeOut' }}>
      <div className="ff-home">
        <div className="ff-ambient ff-ambient-one" />
        <div className="ff-ambient ff-ambient-two" />

        <aside className="ff-sidebar glass-panel" aria-label="Primary navigation">
          <Link className="ff-logo" href="/" aria-label="File Flow home">
            <Image className="ff-logo-mark" src="/brand/fileflow-mark.png" alt="" width={34} height={30} priority />
            <strong>FileFlow</strong>
          </Link>
          <nav>
            {navItems.map(({ label, icon: Icon, href }, index) => (
              <Link className={index === 0 ? 'active' : ''} href={href} key={label}>
                <Icon size={21} />
                <span>{t.nav[index]}</span>
              </Link>
            ))}
          </nav>
          <div className="ff-sidebar-bottom">
            <Link className="ff-user-avatar" href="/account" aria-label={userProfile?.displayName ?? t.signIn}>
              {userProfile ? (
                <span aria-hidden="true">{userProfile.displayName.slice(0, 2).toUpperCase()}</span>
              ) : (
                <UserRound size={19} />
              )}
              <span>{userProfile?.displayName ?? t.signIn}</span>
            </Link>
            <Link href="#security">
              <LockKeyhole size={18} />
              <span>{t.security}</span>
            </Link>
            <Link href="#privacy">
              <BookOpen size={18} />
              <span>{t.privacy}</span>
            </Link>
          </div>
        </aside>

        <main className="ff-main">
          <header className="ff-topbar">
            <button
              className="ff-mobile-menu glass-button"
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <div className="ff-top-actions">
              <Link className="ff-sign-in" href="/account">
                {t.signIn}
              </Link>
              <Link className="ff-primary-button compact" href="/account">
                {t.createAccount}
              </Link>
              <div className="ff-theme-switch glass-panel" aria-label="Color theme">
                <Sun size={18} aria-hidden="true" />
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label="Use dark theme"
                  onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
                >
                  <motion.span layout />
                </button>
                <Moon size={18} aria-hidden="true" />
              </div>
              <label className="ff-language-switch glass-panel" aria-label="Language">
                <Languages size={17} aria-hidden="true" />
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  aria-label="Select language"
                >
                  <option value="ru">RU</option>
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
              </label>
            </div>
          </header>

          <section className="ff-hero" aria-labelledby="home-title">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="ff-hero-copy"
            >
              <span className="ff-eyebrow">
                <Sparkles size={15} />
                {t.eyebrow}
              </span>
              <h1 id="home-title">
                {t.headline}
                <span>{t.headlineAccent}</span>
              </h1>
              <p>
                {t.lead}
              </p>
              <div className="ff-trust-row">
                <span>
                  <Zap size={15} /> {t.trust[0]}
                </span>
                <span>
                  <ShieldCheck size={15} /> {t.trust[1]}
                </span>
                <span>
                  <BadgeCheck size={15} /> {t.trust[2]}
                </span>
              </div>
            </motion.div>

            <section
              className="ff-unified-workspace"
              id="workspace-flow"
              aria-label="Unified file workspace"
            >
              <FileUrlInput language={language} />
            </section>

            <div className="ff-intake-grid">
              <motion.section
                className="ff-drop glass-panel"
                data-dragging={dragging || undefined}
                whileHover={{ y: -3 }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  acceptFile(event.dataTransfer.files[0]);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  onChange={(event) => acceptFile(event.target.files?.[0])}
                />
                <motion.div
                  className="ff-upload-orb"
                  animate={{ y: dragging ? -8 : [0, -5, 0] }}
                  transition={{ duration: dragging ? 0.2 : 4, repeat: dragging ? 0 : Infinity }}
                >
                  <UploadCloud size={38} strokeWidth={1.8} />
                </motion.div>
                <strong>{dragging ? t.dropActive : t.drop}</strong>
                <span>{t.fileTypes}</span>
                <button
                  className="ff-primary-button"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  {t.browse}
                </button>
                <AnimatePresence>
                  {selectedFile ? (
                    <motion.div
                      className="ff-selected-file"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <FileText size={17} />
                      <span>{selectedFile.name}</span>
                      <button
                        type="button"
                        aria-label="Remove selected file"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X size={15} />
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.section>

              <motion.section className="ff-link-card glass-panel" whileHover={{ y: -3 }}>
                <div className="ff-card-heading">
                  <div className="ff-icon-tile blue">
                    <Link2 size={22} />
                  </div>
                  <div>
                    <h2>{t.pasteLink}</h2>
                    <p>{t.importMedia}</p>
                  </div>
                </div>
                <form onSubmit={submitUrl} noValidate>
                  <label className="sr-only" htmlFor="media-url">
                    Public media URL
                  </label>
                  <div className="ff-url-input">
                    <Link2 size={18} />
                    <input
                      id="media-url"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      placeholder={t.urlPlaceholder}
                      value={sourceUrl}
                      aria-invalid={Boolean(urlError)}
                      onChange={(event) => setSourceUrl(event.target.value)}
                    />
                  </div>
                  <div className="ff-platforms" aria-label="Supported link sources">
                    <span className="youtube" role="img" aria-label="YouTube" title="YouTube">
                      <FaYoutube />
                    </span>
                    <span className="instagram" role="img" aria-label="Instagram" title="Instagram">
                      <FaInstagram />
                    </span>
                    <span className="tiktok" role="img" aria-label="TikTok" title="TikTok">
                      <FaTiktok />
                    </span>
                  </div>
                  <button className="ff-primary-button wide" type="submit">
                    {t.startLink} <ChevronRight size={18} />
                  </button>
                  <p className="ff-form-error" aria-live="polite">
                    {urlError}
                  </p>
                </form>
              </motion.section>
            </div>
          </section>

          <section className="ff-tools-section" id="tools" aria-labelledby="tools-title">
            <div className="ff-section-heading">
              <div>
                <span className="ff-eyebrow">
                  <Grid2X2 size={15} /> {t.smartActions}
                </span>
                <h2 id="tools-title">
                  {selectedFile ? `${t.bestOptions} ${selectedFile.name}` : t.chooseOutcome}
                </h2>
                <p>{t.outcomeLead}</p>
              </div>
            </div>
            <motion.div className="ff-tool-grid" layout>
              {suggestedTools.map((tool, index) => (
                <ToolCard tool={tool} key={tool.title} index={index} language={language} />
              ))}
            </motion.div>
          </section>

          <section className="ff-advanced-section" aria-labelledby="advanced-title">
            <div className="ff-section-heading">
              <div>
                <span className="ff-eyebrow">
                  <WandSparkles size={15} /> {t.nextMedia}
                </span>
                <h2 id="advanced-title">{t.moreWays}</h2>
                <p>{t.moreWaysLead}</p>
              </div>
            </div>
            <div className="ff-advanced-grid">
              {advancedTools.map((tool, index) => (
                <ToolCard tool={tool} key={tool.title} index={index} language={language} />
              ))}
            </div>
          </section>

          <section className="ff-status-grid" id="privacy">
            <div className="ff-privacy-card glass-panel">
              <div className="ff-card-heading">
                <div className="ff-icon-tile mint">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <span className="ff-status-pill">{t.privacyArchitecture}</span>
                  <h2>{t.privacyTitle}</h2>
                </div>
              </div>
              <div className="ff-privacy-flow">
                {t.privacySteps.map(([title, description], index) => (
                  <div key={title}>
                    <span>0{index + 1}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ff-legal-grid" aria-label="Security, privacy and terms">
            <article className="ff-legal-card glass-panel" id="security">
              <LockKeyhole size={26} />
              <h2>{t.securityTitle}</h2>
              <p>{t.securityLead}</p>
              <ul>{t.securityItems.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="ff-legal-card glass-panel">
              <ShieldCheck size={26} />
              <h2>{t.privacyDetailTitle}</h2>
              <p>{t.privacyDetailLead}</p>
              <ul>{t.privacyItems.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="ff-legal-card glass-panel" id="terms">
              <BookOpen size={26} />
              <h2>{t.termsTitle}</h2>
              <p>{t.termsLead}</p>
              <ul>{t.termsItems.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          </section>

          <footer className="ff-footer">
            <Link className="ff-logo" href="/">
              <Image className="ff-logo-mark" src="/brand/fileflow-mark.png" alt="" width={34} height={30} />
              <strong>FileFlow</strong>
            </Link>
            <p>{t.footer}</p>
            <nav aria-label="Footer links">
              <Link href="#privacy">{t.privacy}</Link>
              <Link href="#security">{t.security}</Link>
              <Link href="#terms">{t.terms}</Link>
              <Link href="#tools">Tools</Link>
            </nav>
          </footer>
        </main>

        <AnimatePresence>
          {mobileNav ? (
            <motion.div
              className="ff-mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
            >
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="ff-mobile-heading">
                  <span className="ff-logo">
                    <Image className="ff-logo-mark" src="/brand/fileflow-mark.png" alt="" width={34} height={30} />
                    <strong>FileFlow</strong>
                  </span>
                  <button type="button" onClick={() => setMobileNav(false)} aria-label="Close menu">
                    <PanelLeftClose size={22} />
                  </button>
                </div>
                <nav>
                  {navItems.map(({ label, icon: Icon, href }, index) => (
                    <Link href={href} key={label} onClick={() => setMobileNav(false)}>
                      <Icon size={20} /> {t.nav[index]}
                    </Link>
                  ))}
                </nav>
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function ToolCard({ tool, index, language }: { tool: ToolItem; index: number; language: Language }) {
  const Icon = tool.icon;
  const href = '#workspace-flow';
  const translated =
    language === 'en'
      ? [tool.title, tool.description]
      : (toolTranslations[language][tool.title] ?? [tool.title, tool.description]);
  return (
    <motion.article
      className="ff-tool-card glass-panel"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: Math.min(index * 0.035, 0.18) }}
      whileHover={{ y: -5, scale: 1.01 }}
    >
      <div className={`ff-icon-tile ${tool.tone}`}>
        <Icon size={23} strokeWidth={1.8} />
      </div>
      <div>
        <div className="ff-tool-title">
          <h3>{translated[0]}</h3>
          {tool.planned ? <span>{localizedCopy[language].roadmap}</span> : null}
        </div>
        <p>{translated[1]}</p>
      </div>
      <Link href={href} aria-label={`${translated[0]}: ${tool.planned ? 'view roadmap' : 'open tool'}`}>
        <ChevronRight size={18} />
      </Link>
    </motion.article>
  );
}
