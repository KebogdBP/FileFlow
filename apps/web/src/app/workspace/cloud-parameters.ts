export type CloudParameters = Record<string, string | number>;

export function defaultCloudParameters(operationId: string): CloudParameters {
  if (['compress-video', 'video-to-mp4'].includes(operationId))
    return { quality: 23, preset: 'medium', max_height: 1080 };
  if (['extract-audio', 'audio-to-mp3', 'optimize-audio'].includes(operationId))
    return { bitrate_kbps: 192 };
  if (operationId === 'trim-audio') return { start_ms: 0, end_ms: 30000 };
  if (operationId === 'compress-pdf') return { quality: 'balanced' };
  if (operationId === 'split-pdf') return { pages: 'all' };
  if (operationId === 'pdf-to-jpg') return { page: 1, dpi: 150, quality: 85 };
  return {};
}

export function parametersForOperation(
  operationId: string,
  candidate: CloudParameters,
): CloudParameters {
  const defaults = defaultCloudParameters(operationId);
  if (['compress-video', 'video-to-mp4'].includes(operationId)) {
    return {
      quality: boundedInteger(candidate.quality, 18, 32, Number(defaults.quality)),
      preset: choice(candidate.preset, ['fast', 'medium', 'slow'], String(defaults.preset)),
      max_height: choiceInteger(
        candidate.max_height,
        [480, 720, 1080],
        Number(defaults.max_height),
      ),
    };
  }
  if (['extract-audio', 'audio-to-mp3', 'optimize-audio'].includes(operationId)) {
    return { bitrate_kbps: choiceInteger(candidate.bitrate_kbps, [128, 192, 256], 192) };
  }
  if (operationId === 'trim-audio') {
    const start = boundedInteger(candidate.start_ms, 0, 86_400_000, 0);
    const end = boundedInteger(candidate.end_ms, 100, 86_400_000, 30_000);
    return { start_ms: start, end_ms: end > start ? end : Math.min(start + 30_000, 86_400_000) };
  }
  if (operationId === 'compress-pdf') {
    return { quality: choice(candidate.quality, ['screen', 'balanced', 'print'], 'balanced') };
  }
  if (operationId === 'split-pdf') {
    return {
      pages:
        typeof candidate.pages === 'string' &&
        (candidate.pages === 'all' || /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(candidate.pages))
          ? candidate.pages
          : 'all',
    };
  }
  if (operationId === 'pdf-to-jpg') {
    return {
      page: boundedInteger(candidate.page, 1, 100_000, 1),
      dpi: choiceInteger(candidate.dpi, [72, 150, 300], 150),
      quality: boundedInteger(candidate.quality, 40, 95, 85),
    };
  }
  return {};
}

function boundedInteger(
  value: string | number | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

function choice(value: string | number | undefined, allowed: readonly string[], fallback: string) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function choiceInteger(
  value: string | number | undefined,
  allowed: readonly number[],
  fallback: number,
) {
  return typeof value === 'number' && allowed.includes(value) ? value : fallback;
}
