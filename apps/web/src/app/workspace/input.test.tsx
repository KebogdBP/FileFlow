import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FileUrlInput } from './file-url-input';
import { inspectFile } from './file-inspector';
import { savingPercent, validateWebPResult, webPFileName } from './image-result';
import {
  formatFileSize,
  MAX_INPUT_BYTES,
  validateInputFile,
  validateSourceUrl,
} from './input-policy';
import { batchOverallProgress, MAX_BATCH_FILES, validateBatchCount } from './batch-model';

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

describe('M20 batch planning', () => {
  it('limits batches and calculates deterministic grouped progress', () => {
    expect(validateBatchCount([new File(['a'], 'a.jpg')])).toContain('at least two');
    expect(
      validateBatchCount(
        Array.from({ length: MAX_BATCH_FILES + 1 }, (_, index) => new File(['a'], `${index}.jpg`)),
      ),
    ).toContain(`${MAX_BATCH_FILES}`);
    expect(
      batchOverallProgress([
        { status: 'completed', progress: 100 },
        { status: 'running', progress: 50 },
        { status: 'queued', progress: 0 },
        { status: 'failed', progress: 20 },
      ]),
    ).toBe(63);
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

describe('M09 local image result validation', () => {
  it('accepts only a non-empty RIFF WebP result', () => {
    const valid = new Uint8Array(16);
    valid.set(new TextEncoder().encode('RIFF'), 0);
    valid.set(new TextEncoder().encode('WEBP'), 8);
    expect(validateWebPResult(valid.buffer)).toEqual({ ok: true, size: 16 });
    expect(validateWebPResult(new TextEncoder().encode('not-webp').buffer)).toMatchObject({
      ok: false,
    });
  });

  it('creates safe output names and honest size comparisons', () => {
    expect(webPFileName('holiday.photo.JPG')).toBe('holiday.photo.webp');
    expect(webPFileName('.hidden')).toBe('image.webp');
    expect(savingPercent(1000, 620)).toBe(38);
    expect(savingPercent(1000, 1200)).toBe(-20);
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

  it('starts empty with one accessible file drop target', () => {
    expect(markup).not.toContain('PRIVATE INPUT');
    expect(markup).not.toContain('Drop a File or Link');
    expect(markup).toContain('class="file-drop-zone" role="button"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain('Selecting a file does not upload it');
    expect(markup).not.toContain('Browser worker readiness');
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
    expect(container.textContent).not.toContain('1 source ready');
    expect(container.textContent).toContain('Format verified from the local file header');
    expect(container.textContent).toContain('Make this image lighter');
    expect(container.textContent).toContain('What would you like to do?');
    expect(container.textContent).toContain('Remove private metadata');
    expect(container.textContent).toContain('Confirm intent');
    expect(container.textContent).not.toContain('Plan only');
    const confirm = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm intent',
    );
    await act(async () => confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Create a lighter WebP');
    expect(container.textContent).toContain('Create WebP locally');
    await act(async () => root.unmount());
  });

  it('preserves a compatible intent from an SEO entry page', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput initialIntent="remove-image-metadata" />));
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
    const selected = [...container.querySelectorAll('.intent-options button')].find((button) =>
      button.textContent?.includes('Remove private metadata'),
    );
    expect(selected?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => root.unmount());
  });

  it('creates one verified local plan for a matching image batch', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput />));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [
        mockFile('one.jpg', 'image/jpeg', [0xff, 0xd8, 0xff, 0x00]),
        mockFile('two.png', 'image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ],
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('2 files ready');
    expect(container.textContent).toContain('BATCH VERIFIED');
    expect(container.textContent).toContain('Optimize 2 images together');
    expect(container.textContent).toContain('Process batch locally');
    expect(container.textContent).toContain('one.jpg');
    expect(container.textContent).toContain('two.png');
    await act(async () => root.unmount());
  });

  it('reveals the connected cloud controls after confirming a video intent', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput initialIntent="compress-video" />));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [mockFile('clip.mp4', 'video/mp4', [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70])],
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const confirm = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm intent',
    );
    await act(async () => confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Upload and process');
    expect(container.textContent).toContain('Encoding speed');
    expect(container.textContent).toContain('Sign in or create one');
    await act(async () => root.unmount());
  });

  it('exposes merge PDF for a verified PDF batch', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput />));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [
        mockFile('one.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]),
        mockFile('two.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]),
      ],
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('All files are verified PDFs');
    expect(container.textContent).toContain('Merge Pdf');
    expect(container.textContent).toContain('Upload and process');
    await act(async () => root.unmount());
  });

  it('turns a validated platform URL into a reviewable import intent', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<FileUrlInput />));
    const tabs = [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    await act(async () => tabs[1]?.click());
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      valueSetter?.call(input, 'https://youtube.com/playlist?list=abc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    expect(container.textContent).toContain('Import media from youtube');
    expect(container.textContent).toContain('Confirm import');
    expect(container.textContent).toContain('Nothing has been imported yet');
    await act(async () => root.unmount());
  });

  it('offers a real device-upload action when a platform import fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
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
      valueSetter?.call(input, 'https://youtube.com/watch?v=abc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    const confirm = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm import',
    ) as HTMLButtonElement;
    await act(async () => confirm.click());
    const start = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Import media',
    ) as HTMLButtonElement;
    await act(async () => {
      start.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Failed to fetch');
    expect(container.textContent).toContain('Choose a file instead');
    fetchMock.mockRestore();
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
