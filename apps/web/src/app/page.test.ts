import { describe, expect, it } from 'vitest';
import { MODULE_MARKER } from './constants';

describe('FileFlow foundation', () => {
  it('exposes the current module marker used by the home page', () => {
    expect(MODULE_MARKER).toBe('M02');
  });
});
