import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PrivacyPage from './privacy/page';
import SecurityPage from './security/page';
import TermsPage from './terms/page';

describe('launch legal pages', () => {
  it('states the cloud retention promise on the privacy page', () => {
    const markup = renderToStaticMarkup(<PrivacyPage />);
    expect(markup).toContain('Privacy you can verify');
    expect(markup).toContain('Temporary cloud files');
  });

  it('publishes responsible disclosure guidance', () => {
    const markup = renderToStaticMarkup(<SecurityPage />);
    expect(markup).toContain('Security at FileFlow');
    expect(markup).toContain('security@fileflow.app');
  });

  it('describes beta availability in the terms', () => {
    expect(renderToStaticMarkup(<TermsPage />)).toContain('closed beta');
  });
});
