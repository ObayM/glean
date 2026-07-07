import { describe, expect, it } from 'vitest';
import { isSupportedLanguage, languageLabel, SUPPORTED_LANGUAGES } from './languages';

describe('isSupportedLanguage', () => {
  it('accepts every code in SUPPORTED_LANGUAGES', () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      expect(isSupportedLanguage(code)).toBe(true);
    }
  });

  it('rejects unsupported or missing codes', () => {
    expect(isSupportedLanguage('xx')).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
  });
});

describe('languageLabel', () => {
  it('returns the human label for a known code', () => {
    expect(languageLabel('de')).toBe('German');
  });

  it('falls back to the uppercased code for an unknown language', () => {
    expect(languageLabel('xx')).toBe('XX');
  });
});
