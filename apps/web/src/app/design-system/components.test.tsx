import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Badge, Button, Card, Input, Progress, Select, Slider, Toggle } from '@fileflow/ui';

describe('M02 UI components', () => {
  it('renders Button variants, states and accessible loading state', () => {
    const markup = renderToStaticMarkup(
      <Button variant="danger" size="lg" loading>
        Delete
      </Button>,
    );

    expect(markup).toContain('data-ff-button');
    expect(markup).toContain('data-variant="danger"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled');
    expect(markup).toContain('Processing…');
  });

  it('renders Card variants and makes interactive cards keyboard reachable', () => {
    const markup = renderToStaticMarkup(<Card variant="interactive">Open</Card>);

    expect(markup).toContain('data-ff-card="interactive"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('role="button"');
  });

  it('renders every Badge variant with semantic content', () => {
    const variants = [
      'local',
      'private',
      'cloud',
      'success',
      'warning',
      'danger',
      'neutral',
    ] as const;
    const markup = renderToStaticMarkup(
      <>
        {variants.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </>,
    );

    for (const variant of variants) expect(markup).toContain(`>${variant}</span>`);
  });

  it('connects Input label, description and error semantics', () => {
    const markup = renderToStaticMarkup(
      <Input id="filename" label="File" description="Choose a name" error="Required" />,
    );

    expect(markup).toContain('for="filename"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="filename-error"');
    expect(markup).toContain('role="alert"');
  });

  it('connects Select label and error semantics', () => {
    const markup = renderToStaticMarkup(
      <Select id="format" label="Format" error="Unsupported">
        <option>WebP</option>
      </Select>,
    );

    expect(markup).toContain('for="format"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('format-error');
  });

  it('renders Slider as a labelled range control', () => {
    const markup = renderToStaticMarkup(
      <Slider id="quality" label="Quality" valueLabel="80%" defaultValue={80} />,
    );

    expect(markup).toContain('type="range"');
    expect(markup).toContain('for="quality"');
    expect(markup).toContain('80%');
  });

  it('renders Toggle with switch semantics and invokes its state callback', () => {
    const onCheckedChange = vi.fn();
    const element = Toggle({ checked: false, label: 'Private', onCheckedChange });

    expect(element.props.role).toBe('switch');
    expect(element.props['aria-checked']).toBe(false);
    element.props.onClick();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders linear, circular and indeterminate Progress accessibly', () => {
    const linear = renderToStaticMarkup(<Progress value={40} label="Upload" />);
    const circular = renderToStaticMarkup(
      <Progress variant="circular" value={75} label="Convert" />,
    );
    const indeterminate = renderToStaticMarkup(<Progress indeterminate label="Working" />);

    expect(linear).toContain('aria-valuenow="40"');
    expect(circular).toContain('<svg');
    expect(circular).toContain('aria-valuetext="75%"');
    expect(indeterminate).not.toContain('aria-valuenow');
    expect(indeterminate).toContain('aria-valuetext="Working"');
    expect(indeterminate).toContain('data-ff-progress-indeterminate');
  });
});
