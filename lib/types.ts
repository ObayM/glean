import type { SerializedError } from './errors';

export type LlmProvider = 'hackclub' | 'openrouter';

export interface Settings {
  llmProvider: LlmProvider;
  hackclubApiKey: string;
  hackclubModel: string;
  openrouterApiKey: string;
  openrouterModel: string;
  mwKey: string;
  deckName: string;
}

export interface WordData {
  word: string;
  definition: string;
  meaning: string | null;
  example: string;
  language: string;
  sentence: string;
  audioUrl: string | null;
  phonetic: string | null;
  pageUrl: string;
}

export interface RecentWord {
  word: string;
  definition: string;
  meaning: string | null;
  sentence: string;
  example: string;
  timestamp: number;
}

export interface Stats {
  todayCount: number;
  totalCount: number;
  todayDate: string;
}

export interface AnkiStatus {
  connected: boolean;
  version?: number;
  error?: string;
}

export interface TestKeyResult {
  valid: boolean;
  error?: string;
}

export interface ProcessWordInput {
  word: string;
  sentence: string;
  pageUrl: string;
}

export interface AddToAnkiInput {
  word: string;
  definition: string;
  meaning: string | null;
  sentence: string;
  example: string;
  language: string;
  audioUrl: string | null;
  pageUrl: string;
  force?: boolean;
}

export interface AddToAnkiResult {
  status: 'added' | 'duplicate';
  noteId?: number;
}

export interface TestKeyInput {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
}

export interface ProtocolMap {
  PROCESS_WORD: { input: ProcessWordInput; output: WordData };
  ADD_TO_ANKI: { input: AddToAnkiInput; output: AddToAnkiResult };
  CHECK_ANKI: { input: void; output: AnkiStatus };
  GET_DECKS: { input: void; output: { decks: string[] } };
  CREATE_DECK: { input: { deckName: string }; output: { success: true } };
  TEST_API_KEY: { input: TestKeyInput; output: TestKeyResult };
  PLAY_AUDIO: { input: { audioUrl: string }; output: { success: true } };
}

export type MessageType = keyof ProtocolMap;

export type Result<T> = { ok: true; data: T } | { ok: false; error: SerializedError };
