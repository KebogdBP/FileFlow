import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CloudJobTool } from './cloud-job-tool';

describe('cloud sign-in continuity', () => {
  it('opens authentication separately so the selected file stays in the workspace tab', () => {
    const file = new File(['%PDF-1.7'], 'resume.pdf', { type: 'application/pdf' });
    const markup = renderToStaticMarkup(
      <CloudJobTool operationId="compress-pdf" files={[file]} language="en" />,
    );

    expect(markup).toContain('target="fileflow-account"');
    expect(markup).toContain('return_to=%2F%23workspace-flow');
    expect(markup).toContain('popup=1');
  });
});
