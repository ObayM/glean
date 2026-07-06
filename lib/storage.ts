import { browser } from 'wxt/browser';
import type { LlmProvider, RecentWord, Settings, Stats, WordData } from './types';

export const DEFAULT_DECK = 'Glean';
const MAX_RECENT = 20;
const CACHE_LIMIT = 300;

export const DEFAULT_SETTINGS: Settings = {
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

interface CacheState {
  entries: Record<string, WordData>;
  order: string[];
}

const EMPTY_CACHE: CacheState = { entries: {}, order: [] };

function cacheKey(provider: string, model: string, word: string, sentence: string): string {
  const normalizedSentence = sentence.trim().replace(/\s+/g, ' ');
  return `${provider}|${model}|${word.toLowerCase()}|${normalizedSentence}`;
}

async function getCache(): Promise<CacheState> {
  const { llmCache } = await read({ llmCache: EMPTY_CACHE });
  return llmCache;
}

export async function getCachedWord(
  provider: string,
  model: string,
  word: string,
  sentence: string
): Promise<WordData | null> {
  const cache = await getCache();
  return cache.entries[cacheKey(provider, model, word, sentence)] ?? null;
}

export function putCachedWord(
  provider: string,
  model: string,
  word: string,
  sentence: string,
  data: WordData
): Promise<void> {
  return enqueueWrite(async () => {
    const cache = await getCache();
    const key = cacheKey(provider, model, word, sentence);

    const order = cache.order.filter((k) => k !== key);
    order.push(key);
    const entries = { ...cache.entries, [key]: data };

    while (order.length > CACHE_LIMIT) {
      const evicted = order.shift();
      if (evicted) delete entries[evicted];
    }

    await write({ llmCache: { entries, order } });
  });
}

