import {
  DEFAULT_FIELD_MAPPING,
  DEFAULT_NOTE_TYPE_NAME,
  addNote,
  ensureDeck,
  ensureNoteType,
  getDeckNames,
  getModelFieldNames,
  getModelNames,
  testConnection,
  wordExistsInDeck,
} from '../lib/anki-connect';
import { fetchAudio, fetchFreeDictionaryEntry } from '../lib/audio-fetcher';
import { TRIGGER_COMMAND_ID } from '../lib/constants';
import { AppError } from '../lib/errors';
import { escapeHtml, highlightToHtml } from '../lib/highlight';
import { fetchWithTimeout } from '../lib/http';
import { PROVIDERS, getDefaultModel, getWordData, testApiKey } from '../lib/llm-api';
import { registerHandlers, sendToTab } from '../lib/messaging';
import { normalizeSelection } from '../lib/selection';
import {
  DEFAULT_DECK,
  DEFAULT_SETTINGS,
  activeCredentials,
  getCachedDictionaryWord,
  getCachedWord,
  getSettings,
  putCachedDictionaryWord,
  putCachedWord,
  recordAddedWord,
} from '../lib/storage';
import type {
  AddToAnkiInput,
  AddToAnkiResult,
  AnkiStatus,
  DictionaryLookup,
  OffscreenMessage,
  ProcessWordInput,
  TestKeyInput,
  WordData,
} from '../lib/types';

const CONTEXT_MENU_ID = 'glean-ctx-menu';
const inFlightRequests = new Map<string, Promise<WordData>>();
let noteTypeEnsured = false;
const ensuredDecks = new Set<string>();

async function fetchAudioAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('[Glean] Failed to fetch audio as base64:', err);
    return null;
  }
}

async function handleProcessWord({ word, sentence, pageUrl }: ProcessWordInput): Promise<WordData> {
  const settings = await getSettings();
  const { provider, apiKey, model } = activeCredentials(settings, getDefaultModel);

  if (!apiKey) {
    const label = provider === 'openrouter' ? 'OpenRouter' : 'Hack Club AI';
    throw new AppError('NO_API_KEY', `API key not configured. Set your ${label} key in Glean settings.`);
  }

  const key = `${provider}|${model}|${word.toLowerCase()}|${sentence}`;
  const existing = inFlightRequests.get(key);
  if (existing) {
    const result = await existing;
    return { ...result, pageUrl };
  }

  const promise = (async () => {
    const cached = await getCachedWord(provider, model, word, sentence);
    if (cached) {
      return cached;
    }

    const dictionaryEntry = await fetchFreeDictionaryEntry(word);
    const llmResult = await getWordData(word, sentence, provider, apiKey, model, dictionaryEntry.definitions);
    const audioResult = await fetchAudio(word, settings.mwKey, llmResult.language, dictionaryEntry);

    const data: WordData = {
      word,
      definition: llmResult.definition,
      meaning: llmResult.meaning,
      example: llmResult.example,
      language: llmResult.language,
      audioUrl: audioResult.audioUrl,
      phonetic: audioResult.phonetic,
      sentence,
      pageUrl,
    };

    await putCachedWord(provider, model, word, sentence, data);
    return data;
  })();

  inFlightRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(key);
  }
}

async function handleLookupDictionary({ word, sentence, pageUrl }: ProcessWordInput): Promise<DictionaryLookup> {
  const cached = await getCachedDictionaryWord(word);
  if (cached) {
    return { word, sentence, pageUrl, ...cached };
  }

  const settings = await getSettings();
  const dictionaryEntry = await fetchFreeDictionaryEntry(word);

  if (dictionaryEntry.definitions.length === 0) {
    throw new AppError('NO_DICTIONARY_ENTRY', `No dictionary entry found for "${word}".`);
  }

  const audioResult = await fetchAudio(word, settings.mwKey, 'en', dictionaryEntry);
  const wordData = {
    phonetic: audioResult.phonetic,
    audioUrl: audioResult.audioUrl,
    senses: dictionaryEntry.definitions,
  };

  await putCachedDictionaryWord(word, wordData);
  return { word, sentence, pageUrl, ...wordData };
}

