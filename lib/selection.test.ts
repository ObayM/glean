import { describe, expect, it } from 'vitest';
import { cleanWord, normalizeSelection, wordTokens } from './selection';

describe('normalizeSelection', () => {
  it('collapses PDF line-break artifacts into single spaces', () => {
    expect(normalizeSelection('The quick\nbrown   fox\n\njumps')).toBe('The quick brown fox jumps');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeSelection('  hello world  ')).toBe('hello world');
  });
});

describe('cleanWord', () => {
  it('strips punctuation but keeps letters, marks, numbers, apostrophes, and hyphens', () => {
    expect(cleanWord('"well-known,"')).toBe('well-known');
    expect(cleanWord("don't!")).toBe("don't");
  });

  it('returns an empty string for pure punctuation', () => {
    expect(cleanWord('...')).toBe('');
  });
});

describe('wordTokens', () => {
  it('splits a sentence into its constituent words', () => {
    expect(wordTokens('The quick, brown fox.')).toEqual(['The', 'quick,', 'brown', 'fox.']);
  });

  it('drops tokens that contain no word characters', () => {
    expect(wordTokens('hello -- world')).toEqual(['hello', 'world']);
  });
});
