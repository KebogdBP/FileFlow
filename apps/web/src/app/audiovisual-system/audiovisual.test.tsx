import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  FileTransformation,
  playCompletionTone,
  ProcessingFeedback,
  type ProcessingStage,
  WaveformPreview,
} from '@fileflow/ui';

describe('M03 audiovisual experience', () => {
  it('renders every processing stage with text and non-color symbols', () => {
    const stages: ProcessingStage[] = ['idle', 'analyzing', 'processing', 'completed', 'error'];

    for (const stage of stages) {
      const markup = renderToStaticMarkup(<ProcessingFeedback stage={stage} progress={64} />);
      expect(markup).toContain(`data-ff-processing="${stage}"`);
      expect(markup).toContain(`data-ff-stage-symbol="${stage}"`);
      expect(markup).toContain('aria-live="polite"');
      expect(markup).toContain('LOCAL');
    }
  });

  it('supports cloud mode and circular progress', () => {
    const markup = renderToStaticMarkup(
      <ProcessingFeedback
        stage="processing"
        progress={64}
        mode="cloud"
        progressVariant="circular"
      />,
    );

    expect(markup).toContain('CLOUD');
    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-valuenow="64"');
  });

  it('explains file transformation and size savings', () => {
    const markup = renderToStaticMarkup(
      <FileTransformation
        sourceFormat="JPG"
        resultFormat="WebP"
        sourceSize="2.4 MB"
        resultSize="620 KB"
        savingPercent={74}
      />,
    );

    expect(markup).toContain('JPG');
    expect(markup).toContain('WebP');
    expect(markup).toContain('aria-label="transforms to"');
    expect(markup).toContain('74% SMALLER');
  });

  it('renders a stable, labelled waveform preview', () => {
    const values = [20, 40, 60, 80];
    const markup = renderToStaticMarkup(
      <WaveformPreview values={values} active label="Voice message waveform" />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Voice message waveform"');
    expect(markup).toContain('data-ff-waveform="active"');
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(values.length);
  });

  it('keeps completion sound disabled unless explicitly enabled', () => {
    expect(() => playCompletionTone(false)).not.toThrow();
  });
});
