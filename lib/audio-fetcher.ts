import { fetchWithTimeout } from './http';

export interface AudioResult {
  audioUrl: string | null;
  phonetic: string | null;
}

function getMWAudioSubdir(audioFilename: string): string {
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

interface FreeDictEntry {
  phonetic?: string;
  phonetics?: Array<{ audio?: string; text?: string }>;
}

async function tryFreeDictionary(word: string): Promise<AudioResult> {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return { audioUrl: null, phonetic: null };

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) {
      return { audioUrl: null, phonetic: null };
    }

    const entry = data[0] as FreeDictEntry;
    let phonetic: string | null = entry.phonetic ?? null;
    let audioUrl: string | null = null;
    const phonetics = entry.phonetics ?? [];

    for (const p of phonetics) {
      if (p.audio && p.audio.includes('us')) {
        audioUrl = p.audio;
        if (p.text && !phonetic) phonetic = p.text;
        break;
      }
    }

    if (!audioUrl) {
      for (const p of phonetics) {
        if (p.audio) {
          audioUrl = p.audio;
          if (p.text && !phonetic) phonetic = p.text;
          break;
        }
      }
    }

    return { audioUrl, phonetic };
  } catch (err) {
    console.warn('[Glean] Free Dictionary fetch failed:', err);
    return { audioUrl: null, phonetic: null };
  }
}

function getGoogleTTSUrl(word: string): string {
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`;
}

export async function fetchAudio(word: string, merriamWebsterKey: string): Promise<AudioResult> {
  if (merriamWebsterKey) {
    const mw = await tryMerriamWebster(word, merriamWebsterKey);
    if (mw.audioUrl) return mw;
  }

  const fd = await tryFreeDictionary(word);
  if (fd.audioUrl) return fd;

  return { audioUrl: getGoogleTTSUrl(word), phonetic: fd.phonetic };
}
