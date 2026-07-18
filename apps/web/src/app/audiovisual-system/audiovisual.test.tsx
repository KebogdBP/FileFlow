import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FileTransformation,
  playCompletionTone,
  ProcessingFeedback,
  type ProcessingStage,
  WaveformPreview,
} from '@fileflow/ui';

const motionCss = readFileSync(resolve('src/app/motion-system.css'), 'utf8');
const pageCss = readFileSync(resolve('src/app/audiovisual-system/page.css'), 'utf8');

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const AudioContext = vi.fn();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContext });

    playCompletionTone(false);

    expect(AudioContext).not.toHaveBeenCalled();
  });

  it('plays and disposes the completion tone after explicit opt-in', () => {
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const connectOscillator = vi.fn();
    const connectGain = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const close = vi.fn();
    let onEnded: (() => void) | undefined;
    const oscillator = {
      type: 'sine',
      frequency: { setValueAtTime },
      connect: connectOscillator,
      start,
      stop,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        onEnded = listener;
      }),
    };
    const gain = {
      gain: { setValueAtTime, exponentialRampToValueAtTime },
      connect: connectGain,
    };
    const AudioContext = vi.fn(function AudioContextMock() {
      return {
        currentTime: 1,
        destination: {},
        createOscillator: () => oscillator,
        createGain: () => gain,
        close,
      };
    });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContext });

    playCompletionTone(true);
    onEnded?.();

    expect(AudioContext).toHaveBeenCalledOnce();
    expect(connectOscillator).toHaveBeenCalledWith(gain);
    expect(start).toHaveBeenCalledWith(1);
    expect(stop).toHaveBeenCalledWith(1.21);
    expect(close).toHaveBeenCalledOnce();
  });

  it('provides reveal motion and a complete reduced-motion alternative', () => {
    expect(motionCss).toContain('@keyframes ff-reveal');
    expect(motionCss).toMatch(/\[data-ff-reveal\]\s*\{[^}]*animation:/s);
    expect(motionCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\[data-ff-reveal\][\s\S]*animation: none/,
    );
    expect(motionCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\[data-ff-waveform='active'\] > span[\s\S]*animation: none/,
    );
  });

  it('collapses the demo to one column at the documented mobile breakpoint', () => {
    expect(pageCss).toContain('@media (max-width: 768px)');
    expect(pageCss).toMatch(
      /@media \(max-width: 768px\)[\s\S]*\.av-feedback-grid,[\s\S]*\.av-grid\s*\{\s*grid-template-columns: 1fr;/,
    );
  });
});
