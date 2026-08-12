export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://fileflow.pro/api/v1'
    : 'http://localhost:8000/api/v1');
export const ACCOUNT_TOKEN_KEY = 'fileflow.account-token';

export type UploadRecord = {
  id: string;
  status: 'uploading' | 'completed' | 'aborted' | 'expired';
  safety_status: 'pending' | 'scanning' | 'clean' | 'rejected' | 'error';
  detected_content_type: string | null;
  rejection_reason: string | null;
  part_size_bytes: number;
  part_count: number;
};

export type CloudJob = {
  id: string;
  operation: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: number;
  error_code: string | null;
  result_content_type: string | null;
  result_size_bytes: number | null;
  runtime_ms: number | null;
};

export type SocialImport = {
  id: string;
  provider: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  upload_id: string | null;
  title: string | null;
  creator: string | null;
  thumbnail_url: string | null;
  media_type: 'video' | 'audio' | 'subtitles' | 'comments';
  video_quality: 'best' | '1080' | '720' | '480';
  audio_bitrate_kbps: 128 | 192 | 320;
  start_seconds: number | null;
  end_seconds: number | null;
  playlist_item: number | null;
  playlist_count: number | null;
  generic_audio: boolean;
  subtitle_language: string;
  error_code: string | null;
};

export type SocialImportOptions = {
  media_type: 'video' | 'audio' | 'subtitles' | 'comments';
  video_quality: 'best' | '1080' | '720' | '480';
  audio_bitrate_kbps: 128 | 192 | 320;
  start_seconds?: number;
  end_seconds?: number;
  playlist_item?: number;
  playlist_count?: number;
  generic_audio?: boolean;
  subtitle_language?: string;
};

export type DirectDownloadTicket = {
  download_path: string;
  expires_at: string;
};

function contentType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return (
    {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
    }[extension ?? ''] ?? 'application/octet-stream'
  );
}

export function accountToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(ACCOUNT_TOKEN_KEY);
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    detail?: string;
    error?: {
      message?: string;
      details?: Array<{ location?: Array<string | number>; message?: string; type?: string }>;
    };
  } | null;
  const mediaTypeError = payload?.error?.details?.find(
    (item) => item.location?.at(-1) === 'media_type' && item.type === 'literal_error',
  );
  if (mediaTypeError) return 'comments_api_update_required';
  return payload?.error?.message ?? payload?.detail ?? `Request failed (${response.status}).`;
}

export async function apiJson<T>(path: string, init?: RequestInit, token?: string | null) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await responseError(response));
  return (await response.json()) as T;
}

export async function uploadCloudFile(
  file: File,
  onProgress: (progress: number, stage: string) => void,
  signal?: AbortSignal,
) {
  const upload = await apiJson<UploadRecord>('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content_type: contentType(file),
      size_bytes: file.size,
    }),
    signal,
  });
  const parts: { part_number: number; etag: string }[] = [];
  try {
    for (let part = 1; part <= upload.part_count; part += 1) {
      const start = (part - 1) * upload.part_size_bytes;
      const body = file.slice(start, Math.min(start + upload.part_size_bytes, file.size));
      const uploaded = await apiJson<{ part_number: number; etag: string }>(
        `/uploads/${upload.id}/parts/${part}`,
        { method: 'PUT', body, signal },
      );
      parts.push(uploaded);
      onProgress(Math.round((part / upload.part_count) * 70), `Uploading part ${part}`);
    }
    await apiJson<UploadRecord>(`/uploads/${upload.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ parts }),
      signal,
    });
    return await waitForCleanUpload(upload.id, onProgress, signal);
  } catch (error) {
    if (!signal?.aborted) {
      await fetch(`${API_URL}/uploads/${upload.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    throw error;
  }
}

export async function waitForCleanUpload(
  uploadId: string,
  onProgress: (progress: number, stage: string) => void,
  signal?: AbortSignal,
) {
  for (;;) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const upload = await apiJson<UploadRecord>(`/uploads/${uploadId}`, { signal });
    if (upload.safety_status === 'clean') return upload.id;
    if (upload.safety_status === 'rejected' || upload.safety_status === 'error') {
      throw new Error(upload.rejection_reason ?? `Safety check ${upload.safety_status}.`);
    }
    onProgress(upload.safety_status === 'scanning' ? 85 : 78, 'Safety scan');
    await delay(1000, signal);
  }
}

