export type WebPValidation = { ok: true; size: number } | { ok: false; error: string };

export function validateWebPResult(output: ArrayBuffer): WebPValidation {
  const bytes = new Uint8Array(output);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (bytes.byteLength < 12 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') {
    return { ok: false, error: 'The local worker did not produce a valid WebP file.' };
  }
  return { ok: true, size: bytes.byteLength };
}

export function webPFileName(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.webp`;
}

export function savingPercent(sourceSize: number, resultSize: number) {
  if (sourceSize <= 0) return 0;
  return Math.round(((sourceSize - resultSize) / sourceSize) * 100);
}
