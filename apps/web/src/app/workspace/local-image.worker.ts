import { installLocalWorkerRuntime, type WorkerRuntimeScope } from '@fileflow/local-processing';

installLocalWorkerRuntime(self as unknown as WorkerRuntimeScope, {
  'optimize-image': async ({ input, options, signal, reportProgress }) => {
    const sourceMime = String(options.sourceMime ?? 'image/jpeg');
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
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      const output = await blob.arrayBuffer();
      reportProgress(100, 'Validating result');
      return {
        output,
        metadata: {
          width,
          height,
          sourceWidth: bitmap.width,
          sourceHeight: bitmap.height,
          mime: blob.type,
          metadataRemoved: true,
        },
      };
    } finally {
      bitmap.close();
    }
  },
});
