import type { FileCategory } from '@fileflow/shared-types';

export type InspectionConfidence = 'verified' | 'unverified' | 'mismatch';

export type FileInspection = {
  category: FileCategory;
  extension: string;
  declaredMime: string;
  detectedFormat?: string;
  detectedMime?: string;
  confidence: InspectionConfidence;
  size: number;
  lastModified?: string;
  bytesRead: number;
  notice: string;
};

export type FileInspectionResult =
  { ok: true; inspection: FileInspection } | { ok: false; error: string };

type Signature = {
  format: string;
  mime: string;
  acceptedMimes: readonly string[];
  category: FileCategory;
  extensions: readonly string[];
};

export async function inspectFile(file: File): Promise<FileInspectionResult> {
  try {
    const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const signature = detectSignature(header);
    const extension = getExtension(file.name);
    const declaredMime = file.type.trim().toLowerCase();
    const declaredCategory = categoryFromMime(declaredMime);
    const extensionCategory = categoryFromExtension(extension);
    const category = signature?.category ?? declaredCategory ?? extensionCategory ?? 'other';
    const mismatch = Boolean(
      signature &&
      ((declaredMime && !signature.acceptedMimes.includes(declaredMime)) ||
        (extension !== 'none' && !signature.extensions.includes(extension))),
    );
    const confidence: InspectionConfidence = mismatch
      ? 'mismatch'
      : signature
        ? 'verified'
        : 'unverified';

    return {
      ok: true,
      inspection: {
        category,
        extension,
        declaredMime: declaredMime || 'Not provided',
        detectedFormat: signature?.format,
        detectedMime: signature?.mime,
        confidence,
        size: file.size,
        lastModified: file.lastModified
          ? new Date(file.lastModified).toISOString().slice(0, 10)
          : undefined,
        bytesRead: header.byteLength,
        notice: getNotice(confidence, category),
      },
    };
  } catch {
    return {
      ok: false,
      error: 'FileFlow could not read this file. It may be damaged or unavailable.',
    };
  }
}

function getExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match?.[1]?.toLowerCase() ?? 'none';
}

function categoryFromMime(mime: string): FileCategory | undefined {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('wordprocessingml')) return 'document';
  return undefined;
}

function categoryFromExtension(extension: string): FileCategory | undefined {
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(extension)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(extension)) return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) return 'audio';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'document';
  return undefined;
}

function detectSignature(bytes: Uint8Array): Signature | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return signature('JPEG', 'image/jpeg', 'image', ['jpg', 'jpeg'], ['image/jpg']);
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return signature('PNG', 'image/png', 'image', ['png']);
  if (ascii(bytes, 0, 4) === 'GIF8') return signature('GIF', 'image/gif', 'image', ['gif']);
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
    return signature('WebP', 'image/webp', 'image', ['webp']);
  if (ascii(bytes, 0, 5) === '%PDF-') return signature('PDF', 'application/pdf', 'pdf', ['pdf']);
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE')
    return signature('WAV', 'audio/wav', 'audio', ['wav'], ['audio/x-wav']);
  if (ascii(bytes, 0, 4) === 'OggS') return signature('Ogg', 'audio/ogg', 'audio', ['ogg']);
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))
    return signature('MP3', 'audio/mpeg', 'audio', ['mp3'], ['audio/mp3']);
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'M4A ') return signature('M4A', 'audio/mp4', 'audio', ['m4a']);
    return signature('ISO media', 'video/mp4', 'video', ['mp4', 'mov'], ['video/quicktime']);
  }
  return undefined;
}

function signature(
  format: string,
  mime: string,
  category: FileCategory,
  extensions: readonly string[],
  mimeAliases: readonly string[] = [],
): Signature {
  return { format, mime, acceptedMimes: [mime, ...mimeAliases], category, extensions };
}

function startsWith(bytes: Uint8Array, expected: readonly number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function getNotice(confidence: InspectionConfidence, category: FileCategory) {
  if (category === 'other') return 'This file type is not supported yet.';
  if (confidence === 'mismatch')
    return 'The file header does not match its name or declared MIME type.';
  if (confidence === 'verified') return 'Format verified from the local file header.';
  return 'Category inferred from the file name or browser-provided MIME type.';
}
