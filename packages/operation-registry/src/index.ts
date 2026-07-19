import type { FileCategory, ProcessingMode } from '@fileflow/shared-types';

export type OperationDefinition = {
  id: string;
  displayName: string;
  executionMode: ProcessingMode | 'hybrid';
  supportedInputs: readonly FileCategory[];
  supportedOutputs: readonly string[];
};

export const operations = [
  {
    id: 'optimize-image',
    displayName: 'Make this image lighter',
    executionMode: 'local',
    supportedInputs: ['image'],
    supportedOutputs: ['webp', 'original'],
  },
  {
    id: 'remove-image-metadata',
    displayName: 'Remove private metadata',
    executionMode: 'local',
    supportedInputs: ['image'],
    supportedOutputs: ['original'],
  },
  {
    id: 'compress-video',
    displayName: 'Prepare this video for sharing',
    executionMode: 'cloud',
    supportedInputs: ['video'],
    supportedOutputs: ['mp4'],
  },
  {
    id: 'video-to-mp4',
    displayName: 'Convert to compatible MP4',
    executionMode: 'cloud',
    supportedInputs: ['video'],
    supportedOutputs: ['mp4'],
  },
  {
    id: 'resize-video',
    displayName: 'Resize this video',
    executionMode: 'cloud',
    supportedInputs: ['video'],
    supportedOutputs: ['mp4'],
  },
  {
    id: 'extract-audio',
    displayName: 'Extract the audio track',
    executionMode: 'cloud',
    supportedInputs: ['video'],
    supportedOutputs: ['mp3'],
  },
  {
    id: 'optimize-audio',
    displayName: 'Make this audio easier to share',
    executionMode: 'hybrid',
    supportedInputs: ['audio'],
    supportedOutputs: ['mp3', 'original'],
  },
  {
    id: 'audio-to-mp3',
    displayName: 'Convert to MP3',
    executionMode: 'cloud',
    supportedInputs: ['audio'],
    supportedOutputs: ['mp3'],
  },
  {
    id: 'audio-to-wav',
    displayName: 'Convert to WAV',
    executionMode: 'cloud',
    supportedInputs: ['audio'],
    supportedOutputs: ['wav'],
  },
  {
    id: 'trim-audio',
    displayName: 'Trim this audio',
    executionMode: 'cloud',
    supportedInputs: ['audio'],
    supportedOutputs: ['mp3'],
  },
  {
    id: 'compress-pdf',
    displayName: 'Make this PDF smaller',
    executionMode: 'cloud',
    supportedInputs: ['pdf'],
    supportedOutputs: ['pdf'],
  },
  {
    id: 'split-pdf',
    displayName: 'Extract PDF pages',
    executionMode: 'cloud',
    supportedInputs: ['pdf'],
    supportedOutputs: ['pdf'],
  },
  {
    id: 'pdf-to-jpg',
    displayName: 'Turn a PDF page into an image',
    executionMode: 'cloud',
    supportedInputs: ['pdf'],
    supportedOutputs: ['jpg'],
  },
  {
    id: 'docx-to-pdf',
    displayName: 'Create a shareable PDF',
    executionMode: 'cloud',
    supportedInputs: ['document'],
    supportedOutputs: ['pdf'],
  },
] as const satisfies readonly OperationDefinition[];

export type RecommendationContext = {
  category: FileCategory;
  mime?: string;
  size: number;
  confidence: 'verified' | 'unverified' | 'mismatch';
};

export type RecommendationDefault = {
  label: string;
  value: string;
  reason: string;
};

export type RecommendationAlternative = {
  operationId: string;
  title: string;
  outcome: string;
  mode: ProcessingMode;
};

export type RecommendationPlan = {
  operationId: string;
  title: string;
  outcome: string;
  mode: ProcessingMode;
  reason: string;
  expectation: string;
  privacy: string;
  defaults: readonly RecommendationDefault[];
  tradeoffs: readonly string[];
  alternatives: readonly RecommendationAlternative[];
};

