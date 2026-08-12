import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage, { metadata } from './page';
import { MODULE_MARKER } from './constants';

const landingCss = readFileSync(resolve('src/app/glass-home.css'), 'utf8');

describe('glass File Flow landing page', () => {
  const markup = renderToStaticMarkup(<HomePage />);

  it('presents the product positioning and current module', () => {
    expect(MODULE_MARKER).toBe('M22');
    expect(markup).toContain('FileFlow');
    expect(markup).toContain('Fast Forward Docs Images Video Audio');
    expect(markup).toContain('Private file workspace');
    expect(metadata.description).toContain('Convert images, video, audio, PDF and DOCX');
  });

  it('makes privacy and processing behavior explicit', () => {
    expect(markup).toContain('Inspect locally');
    expect(markup).toContain('Review the plan');
    expect(markup).toContain('Clean up');
    expect(markup).not.toContain('Fast by default');
  });

  it('has functional inputs and landmark navigation', () => {
    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup).toContain('type="file"');
    expect(markup).toContain('From a link');
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('id="tools-title"');
    expect(markup).toContain('Checked cloud · up to 2 GB');
    expect(markup).toContain('Direct to device · no size limit');
  });

  it('distinguishes current actions from roadmap media tools', () => {
    expect(markup).toContain('Compress PDF');
    expect(markup).toContain('Compress video');
    expect(markup).toContain('Video to MP4');
    expect(markup).toContain('Trim audio');
    expect(markup).toContain('19 working tools');
    expect(markup).toContain('Quick edit PDF');
    expect(markup.match(/: open tool/g)).toHaveLength(19);
    expect(markup).toContain('AI transcription');
    expect(markup).toContain('Roadmap');
    expect(markup.match(/ff-roadmap-card/g)).toHaveLength(7);
    expect(landingCss).toContain('scroll-snap-type: inline mandatory');
  });

  it('defines light, dark and responsive layouts', () => {
    expect(landingCss).toContain(":root[data-theme='dark']");
    expect(landingCss).toContain('@media (max-width: 790px)');
    expect(landingCss).toContain('@media (max-width: 560px)');
    expect(landingCss).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
