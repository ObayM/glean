import { describe, expect, it } from 'vitest';
import { extractSentence } from './sentence';

describe('extractSentence', () => {
  it('isolates the sentence containing the word offset', () => {
    const text = 'First sentence here. The cat sat on the mat. Third sentence follows.';
    const offset = text.indexOf('cat');
    expect(extractSentence(text, offset, 'cat')).toBe('The cat sat on the mat.');
  });

  it('does not split on an abbreviation period', () => {
    const text = 'Dr. Smith examined the ephemeral rash carefully.';
    const offset = text.indexOf('ephemeral');
    expect(extractSentence(text, offset, 'ephemeral')).toBe(text);
  });

  it('does not split on a decimal number', () => {
    const text = 'The price is 3.14 dollars for the ephemeral ticket.';
    const offset = text.indexOf('ephemeral');
    expect(extractSentence(text, offset, 'ephemeral')).toBe(text);
  });

  it('does not split inside a URL', () => {
    const text = 'Visit https://example.com/page for the ephemeral offer.';
    const offset = text.indexOf('ephemeral');
    expect(extractSentence(text, offset, 'ephemeral')).toBe(text);
  });

  it('treats an ellipsis as one boundary, not three', () => {
    const text = 'He paused... then said the word ephemeral out loud.';
    const offset = text.indexOf('ephemeral');
    expect(extractSentence(text, offset, 'ephemeral')).toBe('then said the word ephemeral out loud.');
  });

  it('splits on question and exclamation marks', () => {
    const text = 'Is this real? Yes, it is ephemeral! Nothing more.';
    const offset = text.indexOf('ephemeral');
    expect(extractSentence(text, offset, 'ephemeral')).toBe('Yes, it is ephemeral!');
  });

  it('falls back to searching for the word when the offset is invalid', () => {
    const text = 'A short sentence about the ephemeral moment.';
    expect(extractSentence(text, -1, 'ephemeral')).toBe(text);
  });

  it('returns an empty string for empty input', () => {
    expect(extractSentence('', 0, 'ephemeral')).toBe('');
  });

  it('truncates very long sentences around the word with ellipses', () => {
    const filler = 'word '.repeat(80);
    const text = `${filler}ephemeral ${filler}`;
    const offset = text.indexOf('ephemeral');
    const result = extractSentence(text, offset, 'ephemeral');
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain('ephemeral');
    expect(result.startsWith('...')).toBe(true);
    expect(result.endsWith('...')).toBe(true);
  });
});
