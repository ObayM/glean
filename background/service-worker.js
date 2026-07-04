import {
  testConnection,
  getDeckNames,
  ensureNoteType,
  ensureDeck,
  addNote,
} from '../lib/anki-connect.js';

import { getWordData, testApiKey } from '../lib/llm-api.js';
import { fetchAudio } from '../lib/audio-fetcher.js';

const DEFAULT_DECK = 'Glean';
const MODEL_NAME = 'Glean Vocab';

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { apiKey: '', mwKey: '', deckName: DEFAULT_DECK },
      (result) => resolve(result)
    );
  });
}

async function handleProcessWord({ word, sentence, pageUrl }) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error('API key not configured. Please set your Hack Club AI key in the extension settings.');
  }

  const [llmResult, audioResult] = await Promise.all([
    getWordData(word, sentence, settings.apiKey),
    fetchAudio(word, settings.mwKey),
  ]);

  return {
    word,
    definition: llmResult.definition,
    example: llmResult.example,
    audioUrl: audioResult.audioUrl,
    phonetic: audioResult.phonetic,
    sentence,
    pageUrl,
  };
}

async function handleAddToAnki({ word, definition, sentence, example, audioUrl, pageUrl }) {
  const settings = await getSettings();
  const deckName = settings.deckName || DEFAULT_DECK;

  await ensureNoteType();
  await ensureDeck(deckName);

  const fields = {
    Word: word,
    Definition: definition,
    Sentence: sentence || '',
    Example: example || '',
    Sound: '',
    Image: '',
    'Source URL': pageUrl || '',
  };

  const audio = [];
  if (audioUrl) {
    const safeWord = word.toLowerCase().replace(/[^a-z0-9-]/g, '_');
    audio.push({
      url: audioUrl,
      filename: `glean_${safeWord}.mp3`,
      fields: ['Sound'],
    });
  }

  const noteId = await addNote(deckName, MODEL_NAME, fields, ['glean'], audio);

  try {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get({
        recentWords: [],
        stats: { todayCount: 0, totalCount: 0, todayDate: '' }
      }, resolve);
    });

    const recentWords = data.recentWords || [];
    recentWords.push({
      word,
      definition,
      sentence,
      example,
      timestamp: Date.now()
    });
    if (recentWords.length > 20) {
      recentWords.shift();
    }

    const stats = data.stats || { todayCount: 0, totalCount: 0, todayDate: '' };
    const todayStr = new Date().toDateString();
    if (stats.todayDate !== todayStr) {
      stats.todayCount = 0;
      stats.todayDate = todayStr;
    }
    stats.todayCount += 1;
    stats.totalCount += 1;

    await new Promise((resolve) => {
      chrome.storage.local.set({ recentWords, stats }, resolve);
    });
  } catch (err) {
    console.error('[Glean] Failed to update stats/history in local storage:', err.message);
  }

  return { success: true, noteId };
}

async function playAudioOffscreen(audioUrl) {
  const hasDocument = await chrome.offscreen.hasDocument();
  if (!hasDocument) {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Play pronunciation audio files for words',
    });
  }
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'PLAY_AUDIO',
    payload: { audioUrl }
  });
}

async function handleCheckAnki() {
  try {
    const version = await testConnection();
    return { connected: true, version };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function handleGetDecks() {
  const decks = await getDeckNames();
  return { decks };
}

async function handleCreateDeck({ deckName }) {
  await ensureDeck(deckName);
  return { success: true };
}

async function handleTestApiKey({ apiKey }) {
  return testApiKey(apiKey);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  let handlerPromise = null;

  switch (type) {
    case 'PROCESS_WORD':
      handlerPromise = handleProcessWord(payload);
      break;

    case 'ADD_TO_ANKI':
      handlerPromise = handleAddToAnki(payload);
      break;

    case 'CHECK_ANKI':
      handlerPromise = handleCheckAnki();
      break;

    case 'GET_DECKS':
      handlerPromise = handleGetDecks();
      break;

    case 'CREATE_DECK':
      handlerPromise = handleCreateDeck(payload);
      break;

    case 'TEST_API_KEY':
      handlerPromise = handleTestApiKey(payload);
      break;

    case 'PLAY_AUDIO_OFFSCREEN':
      handlerPromise = playAudioOffscreen(payload.audioUrl).then(() => ({ success: true }));
      break;

    default:
      console.warn(`[Glean] Unknown message type: ${type}`);
      sendResponse({ success: false, error: `Unknown message type: ${type}` });
      return false;
  }

  handlerPromise
    .then((data) => {
      sendResponse({ success: true, data });
    })
    .catch((err) => {
      console.error(`[Glean] Error handling ${type}:`, err);
      sendResponse({ success: false, error: err.message });
    });

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'glean-ctx-menu',
      title: 'Glean: Add Word',
      contexts: ['page', 'selection']
    });
  });

  if (details.reason === 'install') {
    chrome.storage.local.set({
      apiKey: '',
      mwKey: '',
      deckName: DEFAULT_DECK
    });

    chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'glean-ctx-menu') {
    const word = info.selectionText ? info.selectionText.trim() : '';
    if (word) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_CONTEXT_MENU',
        payload: { word }
      }).catch((err) => {
        console.debug('[Glean] Failed to send TRIGGER_CONTEXT_MENU:', err.message);
      });
    } else {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_CONTEXT_MENU_PROMPT'
      }).catch((err) => {
        console.debug('[Glean] Failed to send TRIGGER_CONTEXT_MENU_PROMPT:', err.message);
      });
    }
  }
});
