import type { WordData } from './types';

export type CachedWordData = Omit<WordData, 'pageUrl'>;

export function toCachedWord(data: WordData): CachedWordData {
  const { pageUrl: _pageUrl, ...cached } = data;
  return cached;
}

export function restoreCachedWord(data: CachedWordData, pageUrl: string): WordData {
  return { ...data, pageUrl };
}
