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
  upload_id: string | null;
  title: string | null;
  creator: string | null;
  thumbnail_url: string | null;
  error_code: string | null;
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
    error?: { message?: string };
  } | null;
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

export async function downloadJobResult(jobId: string, token: string) {
  const response = await fetch(`${API_URL}/jobs/${jobId}/result`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await responseError(response));
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `fileflow-${jobId}`;
  return { blob: await response.blob(), filename };
}

export function createSocialImport(url: string, signal?: AbortSignal) {
  return apiJson<SocialImport>('/imports', {
    method: 'POST',
    body: JSON.stringify({ url }),
    signal,
  });
}

export async function waitForSocialImport(importId: string, signal?: AbortSignal) {
  for (;;) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const item = await apiJson<SocialImport>(`/imports/${importId}`, { signal });
    if (item.status === 'completed') return item;
    if (item.status === 'failed') throw new Error(item.error_code ?? 'Import failed.');
    await delay(1000, signal);
  }
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
