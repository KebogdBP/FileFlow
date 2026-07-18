import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FileUrlInput } from './file-url-input';
import { inspectFile } from './file-inspector';
import {
  formatFileSize,
  MAX_INPUT_BYTES,
  validateInputFile,
  validateSourceUrl,
} from './input-policy';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function mockFile(name: string, type: string, bytes: readonly number[], lastModified = 0) {
  return {
    name,
    type,
    size: bytes.length,
    lastModified,
    slice: () => ({
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    }),
  } as unknown as File;
}

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

describe('M06 local file inspector', () => {
  it('verifies category and MIME from a file signature', async () => {
    const file = mockFile(
      'photo.png',
      'image/png',
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );

    await expect(inspectFile(file)).resolves.toMatchObject({
      ok: true,
      inspection: {
        category: 'image',
        detectedFormat: 'PNG',
        detectedMime: 'image/png',
        confidence: 'verified',
      },
    });
  });

  it('warns when the header conflicts with the file name and declared MIME', async () => {
    const pdfHeader = [...new TextEncoder().encode('%PDF-1.7')];
    const file = mockFile('photo.jpg', 'image/jpeg', pdfHeader);

    await expect(inspectFile(file)).resolves.toMatchObject({
      ok: true,
      inspection: {
        category: 'pdf',
        detectedFormat: 'PDF',
        confidence: 'mismatch',
        notice: expect.stringContaining('does not match'),
      },
    });
  });

  it('falls back safely when a supported signature is unavailable', async () => {
    const file = mockFile('camera.heic', 'image/heic', [0, 1, 2, 3]);

    await expect(inspectFile(file)).resolves.toMatchObject({
      ok: true,
      inspection: { category: 'image', confidence: 'unverified' },
    });
  });

  it('returns a damaged or unavailable state when local reading fails', async () => {
    const file = {
      name: 'broken.pdf',
      type: 'application/pdf',
      size: 12,
      lastModified: 0,
      slice: () => ({ arrayBuffer: async () => Promise.reject(new Error('read failed')) }),
    } as unknown as File;

    await expect(inspectFile(file)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('damaged'),
    });
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
      value: [mockFile('holiday.jpg', 'image/jpeg', [0xff, 0xd8, 0xff, 0x00])],
    });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('holiday.jpg');
    expect(container.textContent).toContain('Ready for inspection');
    expect(container.textContent).toContain('1 source ready');
    expect(container.textContent).toContain('Format verified from the local file header');
    expect(container.textContent).toContain('Make this image lighter');
    expect(container.textContent).toContain('Plan only · nothing has started');
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
