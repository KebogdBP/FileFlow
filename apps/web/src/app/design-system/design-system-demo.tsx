'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Progress, Select, Slider, Toggle } from '@fileflow/ui';

export function DesignSystemDemo() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [stripMetadata, setStripMetadata] = useState(true);
  const [quality, setQuality] = useState(80);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = theme;

    return () => root.removeAttribute('data-theme');
  }, [theme]);

  return (
    <div data-theme={theme === 'system' ? undefined : theme} className="ds-theme">
      <main className="ds-shell">
        <header className="ds-header">
          <div>
            <p className="ds-eyebrow">FILEFLOW · M02</p>
            <h1>Design System</h1>
            <p>Tokens, components, themes and accessibility foundations.</p>
          </div>
          <Select
            id="theme"
            label="Theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </header>
        <section className="ds-section">
          <h2>Buttons</h2>
          <div className="ds-row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Processing</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>
        <section className="ds-section">
          <h2>Badges</h2>
          <div className="ds-row">
            <Badge variant="local">LOCAL</Badge>
            <Badge variant="private">PRIVATE</Badge>
            <Badge variant="cloud">CLOUD</Badge>
            <Badge variant="success">SUCCESS</Badge>
            <Badge variant="warning">WARNING</Badge>
            <Badge variant="danger">ERROR</Badge>
          </div>
        </section>
        <section className="ds-grid">
          <Card>
            <h3>Form controls</h3>
            <div className="ds-stack">
              <Input
                id="filename"
                label="File name"
                defaultValue="mountains-sunrise.jpg"
                description="The final output name."
              />
              <Select id="format" label="Output format" defaultValue="webp">
                <option value="webp">WebP</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
              </Select>
              <Slider
                id="quality"
                label="Quality"
                min={20}
                max={100}
                value={quality}
                valueLabel={`${quality}%`}
                onChange={(event) => setQuality(Number(event.target.value))}
              />
              <Toggle
                checked={stripMetadata}
                label="Remove metadata"
                description="Protect location and camera information."
                onCheckedChange={setStripMetadata}
              />
            </div>
          </Card>
          <Card variant="selected">
            <h3>Processing preview</h3>
            <div className="ds-stack">
              <Progress value={quality} label="Image optimization" />
              <Progress indeterminate label="Preparing file" />
              <div className="ds-row">
                <Progress variant="circular" value={quality} label="Circular" />
                <Progress variant="circular" indeterminate label="Working" />
              </div>
              <div className="ds-result">
                <span>JPG · 2.4 MB</span>
                <span>→</span>
                <strong>WebP · 620 KB</strong>
              </div>
              <Badge variant="success">74% SMALLER</Badge>
            </div>
          </Card>
          <Card variant="glass">
            <h3>Surface variants</h3>
            <p>
              Glass surfaces are reserved for high-level workspace containers and selected hero
              panels.
            </p>
            <div className="ds-row">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
