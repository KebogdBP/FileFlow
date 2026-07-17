import type { HTMLAttributes } from 'react';
import { Badge } from './badge';
import { Card } from './card';
import { Progress, type ProgressVariant } from './progress';

export type ProcessingStage = 'idle' | 'analyzing' | 'processing' | 'completed' | 'error';
export type ProcessingMode = 'local' | 'cloud';

export type ProcessingFeedbackProps = HTMLAttributes<HTMLDivElement> & {
  stage: ProcessingStage;
  progress?: number;
  mode?: ProcessingMode;
  progressVariant?: ProgressVariant;
};

const stageContent: Record<ProcessingStage, { symbol: string; title: string; detail: string }> = {
  idle: { symbol: '○', title: 'Ready', detail: 'Choose a file to begin.' },
  analyzing: { symbol: '◇', title: 'Analyzing file', detail: 'Reading format and metadata.' },
  processing: { symbol: '↻', title: 'Processing', detail: 'Applying the selected transformation.' },
  completed: { symbol: '✓', title: 'Complete', detail: 'Your result is ready.' },
  error: { symbol: '!', title: 'Needs attention', detail: 'The operation could not be completed.' },
};

export function ProcessingFeedback({
  stage,
  progress = 0,
  mode = 'local',
  progressVariant = 'linear',
  style,
  ...props
}: ProcessingFeedbackProps) {
  const content = stageContent[stage];
  const active = stage === 'analyzing' || stage === 'processing';

  return (
    <Card
      {...props}
      data-ff-processing={stage}
      style={{ display: 'grid', gap: 'var(--ff-space-5)', ...style }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--ff-space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ff-space-3)' }}>
          <span
            data-ff-stage-symbol={stage}
            aria-hidden="true"
            style={{
              display: 'grid',
              width: 36,
              height: 36,
              placeItems: 'center',
              borderRadius: 'var(--ff-radius-full)',
              background: 'var(--ff-color-primary-soft)',
              color: 'var(--ff-color-primary)',
              fontWeight: 800,
            }}
          >
            {content.symbol}
          </span>
          <div aria-live="polite" aria-atomic="true">
            <strong>{content.title}</strong>
            <p
              style={{
                margin: 'var(--ff-space-1) 0 0',
                color: 'var(--ff-color-text-muted)',
                fontSize: 'var(--ff-font-body-sm-size)',
              }}
            >
              {content.detail}
            </p>
          </div>
        </div>
        <Badge variant={mode === 'local' ? 'local' : 'cloud'}>
          {mode === 'local' ? 'LOCAL' : 'CLOUD'}
        </Badge>
      </div>
      {stage !== 'idle' ? (
        <Progress
          variant={progressVariant}
          value={stage === 'completed' ? 100 : progress}
          label={content.title}
          indeterminate={stage === 'analyzing'}
          size={80}
        />
      ) : null}
      {active ? <span className="ff-sr-only">Operation in progress</span> : null}
    </Card>
  );
}

export type FileTransformationProps = HTMLAttributes<HTMLDivElement> & {
  sourceFormat: string;
  resultFormat: string;
  sourceSize: string;
  resultSize: string;
  savingPercent: number;
};

export function FileTransformation({
  sourceFormat,
  resultFormat,
  sourceSize,
  resultSize,
  savingPercent,
  style,
  ...props
}: FileTransformationProps) {
  return (
    <Card
      {...props}
      data-ff-transformation=""
      style={{ display: 'grid', gap: 'var(--ff-space-5)', ...style }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 'var(--ff-space-4)',
        }}
      >
        <div>
          <span style={{ color: 'var(--ff-color-text-muted)' }}>Source</span>
          <strong style={{ display: 'block', marginTop: 'var(--ff-space-1)' }}>
            {sourceFormat} · {sourceSize}
          </strong>
        </div>
        <span data-ff-transform-arrow="" aria-label="transforms to">
          →
        </span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: 'var(--ff-color-text-muted)' }}>Result</span>
          <strong style={{ display: 'block', marginTop: 'var(--ff-space-1)' }}>
            {resultFormat} · {resultSize}
          </strong>
        </div>
      </div>
      <Badge variant="success">{savingPercent}% SMALLER</Badge>
    </Card>
  );
}

export type WaveformPreviewProps = HTMLAttributes<HTMLDivElement> & {
  values?: readonly number[];
  active?: boolean;
  label?: string;
};

const defaultWaveform = [28, 52, 76, 44, 88, 62, 36, 70, 94, 58, 42, 80, 54, 68, 32, 74];

export function WaveformPreview({
  values = defaultWaveform,
  active = false,
  label = 'Audio waveform preview',
  style,
  ...props
}: WaveformPreviewProps) {
  return (
    <div
      {...props}
      data-ff-waveform={active ? 'active' : 'idle'}
      role="img"
      aria-label={label}
      style={{
        minHeight: 120,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: 'var(--ff-space-4)',
        borderRadius: 'var(--ff-radius-lg)',
        background: 'var(--ff-color-primary-soft)',
        ...style,
      }}
    >
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          aria-hidden="true"
          style={{
            width: 5,
            height: `${Math.min(Math.max(value, 8), 100)}%`,
            flex: '1 1 0',
            borderRadius: 'var(--ff-radius-full)',
            background: 'var(--ff-color-primary)',
            animationDelay: `${index * 45}ms`,
          }}
        />
      ))}
    </div>
  );
}
