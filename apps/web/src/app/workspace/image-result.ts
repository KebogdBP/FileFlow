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

export function validateJpegResult(output: ArrayBuffer): WebPValidation {
  const bytes = new Uint8Array(output);
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.byteLength - 2] !== 0xff ||
    bytes[bytes.byteLength - 1] !== 0xd9
  ) {
    return { ok: false, error: 'The local worker did not produce a valid JPEG file.' };
  }
  return { ok: true, size: bytes.byteLength };
}

export function metadataFreeJpegFileName(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-metadata-free.jpg`;
}

export function savingPercent(sourceSize: number, resultSize: number) {
  if (sourceSize <= 0) return 0;
  return Math.round(((sourceSize - resultSize) / sourceSize) * 100);
}
