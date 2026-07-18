import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FileUrlInput } from './file-url-input';
import {
  formatFileSize,
  MAX_INPUT_BYTES,
  validateInputFile,
  validateSourceUrl,
} from './input-policy';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('M05 file input policy', () => {
  it('accepts supported file categories', () => {
    const files = [
      new File(['image'], 'photo.webp', { type: 'image/webp' }),
      new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
      new File(['audio'], 'voice.wav', { type: 'audio/wav' }),
      new File(['pdf'], 'notes.pdf', { type: 'application/pdf' }),
      new File(['doc'], 'brief.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ];

    for (const file of files) expect(validateInputFile(file).ok).toBe(true);
  });

  it('rejects empty, oversized and unsupported files with actionable errors', () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    const unsupported = new File(['data'], 'data.exe', { type: 'application/octet-stream' });
    const oversized = {
      name: 'movie.mp4',
      type: 'video/mp4',
      size: MAX_INPUT_BYTES + 1,
    } as File;

    expect(validateInputFile(empty)).toMatchObject({
      ok: false,
      error: expect.stringContaining('empty'),
    });
    expect(validateInputFile(oversized)).toMatchObject({
      ok: false,
      error: expect.stringContaining('2 GB'),
    });
    expect(validateInputFile(unsupported)).toMatchObject({
      ok: false,
      error: expect.stringContaining('image'),
    });
  });

  it.each([
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://instagram.com/reel/abc', 'instagram'],
    ['https://m.tiktok.com/v/abc', 'tiktok'],
  ])('accepts supported public URL %s', (url, platform) => {
    expect(validateSourceUrl(url)).toMatchObject({ ok: true, value: { platform } });
  });

  it('rejects malformed, insecure and lookalike URLs', () => {
    expect(validateSourceUrl('')).toMatchObject({ ok: false });
    expect(validateSourceUrl('youtube.com/watch?v=abc')).toMatchObject({ ok: false });
    expect(validateSourceUrl('http://youtube.com/watch?v=abc')).toMatchObject({
      ok: false,
      error: expect.stringContaining('HTTPS'),
    });
    expect(validateSourceUrl('https://youtube.com.evil.example/watch?v=abc')).toMatchObject({
      ok: false,
    });
  });

  it('formats file sizes for readable source summaries', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(12 * 1024 * 1024)).toBe('12 MB');
  });
});

describe('M05 file and URL input UI', () => {
  const markup = renderToStaticMarkup(<FileUrlInput />);

  it('renders an accessible picker and source tabs', () => {
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('type="file"');
    expect(markup).toContain('aria-describedby=');
  });

  it('starts empty and explains that selection does not upload', () => {
    expect(markup).toContain('Nothing uploaded');
    expect(markup).toContain('Selecting a file does not upload it');
    expect(markup).toContain('aria-live="polite"');
  });

  it('moves a valid picker selection into the ready state', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput />));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['photo'], 'holiday.jpg', { type: 'image/jpeg' })],
    });

    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));

    expect(container.textContent).toContain('holiday.jpg');
    expect(container.textContent).toContain('Ready for inspection');
    expect(container.textContent).toContain('1 source ready');
    await act(async () => root.unmount());
  });

  it('shows an actionable error for an invalid link', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput />));
    const linkTab = [...container.querySelectorAll('[role="tab"]')].find((element) =>
      element.textContent?.includes('From a link'),
    ) as HTMLButtonElement;
    await act(async () => linkTab.click());
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      valueSetter?.call(input, 'http://youtube.com/watch?v=abc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () =>
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('HTTPS');
    await act(async () => root.unmount());
  });
});
