import {
  installLocalWorkerRuntime,
  type LocalOperationHandler,
  type WorkerRuntimeScope,
} from '@fileflow/local-processing';

function isWebP(output: ArrayBuffer) {
  const bytes = new Uint8Array(output);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  return bytes.byteLength >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
}

const processImage: LocalOperationHandler = async ({ input, options, signal, reportProgress }) => {
  const sourceMime = String(options.sourceMime ?? 'image/jpeg');
  if (options.removeMetadataOnly === true && sourceMime === 'image/jpeg') {
    reportProgress(25, 'Reading JPEG segments');
    const output = stripJpegMetadata(input);
    const metadata: Readonly<Record<string, string | number | boolean>> = {
      mime: 'image/jpeg',
      metadataRemoved: true,
    };
    reportProgress(100, 'Validating result');
    return {
      output,
      metadata,
    };
  }
  const quality = Math.min(1, Math.max(0.1, Number(options.quality ?? 0.82)));
  const maxDimension = Math.max(0, Number(options.maxDimension ?? 0));
  reportProgress(15, 'Decoding image');
  const bitmap = await createImageBitmap(new Blob([input], { type: sourceMime }));
  try {
    if (signal.aborted) throw new Error('Cancelled');
    const scale =
      maxDimension > 0 ? Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height)) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    reportProgress(45, 'Drawing pixels');
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot create a local image canvas.');
    context.drawImage(bitmap, 0, 0, width, height);
    if (signal.aborted) throw new Error('Cancelled');
    reportProgress(75, 'Encoding WebP');
    let output: ArrayBuffer;
    let outputMime = 'image/webp';
    try {
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      output = await blob.arrayBuffer();
      outputMime = blob.type;
    } catch {
      output = new ArrayBuffer(0);
    }
    if (!isWebP(output)) {
      if (signal.aborted) throw new Error('Cancelled');
      reportProgress(84, 'Using compatible WebP encoder');
      const { default: encodeWebP } = await import('@jsquash/webp/encode.js');
      output = await encodeWebP(context.getImageData(0, 0, width, height), {
        quality: Math.round(quality * 100),
        method: 4,
      });
      outputMime = 'image/webp';
    }
    reportProgress(100, 'Validating result');
    return {
      output,
      metadata: {
        width,
        height,
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
        mime: outputMime,
        metadataRemoved: true,
      },
    };
  } finally {
    bitmap.close();
  }
};

function stripJpegMetadata(input: ArrayBuffer): ArrayBuffer {
  const source = new Uint8Array(input);
  if (source.length < 4 || source[0] !== 0xff || source[1] !== 0xd8) {
    throw new Error('The selected file is not a valid JPEG image.');
  }
  const chunks: Uint8Array[] = [source.slice(0, 2)];
  let offset = 2;
  while (offset + 1 < source.length) {
    if (source[offset] !== 0xff) throw new Error('The JPEG segment structure is invalid.');
    const markerStart = offset;
    while (offset < source.length && source[offset] === 0xff) offset += 1;
    const marker = source[offset];
    offset += 1;
    if (marker === undefined) break;
    if (marker === 0xda) {
      chunks.push(source.slice(markerStart));
      offset = source.length;
      break;
    }
    if (marker === 0xd9) {
      chunks.push(source.slice(markerStart, offset));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(source.slice(markerStart, offset));
      continue;
    }
    if (offset + 1 >= source.length) throw new Error('The JPEG segment is truncated.');
    const length = (source[offset]! << 8) | source[offset + 1]!;
    if (length < 2 || offset + length > source.length) {
      throw new Error('The JPEG segment has an invalid length.');
    }
    const segmentEnd = offset + length;
    const isPrivateMetadata = marker === 0xfe || (marker >= 0xe1 && marker <= 0xef);
    if (!isPrivateMetadata) chunks.push(source.slice(markerStart, segmentEnd));
    offset = segmentEnd;
  }
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(size);
  let writeOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return output.buffer;
}

installLocalWorkerRuntime(self as unknown as WorkerRuntimeScope, {
  'optimize-image': processImage,
  'remove-image-metadata': processImage,
});
