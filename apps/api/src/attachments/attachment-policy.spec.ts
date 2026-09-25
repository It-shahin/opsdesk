import { describe, expect, it } from '@jest/globals';

import {
  filenameMatchesContentType,
  isAllowedContentType,
  sanitizeFilename,
} from './attachment-policy.js';

describe('attachment policy', () => {
  it('sanitizes path-like filenames', () => {
    const filename = sanitizeFilename('../..\\invoice\u0000.pdf');

    expect(filename).toBe('_.._invoice.pdf');

    expect(filename).not.toMatch(/[\\/]/);

    expect(
      [...filename].some((character) => {
        const code = character.charCodeAt(0);

        return code < 32 || code === 127;
      }),
    ).toBe(false);
  });

  it('allows supported MIME types', () => {
    expect(isAllowedContentType('application/pdf')).toBe(true);
  });

  it('rejects active web content', () => {
    expect(isAllowedContentType('text/html')).toBe(false);

    expect(isAllowedContentType('image/svg+xml')).toBe(false);
  });

  it('checks filename/type consistency', () => {
    expect(filenameMatchesContentType('report.pdf', 'application/pdf')).toBe(
      true,
    );

    expect(filenameMatchesContentType('report.exe', 'application/pdf')).toBe(
      false,
    );
  });
});
