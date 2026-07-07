import { describe, expect, it } from 'vitest';
import { getMWAudioSubdir } from './audio-fetcher';

describe('getMWAudioSubdir', () => {
  it('routes "bix"-prefixed filenames to the bix subdir', () => {
    expect(getMWAudioSubdir('bix_snack.wav')).toBe('bix');
  });

  it('routes "gg"-prefixed filenames to the gg subdir', () => {
    expect(getMWAudioSubdir('gg_word.wav')).toBe('gg');
  });

  it('routes filenames starting with a non-letter to the number subdir', () => {
    expect(getMWAudioSubdir('1234.wav')).toBe('number');
    expect(getMWAudioSubdir('_underscore.wav')).toBe('number');
  });

  it('falls back to the first character for everything else', () => {
    expect(getMWAudioSubdir('snack001.wav')).toBe('s');
    expect(getMWAudioSubdir('happy01.wav')).toBe('h');
  });
});
