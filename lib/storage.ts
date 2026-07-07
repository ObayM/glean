import { browser } from 'wxt/browser';
import type { DictionaryDefinition } from './audio-fetcher';
import type { LlmProvider, RecentWord, Settings, Stats, WordData } from './types';

export const DEFAULT_DECK = 'Glean';
const MAX_RECENT = 20;
const CACHE_LIMIT = 300;

export const DEFAULT_SETTINGS: Settings = {
  lookupMode: 'ai',
  llmProvider: 'hackclub',
  hackclubApiKey: '',
  hackclubModel: '',
  openrouterApiKey: '',
  openrouterModel: '',
  mwKey: '',
  deckName: DEFAULT_DECK,
};

async function read<T>(defaults: T): Promise<T> {
  const result = await browser.storage.local.get(defaults as Record<string, unknown>);
  return { ...defaults, ...result } as T;
}

async function write(items: Record<string, unknown>): Promise<void> {
  await browser.storage.local.set(items);
}

export function getSettings(): Promise<Settings> {
  return read(DEFAULT_SETTINGS);
}

export function setSettings(partial: Partial<Settings>): Promise<void> {
  return write(partial);
}

export interface ActiveCredentials {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

export function activeCredentials(
  settings: Settings,
  defaultModel: (p: LlmProvider) => string
): ActiveCredentials {
  const provider = settings.llmProvider || 'hackclub';
  const apiKey = provider === 'openrouter' ? settings.openrouterApiKey : settings.hackclubApiKey;
  const model =
    (provider === 'openrouter' ? settings.openrouterModel : settings.hackclubModel) ||
    defaultModel(provider);
  return { provider, apiKey, model };
}

interface HistoryState {
  recentWords: RecentWord[];
  stats: Stats;
}

const EMPTY_HISTORY: HistoryState = {
  recentWords: [],
  stats: { todayCount: 0, totalCount: 0, todayDate: '' },
};

export function getHistory(): Promise<HistoryState> {
  return read(EMPTY_HISTORY);
}

let writeQueue = Promise.resolve();

async function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function recordAddedWord(entry: RecentWord): Promise<void> {
  return enqueueWrite(async () => {
    const { recentWords, stats } = await getHistory();

    const nextRecent = [...recentWords, entry];
    while (nextRecent.length > MAX_RECENT) nextRecent.shift();

    const todayStr = new Date().toDateString();
    const nextStats: Stats = { ...stats };
    if (nextStats.todayDate !== todayStr) {
      nextStats.todayCount = 0;
      nextStats.todayDate = todayStr;
    }
    nextStats.todayCount += 1;
    nextStats.totalCount += 1;

    await write({ recentWords: nextRecent, stats: nextStats });
  });
}

interface LruCacheState<T> {
  entries: Record<string, T>;
  order: string[];
}

async function getLruEntry<T>(storageKey: string, key: string): Promise<T | null> {
  const empty: LruCacheState<T> = { entries: {}, order: [] };
  const result = await read({ [storageKey]: empty } as Record<string, LruCacheState<T>>);
  return result[storageKey]!.entries[key] ?? null;
}

function putLruEntry<T>(storageKey: string, key: string, value: T): Promise<void> {
  return enqueueWrite(async () => {
    const empty: LruCacheState<T> = { entries: {}, order: [] };
    const result = await read({ [storageKey]: empty } as Record<string, LruCacheState<T>>);
    const cache = result[storageKey]!;

    const order = cache.order.filter((k) => k !== key);
    order.push(key);
    const entries = { ...cache.entries, [key]: value };

    while (order.length > CACHE_LIMIT) {
      const evicted = order.shift();
      if (evicted) delete entries[evicted];
    }

    await write({ [storageKey]: { entries, order } });
  });
}

function llmCacheKey(provider: string, model: string, word: string, sentence: string): string {
  const normalizedSentence = sentence.trim().replace(/\s+/g, ' ');
  return `${provider}|${model}|${word.toLowerCase()}|${normalizedSentence}`;
}

export function getCachedWord(
  provider: string,
  model: string,
  word: string,
  sentence: string
): Promise<WordData | null> {
  return getLruEntry<WordData>('llmCache', llmCacheKey(provider, model, word, sentence));
}

export function putCachedWord(
  provider: string,
  model: string,
  word: string,
  sentence: string,
  data: WordData
): Promise<void> {
  return putLruEntry<WordData>('llmCache', llmCacheKey(provider, model, word, sentence), data);
}

export interface DictionaryWordData {
  phonetic: string | null;
  audioUrl: string | null;
  senses: DictionaryDefinition[];
}

export function getCachedDictionaryWord(word: string): Promise<DictionaryWordData | null> {
  return getLruEntry<DictionaryWordData>('dictionaryCache', word.trim().toLowerCase());
}

export function putCachedDictionaryWord(word: string, data: DictionaryWordData): Promise<void> {
  return putLruEntry<DictionaryWordData>('dictionaryCache', word.trim().toLowerCase(), data);
}