async function handleAddToAnki(input: AddToAnkiInput): Promise<AddToAnkiResult> {
  const { word, definition, meaning, sentence, example, language, audioUrl, pageUrl, force } = input;
  const settings = await getSettings();
  const deckName = settings.deckName || DEFAULT_DECK;
  const noteTypeName = settings.noteTypeName || DEFAULT_NOTE_TYPE_NAME;
  const mapping = settings.fieldMapping || DEFAULT_FIELD_MAPPING;

  if (noteTypeName === DEFAULT_NOTE_TYPE_NAME) {
    if (!noteTypeEnsured) {
      await ensureNoteType();
      noteTypeEnsured = true;
    }
  }
  if (!ensuredDecks.has(deckName)) {
    await ensureDeck(deckName);
    ensuredDecks.add(deckName);
  }

  const wordField = mapping.word || 'Word';
  if (!force && (await wordExistsInDeck(deckName, word, wordField))) {
    return { status: 'duplicate' };
  }

  const fields: Record<string, string> = {};
  const setField = (fieldName: string | undefined, value: string) => {
    if (fieldName) fields[fieldName] = value;
  };
  setField(wordField, escapeHtml(word));
  setField(mapping.meaning, meaning ? escapeHtml(meaning) : '');
  setField(mapping.definition || 'Definition', escapeHtml(definition));
  setField(mapping.sentence, sentence ? highlightToHtml(sentence, word) : '');
  setField(mapping.example, example ? escapeHtml(example) : '');
  setField(mapping.sound, '');
  setField(mapping.image, '');
  setField(mapping.sourceUrl, pageUrl ? escapeHtml(pageUrl) : '');

  const audio = [];
  if (audioUrl && mapping.sound) {
    const safeWord = word.toLowerCase().replace(/[^a-z0-9-]/g, '_');
    const base64Data = await fetchAudioAsBase64(audioUrl);
    if (base64Data) {
      audio.push({ data: base64Data, filename: `glean_${safeWord}.mp3`, fields: [mapping.sound] });
    }
  }

  const tags = ['glean', `lang-${language || 'en'}`];
  const noteId = await addNote(deckName, noteTypeName, fields, tags, audio, Boolean(force));

  try {
    await recordAddedWord({ word, definition, meaning, sentence, example, timestamp: Date.now() });
  } catch (err) {
    console.error('[Glean] Failed to update history:', err);
  }

  return { status: 'added', noteId };
}


async function handleCheckAnki(): Promise<AnkiStatus> {
  try {
    const version = await testConnection();
    return { connected: true, version };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleTestApiKey({ provider, apiKey, model }: TestKeyInput) {
  return testApiKey(provider, apiKey, model || getDefaultModel(provider));
}

async function playAudioOffscreen(audioUrl: string): Promise<void> {
  const hasDocument = await browser.offscreen.hasDocument();
  if (!hasDocument) {
    await browser.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [browser.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Play pronunciation audio files for words',
    });
  }
  const message: OffscreenMessage = { target: 'offscreen', type: 'PLAY_AUDIO', payload: { audioUrl } };
  browser.runtime.sendMessage(message);
}

export default defineBackground(() => {
  registerHandlers({
    PROCESS_WORD: handleProcessWord,
    LOOKUP_DICTIONARY: handleLookupDictionary,
    ADD_TO_ANKI: handleAddToAnki,
    CHECK_ANKI: handleCheckAnki,
    GET_DECKS: async () => ({ decks: await getDeckNames() }),
    CREATE_DECK: async ({ deckName }) => {
      await ensureDeck(deckName);
      return { success: true };
    },
    TEST_API_KEY: handleTestApiKey,
    PLAY_AUDIO: async ({ audioUrl }) => {
      await playAudioOffscreen(audioUrl);
      return { success: true };
    },
    GET_NOTE_TYPES: async () => {
      const models = await getModelNames();
      const noteTypes = models.includes(DEFAULT_NOTE_TYPE_NAME)
        ? models
        : [DEFAULT_NOTE_TYPE_NAME, ...models];
      return { noteTypes };
    },
    GET_NOTE_TYPE_FIELDS: async ({ noteTypeName }) => {
      if (noteTypeName === DEFAULT_NOTE_TYPE_NAME) {
        const models = await getModelNames();
        if (!models.includes(DEFAULT_NOTE_TYPE_NAME)) {
          return { fields: Object.values(DEFAULT_FIELD_MAPPING) };
        }
      }
      const fields = await getModelFieldNames(noteTypeName);
      return { fields };
    },
  });

  browser.runtime.onInstalled.addListener((details) => {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: 'Glean: Add Word',
        contexts: ['page', 'selection'],
      });
    });

    if (details.reason === 'install') {
      browser.storage.local.set(DEFAULT_SETTINGS);
      browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
    const selection = info.selectionText ? normalizeSelection(info.selectionText) : '';
    if (selection) {
      void sendToTab(tab.id, { __gleanContent: true, kind: 'TRIGGER', selection });
    } else {
      void sendToTab(tab.id, { __gleanContent: true, kind: 'PROMPT' });
    }
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== TRIGGER_COMMAND_ID || !tab?.id) return;
    void sendToTab(tab.id, { __gleanContent: true, kind: 'HOTKEY' });
  });
});
