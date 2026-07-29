import { operations } from '@fileflow/operation-registry';

const descriptions: Record<string, string> = {
  'optimize-image': 'Make JPG and PNG images smaller in your browser without uploading the source.',
  'remove-image-metadata': 'Remove location, camera and other private metadata on your device.',
  'compress-video': 'Create a smaller, shareable MP4 with clear temporary cloud handling.',
  'video-to-mp4': 'Convert a video into a broadly compatible MP4 file.',
  'resize-video': 'Resize video for sharing, publishing or a smaller display target.',
  'extract-audio': 'Extract a video soundtrack as a lightweight MP3 file.',
  'optimize-audio': 'Reduce audio size with practical quality defaults.',
  'audio-to-mp3': 'Convert audio to an MP3 that works across common players.',
  'audio-to-wav': 'Convert audio to an uncompressed WAV for editing and production.',
  'trim-audio': 'Keep the part of an audio file you need and remove the rest.',
  'merge-pdf': 'Combine between two and twenty PDF files in the order you choose.',
  'compress-pdf': 'Make a PDF smaller while protecting text readability and page order.',
  'split-pdf': 'Extract selected PDF pages into a focused new document.',
  'pdf-to-jpg': 'Turn a PDF page into a checked JPG image.',
  'pdf-to-docx':
    'Convert PDF text into an editable Microsoft Word DOCX document with best-effort layout.',
  'pdf-to-pptx':
    'Convert PDF pages into an editable Microsoft PowerPoint PPTX presentation.',
  'docx-to-pdf': 'Create a stable, shareable PDF from a DOCX document.',
};

export const intentCatalog = operations.map((operation) => ({
  ...operation,
  description:
    descriptions[operation.id] ?? `${operation.displayName} with clear privacy controls.`,
}));

export type IntentEntry = (typeof intentCatalog)[number];

export function findIntent(intent: string) {
  return intentCatalog.find((entry) => entry.id === intent);
}