export function createCloudJob(
  uploadId: string,
  sourceUploadIds: readonly string[],
  operation: string,
  parameters: Record<string, string | number>,
  token: string,
  signal?: AbortSignal,
) {
  return apiJson<CloudJob>(
    '/jobs',
    {
      method: 'POST',
      body: JSON.stringify({
        upload_id: uploadId,
        source_upload_ids: sourceUploadIds,
        operation,
        parameters,
      }),
      signal,
    },
    token,
  );
}

export async function waitForCloudJob(
  jobId: string,
  token: string,
  onProgress: (job: CloudJob) => void,
  signal?: AbortSignal,
) {
  for (;;) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const job = await apiJson<CloudJob>(`/jobs/${jobId}`, { signal }, token);
    onProgress(job);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error_code ?? `Job ${job.status}.`);
    }
    await delay(1000, signal);
  }
}

export function responseFilename(disposition: string, fallback: string) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall back to the ASCII filename when a server sends invalid encoding.
    }
  }
  return /filename="([^"]+)"/i.exec(disposition)?.[1] ?? fallback;
}

export async function downloadJobResult(jobId: string, token: string) {
  const response = await fetch(`${API_URL}/jobs/${jobId}/result`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await responseError(response));
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = responseFilename(disposition, `fileflow-${jobId}`);
  return { blob: await response.blob(), filename };
}

export function createSocialImport(
  url: string,
  options: SocialImportOptions,
  signal?: AbortSignal,
) {
  return apiJson<SocialImport>('/imports', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
    signal,
  });
}

export function createDirectDownload(
  url: string,
  options: SocialImportOptions,
  signal?: AbortSignal,
) {
  return apiJson<DirectDownloadTicket>('/imports/direct', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
    signal,
  });
}

export function startBrowserDownload(downloadPath: string) {
  const anchor = document.createElement('a');
  anchor.href = downloadPath.startsWith('http') ? downloadPath : `${API_URL}${downloadPath}`;
  anchor.rel = 'noopener';
  anchor.download = '';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function waitForSocialImport(
  importId: string,
  onProgress?: (item: SocialImport) => void,
  signal?: AbortSignal,
) {
  for (;;) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const item = await apiJson<SocialImport>(`/imports/${importId}`, { signal });
    onProgress?.(item);
    if (item.status === 'completed') return item;
    if (item.status === 'failed') throw new Error(item.error_code ?? 'Import failed.');
    await delay(1000, signal);
  }
}

export async function downloadSocialImportResult(
  importId: string,
  onProgress?: (progress: number | null) => void,
) {
  onProgress?.(null);
  startBrowserDownload(`/imports/${importId}/result`);
  onProgress?.(100);
}

export async function getSocialImportResult(importId: string) {
  const response = await fetch(`${API_URL}/imports/${importId}/result`);
  if (!response.ok) throw new Error(await responseError(response));
  const disposition = response.headers.get('Content-Disposition') ?? '';
  return {
    blob: await response.blob(),
    filename: responseFilename(disposition, `fileflow-${importId}.vtt`),
  };
}

export type AiChatMessage = { role: 'user' | 'assistant'; content: string };

export function askSubtitleAi(
  sourceText: string,
  prompt: string,
  history: readonly AiChatMessage[],
  token: string,
  sourceKind: 'subtitles' | 'comments' = 'subtitles',
) {
  return apiJson<{ answer: string; model: string; remaining_today: number }>(
    '/subtitles/assist',
    {
      method: 'POST',
      body: JSON.stringify({
        source_text: sourceText,
        source_kind: sourceKind,
        prompt,
        history: history.slice(-8),
        response_language: 'auto',
      }),
    },
    token,
  );
}

export async function downloadSubtitleDocx(title: string, subtitleText: string, token: string) {
  const response = await fetch(`${API_URL}/subtitles/docx`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text: subtitleText }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.blob();
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException('Cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}
