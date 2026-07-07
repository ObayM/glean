import { describe, expect, it } from 'vitest';
import { buildDuplicateQuery } from './anki-connect';

describe('buildDuplicateQuery', () => {
  it('uses a single clause when the word has no letter-cased first character', () => {
    expect(buildDuplicateQuery('Glean', '123')).toBe('deck:"Glean" "Word:123"');
  });

  it('also matches the title-cased form for a lowercase word', () => {
    expect(buildDuplicateQuery('Glean', 'ephemeral')).toBe(
      'deck:"Glean" ("Word:ephemeral" or "Word:Ephemeral")'
    );
  });

  it('normalizes an already-capitalized or all-caps word to its lowercase form', () => {
    expect(buildDuplicateQuery('Glean', 'NASA')).toBe(
      'deck:"Glean" ("Word:nasa" or "Word:Nasa")'
    );
  });

  it('trims surrounding whitespace before comparing casing', () => {
    expect(buildDuplicateQuery('Glean', '  123  ')).toBe('deck:"Glean" "Word:123"');
  });

  it('escapes quotes and backslashes in both the deck name and the word', () => {
    expect(buildDuplicateQuery('My "Deck"', 'back\\slash')).toBe(
      'deck:"My \\"Deck\\"" ("Word:back\\\\slash" or "Word:Back\\\\slash")'
    );
  });
});
