import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage, { metadata } from './page';
import { MODULE_MARKER } from './constants';

const landingCss = readFileSync(resolve('src/app/globals.css'), 'utf8');

describe('privacy-first landing page', () => {
  const markup = renderToStaticMarkup(<HomePage />);

  it('presents the product positioning and current module', () => {
    expect(MODULE_MARKER).toBe('M05');
    expect(markup).toContain('Your files. Your device. Your call.');
    expect(markup).toContain('LOCAL-FIRST FILE TOOLS');
    expect(metadata.description).toContain('local processing');
  });

  it('makes local, cloud and retention behavior explicit', () => {
    expect(markup).toContain('On-device when possible');
    expect(markup).toContain('Cloud only when necessary');
    expect(markup).toContain('Temporary means temporary');
    expect(markup).toContain('No hidden uploads');
  });

  it('has landmark navigation and a logical heading hierarchy', () => {
    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('id="privacy-title"');
    expect(markup).toContain('id="how-title"');
    expect(markup).toContain('id="tools-title"');
  });

  it('keeps functional file input outside the M04 scope', () => {
    expect(markup).toContain('Workspace preview');
    expect(markup).not.toContain('type="file"');
  });

  it('defines responsive desktop, tablet and mobile layouts', () => {
    expect(landingCss).toContain('@media (max-width: 900px)');
    expect(landingCss).toContain('@media (max-width: 620px)');
    expect(landingCss).toMatch(
      /@media \(max-width: 900px\)[\s\S]*\.landing-hero\s*\{[^}]*grid-template-columns: 1fr;/,
    );
  });
});