export type RecommendationResult =
  | { status: 'ready'; plan: RecommendationPlan }
  | { status: 'blocked'; reason: string }
  | { status: 'unsupported'; reason: string };

const LOCAL_AUDIO_LIMIT = 250 * 1024 * 1024;

export function availableOperations(
  context: RecommendationContext,
): readonly OperationDefinition[] {
  return operations.filter((operation) =>
    operation.supportedInputs.some((category) => category === context.category),
  );
}

export function recommendOperation(
  context: RecommendationContext,
  operationId?: string,
): RecommendationResult {
  if (context.confidence === 'mismatch') {
    return {
      status: 'blocked',
      reason:
        'Confirm the file identity before choosing an operation. Its header conflicts with its name or MIME type.',
    };
  }

  if (operationId) {
    const operation = availableOperations(context).find((item) => item.id === operationId);
    if (!operation) {
      return {
        status: 'unsupported',
        reason: 'This operation does not support the selected file.',
      };
    }
    return { status: 'ready', plan: selectedPlan(context, operation) };
  }

  switch (context.category) {
    case 'image':
      return { status: 'ready', plan: imagePlan(context) };
    case 'video':
      return { status: 'ready', plan: videoPlan() };
    case 'audio':
      return { status: 'ready', plan: audioPlan(context.size) };
    case 'pdf':
      return { status: 'ready', plan: pdfPlan() };
    case 'document':
      return { status: 'ready', plan: documentPlan() };
    default:
      return {
        status: 'unsupported',
        reason: 'FileFlow does not have a safe recommendation for this file category yet.',
      };
  }
}

function selectedPlan(
  context: RecommendationContext,
  operation: OperationDefinition,
): RecommendationPlan {
  if (operation.id === 'optimize-image') return imagePlan(context);
  if (operation.id === 'compress-video') return videoPlan();
  if (operation.id === 'optimize-audio') return audioPlan(context.size);
  if (operation.id === 'compress-pdf') return pdfPlan();
  if (operation.id === 'docx-to-pdf') return documentPlan();
  const mode: ProcessingMode = operation.executionMode === 'local' ? 'local' : 'cloud';
  const output = operation.supportedOutputs[0]?.toUpperCase() ?? 'new file';
  return {
    operationId: operation.id,
    title: operation.displayName,
    outcome: `A checked ${output} result created from the selected source.`,
    mode,
    reason: 'This intent matches the file category and a reviewed FileFlow operation.',
    expectation: 'FileFlow uses bounded defaults and validates the output before it is returned.',
    privacy:
      mode === 'local'
        ? 'Runs on this device. The source file is not uploaded.'
        : 'Requires encrypted cloud processing with automatic temporary-file cleanup.',
    defaults: [
      { label: 'Output', value: output, reason: 'Matches the selected intent.' },
      { label: 'Safety', value: 'Validated', reason: 'The result signature is checked.' },
    ],
    tradeoffs: mode === 'cloud' ? ['The source must be uploaded temporarily.'] : [],
    alternatives: [],
  };
}

function imagePlan(context: RecommendationContext): RecommendationPlan {
  const isGif = context.mime === 'image/gif';
  return {
    operationId: 'optimize-image',
    title: 'Make this image lighter',
    outcome: 'A smaller image that is easier to share and publish.',
    mode: 'local',
    reason: 'Images can usually be optimized safely in your browser without uploading the source.',
    expectation: isGif
      ? 'Animation will be preserved; savings depend on the original frames.'
      : 'Strong size savings with little visible difference at normal viewing size.',
    privacy: 'Runs on this device. The source file is not uploaded.',
    defaults: [
      {
        label: 'Quality',
        value: 'Balanced · 82%',
        reason: 'Keeps detail while reducing file size.',
      },
      {
        label: 'Output',
        value: isGif ? 'Keep animated format' : 'WebP',
        reason: isGif ? 'Avoids losing animation.' : 'Efficient support across modern browsers.',
      },
      {
        label: 'Metadata',
        value: 'Remove private data',
        reason: 'Drops location and camera details.',
      },
    ],
    tradeoffs: ['A smaller file may not be byte-for-byte identical to the source.'],
    alternatives: [
      {
        operationId: 'remove-image-metadata',
        title: 'Remove metadata only',
        outcome: 'Keep the original visual quality.',
        mode: 'local',
      },
    ],
  };
}

