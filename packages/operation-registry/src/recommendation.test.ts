import { describe, expect, it } from 'vitest';
import { availableOperations, operations, recommendOperation } from './index';

describe('M07 recommendation and explainability engine', () => {
  it('keeps operation identifiers unique', () => {
    const ids = operations.map((operation) => operation.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recommends a local, privacy-preserving image plan', () => {
    const result = recommendOperation({
      category: 'image',
      mime: 'image/jpeg',
      size: 4 * 1024 * 1024,
      confidence: 'verified',
    });

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        operationId: 'optimize-image',
        mode: 'local',
        privacy: expect.stringContaining('not uploaded'),
      },
    });
    if (result.status === 'ready') {
      expect(result.plan.defaults.length).toBeGreaterThanOrEqual(2);
      expect(result.plan.tradeoffs.length).toBeGreaterThan(0);
    }
  });

  it('preserves animation in the safe GIF defaults', () => {
    const result = recommendOperation({
      category: 'image',
      mime: 'image/gif',
      size: 2_000_000,
      confidence: 'verified',
    });

    expect(result).toMatchObject({
      status: 'ready',
      plan: { expectation: expect.stringContaining('Animation will be preserved') },
    });
  });

  it('makes protected cloud processing explicit for video', () => {
    const result = recommendOperation({
      category: 'video',
      mime: 'video/mp4',
      size: 80_000_000,
      confidence: 'verified',
    });

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        mode: 'cloud',
        reason: expect.stringContaining('resource-intensive'),
        privacy: expect.stringContaining('automatically removed'),
      },
    });
  });

  it('selects audio mode from the reliable local size threshold', () => {
    const local = recommendOperation({
      category: 'audio',
      size: 10_000_000,
      confidence: 'verified',
    });
    const cloud = recommendOperation({
      category: 'audio',
      size: 300 * 1024 * 1024,
      confidence: 'verified',
    });

    expect(local).toMatchObject({ status: 'ready', plan: { mode: 'local' } });
    expect(cloud).toMatchObject({ status: 'ready', plan: { mode: 'cloud' } });
  });

  it('blocks unsafe recommendations when file identity conflicts', () => {
    expect(
      recommendOperation({ category: 'pdf', size: 10_000, confidence: 'mismatch' }),
    ).toMatchObject({ status: 'blocked', reason: expect.stringContaining('Confirm') });
  });

  it('returns an honest unsupported state for unknown categories', () => {
    expect(
      recommendOperation({ category: 'archive', size: 10_000, confidence: 'unverified' }),
    ).toMatchObject({ status: 'unsupported' });
  });

  it('exposes reviewed intents and builds a plan for the selected backend operation', () => {
    const context = { category: 'pdf' as const, size: 10_000, confidence: 'verified' as const };
    expect(availableOperations(context).map((operation) => operation.id)).toEqual([
      'compress-pdf',
      'split-pdf',
      'pdf-to-jpg',
    ]);
    expect(recommendOperation(context, 'pdf-to-jpg')).toMatchObject({
      status: 'ready',
      plan: { operationId: 'pdf-to-jpg', mode: 'cloud' },
    });
    expect(recommendOperation(context, 'trim-audio')).toMatchObject({ status: 'unsupported' });
  });
});
