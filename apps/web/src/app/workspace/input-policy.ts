export const MAX_INPUT_BYTES = 2 * 1024 * 1024 * 1024;

export const FILE_ACCEPT = ['image/*', 'video/*', 'audio/*', 'application/pdf', '.docx'] as const;

export type InputPlatform = 'youtube' | 'instagram' | 'tiktok';

export type InputValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const extensionPattern = /\.(jpe?g|png|webp|gif|heic|mp4|mov|webm|mp3|wav|m4a|ogg|pdf|docx)$/i;

export function validateInputFile(file: File): InputValidationResult<File> {
  if (file.size === 0) {
    return { ok: false, error: 'This file is empty. Choose a file that contains data.' };
  }

  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, error: 'This file is larger than the 2 GB input limit.' };
  }

  const supportedMime =
    file.type.startsWith('image/') ||
    file.type.startsWith('video/') ||
    file.type.startsWith('audio/') ||
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!supportedMime && !extensionPattern.test(file.name)) {
    return {
      ok: false,
      error: 'Choose an image, video, audio, PDF or DOCX file.',
    };
  }

  return { ok: true, value: file };
}

export function validateSourceUrl(
  input: string,
): InputValidationResult<{ url: string; platform: InputPlatform }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Paste a public video URL to continue.' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a complete URL, including https://.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'For your safety, only HTTPS links are accepted.' };
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const platform = getPlatform(hostname);
  if (!platform) {
    return { ok: false, error: 'Use a public YouTube, Instagram or TikTok URL.' };
  }

  return { ok: true, value: { url: url.toString(), platform } };
}

function getPlatform(hostname: string): InputPlatform | undefined {
  if (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
    return 'youtube';
  }
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) return 'instagram';
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) return 'tiktok';
  return undefined;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}
