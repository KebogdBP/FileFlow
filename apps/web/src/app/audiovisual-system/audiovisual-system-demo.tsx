'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  FileTransformation,
  playCompletionTone,
  ProcessingFeedback,
  type ProcessingStage,
  Toggle,
  WaveformPreview,
} from '@fileflow/ui';

const stages: ProcessingStage[] = ['idle', 'analyzing', 'processing', 'completed', 'error'];

export function AudiovisualSystemDemo() {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [waveformActive, setWaveformActive] = useState(false);

  function selectStage(nextStage: ProcessingStage) {
    setStage(nextStage);
    if (nextStage === 'completed') playCompletionTone(soundEnabled);
  }

  return (
    <main className="av-shell">
      <header className="av-header">
        <p className="av-eyebrow">FILEFLOW · M03</p>
        <h1>Audiovisual Experience</h1>
        <p>Motion and feedback that explain what FileFlow is doing without demanding attention.</p>
      </header>

      <section className="av-section" aria-labelledby="processing-title">
        <div className="av-section-heading">
          <div>
            <h2 id="processing-title">Processing states</h2>
            <p>Choose a state to inspect its visual and screen-reader feedback.</p>
          </div>
          <Toggle
            checked={soundEnabled}
            label="Completion sound"
            description="Off by default. Plays only after opt-in."
            onCheckedChange={setSoundEnabled}
          />
        </div>
        <div className="av-controls" aria-label="Processing state controls">
          {stages.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={stage === item ? 'primary' : 'secondary'}
              aria-pressed={stage === item}
              onClick={() => selectStage(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="av-feedback-grid">
          <ProcessingFeedback stage={stage} progress={64} mode="local" />
          <ProcessingFeedback stage={stage} progress={64} mode="cloud" progressVariant="circular" />
        </div>
      </section>

      <section className="av-grid" aria-label="Transformation and audio previews">
        <FileTransformation
          sourceFormat="JPG"
          resultFormat="WebP"
          sourceSize="2.4 MB"
          resultSize="620 KB"
          savingPercent={74}
        />
        <Card>
          <div className="av-card-heading">
            <div>
              <h2>Waveform preview</h2>
              <p>Stable geometry prevents layout shifts.</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={waveformActive}
              onClick={() => setWaveformActive((active) => !active)}
            >
              {waveformActive ? 'Pause' : 'Preview'}
            </Button>
          </div>
          <WaveformPreview active={waveformActive} />
        </Card>
      </section>

      <Card className="av-note">
        <strong>Reduced motion is automatic.</strong>
        <p>
          When the operating system requests reduced motion, animation stops while every label,
          state and result remains visible.
        </p>
      </Card>
    </main>
  );
}