function videoPlan(): RecommendationPlan {
  return {
    operationId: 'compress-video',
    title: 'Prepare this video for sharing',
    outcome: 'A broadly compatible MP4 with a smaller transfer size.',
    mode: 'cloud',
    reason:
      'Video encoding is resource-intensive and is more reliable in the protected processing worker.',
    expectation: 'Faster sharing and playback with a controlled reduction in detail.',
    privacy:
      'Requires encrypted cloud processing. The temporary source will be automatically removed.',
    defaults: [
      {
        label: 'Preset',
        value: 'Balanced',
        reason: 'A practical compromise between size and detail.',
      },
      { label: 'Resolution', value: 'Keep up to 1080p', reason: 'Avoids unnecessary upscaling.' },
      { label: 'Output', value: 'MP4', reason: 'Works across common devices and platforms.' },
    ],
    tradeoffs: ['Encoding takes time.', 'Some fine detail may be reduced.'],
    alternatives: [
      {
        operationId: 'extract-audio',
        title: 'Extract audio instead',
        outcome: 'Create a lightweight MP3 from the soundtrack.',
        mode: 'cloud',
      },
    ],
  };
}

function audioPlan(size: number): RecommendationPlan {
  const mode: ProcessingMode = size <= LOCAL_AUDIO_LIMIT ? 'local' : 'cloud';
  return {
    operationId: 'optimize-audio',
    title: 'Make this audio easier to share',
    outcome: 'A compact MP3 that keeps clear speech and music.',
    mode,
    reason:
      mode === 'local'
        ? 'This file is within the safe on-device size range.'
        : 'This file is too large for reliable in-browser encoding.',
    expectation: 'A predictable balance of sound quality and file size.',
    privacy:
      mode === 'local'
        ? 'Runs on this device. The source file is not uploaded.'
        : 'Requires encrypted cloud processing with automatic temporary-file cleanup.',
    defaults: [
      {
        label: 'Bitrate',
        value: '192 kbps',
        reason: 'Clear for everyday listening without excessive size.',
      },
      {
        label: 'Output',
        value: 'MP3',
        reason: 'Compatible with common players and messaging apps.',
      },
    ],
    tradeoffs: ['Lossy compression removes audio data that cannot be restored.'],
    alternatives: [],
  };
}

function pdfPlan(): RecommendationPlan {
  return {
    operationId: 'compress-pdf',
    title: 'Make this PDF smaller',
    outcome: 'A more portable PDF with the document structure preserved.',
    mode: 'cloud',
    reason: 'Reliable PDF optimization needs document-aware tooling.',
    expectation: 'Images may become lighter while text remains readable.',
    privacy: 'Requires encrypted cloud processing with automatic temporary-file cleanup.',
    defaults: [
      {
        label: 'Compression',
        value: 'Balanced',
        reason: 'Protects readability while reducing embedded images.',
      },
      { label: 'Structure', value: 'Preserve', reason: 'Keeps pages, links and document order.' },
    ],
    tradeoffs: ['Scanned images may lose some fine detail.'],
    alternatives: [],
  };
}

function documentPlan(): RecommendationPlan {
  return {
    operationId: 'docx-to-pdf',
    title: 'Create a shareable PDF',
    outcome: 'A fixed-layout document that is easier to open and send.',
    mode: 'cloud',
    reason: 'Document conversion needs a compatible office renderer to preserve layout.',
    expectation: 'Fonts and pagination are retained where the source allows it.',
    privacy: 'Requires encrypted cloud processing with automatic temporary-file cleanup.',
    defaults: [
      { label: 'Output', value: 'PDF', reason: 'Preserves layout across devices.' },
      { label: 'Quality', value: 'Print-ready', reason: 'Keeps text and diagrams sharp.' },
    ],
    tradeoffs: ['Editable document features will become fixed PDF content.'],
    alternatives: [],
  };
}
