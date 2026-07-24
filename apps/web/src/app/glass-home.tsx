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
  Gauge,
  Grid2X2,
  History,
  Home,
  Image as ImageIcon,
  Link2,
  LockKeyhole,
  Menu,
  Merge,
  Mic2,
  Moon,
  Music2,
  PanelLeftClose,
  Play,
  Scissors,
  ShieldCheck,
  Sparkles,
  Split,
  Subtitles,
  Sun,
  UploadCloud,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  { label: 'Workspace', icon: WandSparkles, href: '/workspace' },
  { label: 'History', icon: History, href: '/account' },
  { label: 'Privacy', icon: ShieldCheck, href: '#privacy' },
];

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
      setUrlError('Paste a public YouTube, Instagram or TikTok HTTPS link.');
    }
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.34, ease: 'easeOut' }}>
      <div className="ff-home">
        <div className="ff-ambient ff-ambient-one" />
        <div className="ff-ambient ff-ambient-two" />

        <aside className="ff-sidebar glass-panel" aria-label="Primary navigation">
          <Link className="ff-logo" href="/" aria-label="File Flow home">
            <span aria-hidden="true">&gt;&gt;</span>
            <strong>File Flow</strong>
          </Link>
          <nav>
            {navItems.map(({ label, icon: Icon, href }, index) => (
              <Link className={index === 0 ? 'active' : ''} href={href} key={label}>
                <Icon size={21} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="ff-sidebar-bottom">
            <Link href="/legal/security">
              <LockKeyhole size={18} />
              <span>Security</span>
            </Link>
            <Link href="/legal/privacy">
              <BookOpen size={18} />
              <span>Privacy</span>
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
                Sign in
              </Link>
              <Link className="ff-primary-button compact" href="/account">
                Create account
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
                Private file workspace
              </span>
              <h1 id="home-title">
                Convert, compress and download —
                <span> all in one flow.</span>
              </h1>
              <p>
                Fast tools for documents, images, video and audio. Local processing whenever
                possible, with transparent cloud handling when it is needed.
              </p>
              <div className="ff-trust-row">
                <span>
                  <Zap size={15} /> Fast by default
                </span>
                <span>
                  <ShieldCheck size={15} /> Privacy visible
                </span>
                <span>
                  <BadgeCheck size={15} /> Results checked
                </span>
              </div>
            </motion.div>

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
                <strong>{dragging ? 'Release to add your file' : 'Drop files here'}</strong>
                <span>PDF, DOCX, images, video and audio</span>
                <button
                  className="ff-primary-button"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                >
                  Browse files
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
                    <h2>Paste a link</h2>
                    <p>Import public media safely</p>
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
                      placeholder="YouTube, Instagram or TikTok URL"
                      value={sourceUrl}
                      aria-invalid={Boolean(urlError)}
                      onChange={(event) => setSourceUrl(event.target.value)}
                    />
                  </div>
                  <div className="ff-platforms" aria-label="Supported link sources">
                    <span className="youtube">
                      <Play size={14} fill="currentColor" /> YouTube
                    </span>
                    <span className="instagram">
                      <ImageIcon size={14} /> Instagram
                    </span>
                    <span className="tiktok">
                      <Music2 size={14} /> TikTok
                    </span>
                  </div>
                  <button className="ff-primary-button wide" type="submit">
                    Start with link <ChevronRight size={18} />
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
                  <Grid2X2 size={15} /> Smart actions
                </span>
                <h2 id="tools-title">
                  {selectedFile ? `Best options for ${selectedFile.name}` : 'Choose an outcome'}
                </h2>
                <p>Start with what you need. File Flow handles the format details.</p>
              </div>
              <Link href="/tools">
                View all tools <ChevronRight size={17} />
              </Link>
            </div>
            <motion.div className="ff-tool-grid" layout>
              {suggestedTools.map((tool, index) => (
                <ToolCard tool={tool} key={tool.title} index={index} />
              ))}
            </motion.div>
          </section>

          <section className="ff-advanced-section" aria-labelledby="advanced-title">
            <div className="ff-section-heading">
              <div>
                <span className="ff-eyebrow">
                  <WandSparkles size={15} /> Next-generation media
                </span>
                <h2 id="advanced-title">More ways to shape every file.</h2>
                <p>
                  A focused media toolkit designed for creators, teams and repeatable workflows.
                </p>
              </div>
            </div>
            <div className="ff-advanced-grid">
              {advancedTools.map((tool, index) => (
                <ToolCard tool={tool} key={tool.title} index={index} />
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
                  <span className="ff-status-pill">Privacy architecture</span>
                  <h2>You always know where your file goes.</h2>
                </div>
              </div>
              <div className="ff-privacy-flow">
                <div>
                  <span>01</span>
                  <strong>Inspect locally</strong>
                  <p>The browser checks file identity before any operation.</p>
                </div>
                <div>
                  <span>02</span>
                  <strong>Review the plan</strong>
                  <p>Local or cloud mode is explained before processing.</p>
                </div>
                <div>
                  <span>03</span>
                  <strong>Clean up</strong>
                  <p>Temporary cloud sources follow automatic retention rules.</p>
                </div>
              </div>
            </div>
            <div className="ff-update-card glass-panel">
              <div className="ff-speed-dial">
                <Gauge size={42} />
                <span />
              </div>
              <span className="ff-status-pill">Product foundation</span>
              <h2>Built for reliable workflows</h2>
              <p>
                Batch processing, job status, validated outputs and account history already share
                one product architecture.
              </p>
              <Link href="/workspace">
                Open workspace <ChevronRight size={17} />
              </Link>
            </div>
          </section>

          <section className="ff-saas-cta glass-panel" aria-labelledby="cta-title">
            <div>
              <span className="ff-eyebrow">
                <Sparkles size={15} /> One workspace
              </span>
              <h2 id="cta-title">Make file work feel effortless.</h2>
              <p>
                Start without an account, then sign in when you need history and repeatable
                workflows.
              </p>
            </div>
            <div className="ff-cta-actions">
              <Link className="ff-primary-button" href="/workspace">
                Open File Flow <ChevronRight size={18} />
              </Link>
              <Link className="glass-button" href="/tools">
                Explore tools
              </Link>
            </div>
          </section>

          <footer className="ff-footer">
            <Link className="ff-logo" href="/">
              <span aria-hidden="true">&gt;&gt;</span>
              <strong>File Flow</strong>
            </Link>
            <p>Private file tools with visible processing.</p>
            <nav aria-label="Footer links">
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/security">Security</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/tools">Tools</Link>
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
                    <span>&gt;&gt;</span>
                    <strong>File Flow</strong>
                  </span>
                  <button type="button" onClick={() => setMobileNav(false)} aria-label="Close menu">
                    <PanelLeftClose size={22} />
                  </button>
                </div>
                <nav>
                  {navItems.map(({ label, icon: Icon, href }) => (
                    <Link href={href} key={label} onClick={() => setMobileNav(false)}>
                      <Icon size={20} /> {label}
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

function ToolCard({ tool, index }: { tool: ToolItem; index: number }) {
  const Icon = tool.icon;
  const href = tool.intent ? `/workspace?intent=${tool.intent}` : '/tools';
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
          <h3>{tool.title}</h3>
          {tool.planned ? <span>Roadmap</span> : null}
        </div>
        <p>{tool.description}</p>
      </div>
      <Link href={href} aria-label={`${tool.title}: ${tool.planned ? 'view roadmap' : 'open tool'}`}>
        <ChevronRight size={18} />
      </Link>
    </motion.article>
  );
}
