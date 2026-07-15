import { describe, expect, it } from 'vitest';
import { restoreCachedWord, toCachedWord } from './cache';
import type { WordData } from './types';

const wordData: WordData = {
  word: 'nice',
  definition: 'to be cute ig?',
  meaning: null,
  example: 'They are so nice.',
  language: 'en',
  sentence: 'Be nice to the reviewers.',
  audioUrl: null,
  phonetic: null,
  pageUrl: 'https://old.example/smth',
};

describe('cached word data', () => {
  it('does not persist a page URL as part of the reusable lookup result', () => {
    expect(toCachedWord(wordData)).not.toHaveProperty('pageUrl');
  });

  it('restores the current page URL when reusing a cached lookup', () => {
    const restored = restoreCachedWord(toCachedWord(wordData), 'https://current.example/article');
    expect(restored.pageUrl).toBe('https://current.example/article');
  });
});
