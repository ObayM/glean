import { fetchWithTimeout } from './http';

export interface AudioResult {
  audioUrl: string | null;
  phonetic: string | null;
}

export function getMWAudioSubdir(audioFilename: string): string {
  if (audioFilename.startsWith('bix')) return 'bix';
  if (audioFilename.startsWith('gg')) return 'gg';
  if (/^[^a-zA-Z]/.test(audioFilename)) return 'number';
  return audioFilename.charAt(0);
}

interface MWEntry {
  hwi?: {
    hw?: string;
    prs?: Array<{ sound?: { audio?: string } }>;
  };
}

async function tryMerriamWebster(word: string, apiKey: string): Promise<AudioResult> {
  try {
    const url = `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${apiKey}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return { audioUrl: null, phonetic: null };

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0 || typeof data[0] === 'string') {
      return { audioUrl: null, phonetic: null };
    }

    const entry = data[0] as MWEntry;

    let phonetic: string | null = null;
    if (entry.hwi?.hw) {
      phonetic = entry.hwi.hw.replace(/\*/g, '·');
    }

    let audioUrl: string | null = null;
    const audioFilename = entry.hwi?.prs?.[0]?.sound?.audio;
    if (audioFilename) {
      const subdir = getMWAudioSubdir(audioFilename);
      audioUrl = `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audioFilename}.mp3`;
    }

    return { audioUrl, phonetic };
  } catch (err) {
    console.warn('[Glean] Merriam-Webster fetch failed:', err);
    return { audioUrl: null, phonetic: null };
  }
}

interface FreeDictDefinition {
  definition?: string;
  example?: string;
}

interface FreeDictMeaning {
  partOfSpeech?: string;
  definitions?: FreeDictDefinition[];
}

interface FreeDictEntry {
  phonetic?: string;
  phonetics?: Array<{ audio?: string; text?: string }>;
  meanings?: FreeDictMeaning[];
}

export interface DictionaryDefinition {
  partOfSpeech: string;
  definition: string;
  example: string | null;
}

export interface FreeDictionaryEntry {
  audioUrl: string | null;
  phonetic: string | null;
  definitions: DictionaryDefinition[];
}

const MAX_DICTIONARY_DEFINITIONS = 12;

export async function fetchFreeDictionaryEntry(word: string): Promise<FreeDictionaryEntry> {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return { audioUrl: null, phonetic: null, definitions: [] };

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) {
      return { audioUrl: null, phonetic: null, definitions: [] };
    }

    let phonetic: string | null = null;
    let audioUrl: string | null = null;
    let fallbackAudioUrl: string | null = null;
    const definitions: DictionaryDefinition[] = [];

    for (const raw of data) {
      const entry = raw as FreeDictEntry;
      if (!phonetic && entry.phonetic) phonetic = entry.phonetic;

      for (const p of entry.phonetics ?? []) {
        if (!phonetic && p.text) phonetic = p.text;
        if (p.audio && p.audio.includes('us')) {
          audioUrl = audioUrl ?? p.audio;
        } else if (p.audio) {
          fallbackAudioUrl = fallbackAudioUrl ?? p.audio;
        }
      }

      for (const meaning of entry.meanings ?? []) {
        for (const def of meaning.definitions ?? []) {
          if (def.definition && definitions.length < MAX_DICTIONARY_DEFINITIONS) {
            definitions.push({
              partOfSpeech: meaning.partOfSpeech ?? '',
              definition: def.definition,
              example: def.example ?? null,
            });
          }
        }
      }
    }

    return { audioUrl: audioUrl ?? fallbackAudioUrl, phonetic, definitions };
  } catch (err) {
    console.warn('[Glean] Free Dictionary fetch failed:', err);
    return { audioUrl: null, phonetic: null, definitions: [] };
  }
}

function getGoogleTTSUrl(word: string, language: string): string {
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=${encodeURIComponent(language)}&client=tw-ob`;
}

export async function fetchAudio(
  word: string,
  merriamWebsterKey: string,
  language: string,
  freeDictEntry: FreeDictionaryEntry | null
): Promise<AudioResult> {
  if (language !== 'en') {
    return { audioUrl: getGoogleTTSUrl(word, language), phonetic: null };
  }

  if (merriamWebsterKey) {
    const mw = await tryMerriamWebster(word, merriamWebsterKey);
    if (mw.audioUrl) return mw;
  }

  if (freeDictEntry?.audioUrl) {
    return { audioUrl: freeDictEntry.audioUrl, phonetic: freeDictEntry.phonetic };
  }

  return { audioUrl: getGoogleTTSUrl(word, 'en'), phonetic: freeDictEntry?.phonetic ?? null };
}
