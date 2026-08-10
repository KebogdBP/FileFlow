import { describe, expect, it } from 'vitest';
import { defaultCloudParameters, parametersForOperation } from './cloud-parameters';

describe('cloud operation parameter isolation', () => {
  it('removes stale PDF settings while switching between converters', () => {
    const stale = { ...defaultCloudParameters('compress-pdf'), dpi: 300 };

    expect(parametersForOperation('pdf-to-jpg', stale)).toEqual({
      page: 1,
      dpi: 300,
      quality: 85,
    });
    expect(parametersForOperation('split-pdf', stale)).toEqual({ pages: 'all' });
    expect(parametersForOperation('compress-pdf', stale)).toEqual({ quality: 'balanced' });
  });

  it('sends only the allowlisted settings for parameterless operations', () => {
    expect(parametersForOperation('pdf-to-docx', { quality: 'balanced', dpi: 300 })).toEqual({});
    expect(parametersForOperation('merge-pdf', { pages: 'all' })).toEqual({});
  });
});
