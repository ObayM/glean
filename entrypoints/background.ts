import {
  addNote,
  ensureDeck,
  ensureNoteType,
  getDeckNames,
  testConnection,
  wordExistsInDeck,
} from '../lib/anki-connect';
import { fetchAudio } from '../lib/audio-fetcher';
import { AppError } from '../lib/errors';
import { escapeHtml, highlightToHtml } from '../lib/highlight';
import { PROVIDERS, getDefaultModel, getWordData, testApiKey } from '../lib/llm-api';
import { registerHandlers, sendToTab } from '../lib/messaging';
import {
  DEFAULT_DECK,
  DEFAULT_SETTINGS,
  activeCredentials,
  getCachedWord,
  getSettings,
  putCachedWord,
  recordAddedWord,
} from '../lib/storage';
import type {
  AddToAnkiInput,
  AddToAnkiResult,
  AnkiStatus,
  ProcessWordInput,
  TestKeyInput,
  WordData,
} from '../lib/types';

const CONTEXT_MENU_ID = 'glean-ctx-menu';

async function handleProcessWord({ word, sentence, pageUrl }: ProcessWordInput): Promise<WordData> {
  const settings = await getSettings();
  const { provider, apiKey, model } = activeCredentials(settings, getDefaultModel);

  if (!apiKey) {
    const label = provider === 'openrouter' ? 'OpenRouter' : 'Hack Club AI';
    throw new AppError('NO_API_KEY', `API key not configured. Set your ${label} key in Glean settings.`);
  }

  const cached = await getCachedWord(provider, model, word, sentence);
  if (cached) {
    return { ...cached, pageUrl };
  }

  const llmResult = await getWordData(word, sentence, provider, apiKey, model);
  const audioResult = await fetchAudio(word, settings.mwKey, llmResult.language);

  const data: WordData = {
    word,
    definition: llmResult.definition,
    example: llmResult.example,
    language: llmResult.language,
    audioUrl: audioResult.audioUrl,
    phonetic: audioResult.phonetic,
    sentence,
    pageUrl,
  };

  await putCachedWord(provider, model, word, sentence, data);
  return data;
}

async function handleAddToAnki(input: AddToAnkiInput): Promise<AddToAnkiResult> {
  const { word, definition, sentence, example, language, audioUrl, pageUrl, force } = input;
  const settings = await getSettings();
  const deckName = settings.deckName || DEFAULT_DECK;

  await ensureNoteType();
  await ensureDeck(deckName);

  if (!force && (await wordExistsInDeck(deckName, word))) {
    return { status: 'duplicate' };
  }

  const fields: Record<string, string> = {
    Word: escapeHtml(word),
    Definition: escapeHtml(definition),
    Sentence: sentence ? highlightToHtml(sentence, word) : '',
    Example: example ? escapeHtml(example) : '',
    Sound: '',
    Image: '',
    'Source URL': pageUrl ? escapeHtml(pageUrl) : '',
  };

  const audio = [];
  if (audioUrl) {
    const safeWord = word.toLowerCase().replace(/[^a-z0-9-]/g, '_');
    audio.push({ url: audioUrl, filename: `glean_${safeWord}.mp3`, fields: ['Sound'] });
  }

  const tags = ['glean', `lang-${language || 'en'}`];
  const noteId = await addNote(deckName, fields, tags, audio, Boolean(force));

  try {
    await recordAddedWord({ word, definition, sentence, example, timestamp: Date.now() });
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
  browser.runtime.sendMessage({ target: 'offscreen', type: 'PLAY_AUDIO', payload: { audioUrl } });
}

export default defineBackground(() => {
  registerHandlers({
    PROCESS_WORD: handleProcessWord,
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
    const word = info.selectionText ? info.selectionText.trim() : '';
    if (word) {
      void sendToTab(tab.id, { __gleanContent: true, kind: 'TRIGGER', word });
    } else {
      void sendToTab(tab.id, { __gleanContent: true, kind: 'PROMPT' });
    }
  });
});
