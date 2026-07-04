function getMWAudioSubdir(audioFilename) {
  if (audioFilename.startsWith('bix')) return 'bix';
  if (audioFilename.startsWith('gg')) return 'gg';
  if (/^[^a-zA-Z]/.test(audioFilename)) return 'number';
  return audioFilename.charAt(0);
}

async function tryMerriamWebster(word, apiKey) {
  try {
    const url = `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) return { audioUrl: null, phonetic: null };

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0 || typeof data[0] === 'string') {
      return { audioUrl: null, phonetic: null };
    }

    const entry = data[0];

    let phonetic = null;
    if (entry.hwi?.hw) {
      phonetic = entry.hwi.hw.replace(/\*/g, '·');
    }

    let audioUrl = null;
    const audioFilename = entry.hwi?.prs?.[0]?.sound?.audio;
    if (audioFilename) {
      const subdir = getMWAudioSubdir(audioFilename);
      audioUrl = `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audioFilename}.mp3`;
    }

    return { audioUrl, phonetic };
  } catch (err) {
    console.warn('[Glean] Merriam-Webster fetch failed:', err.message);
    return { audioUrl: null, phonetic: null };
  }
}

async function tryFreeDictionary(word) {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const response = await fetch(url);

    if (!response.ok) return { audioUrl: null, phonetic: null };

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { audioUrl: null, phonetic: null };
    }

    const entry = data[0];

    let phonetic = entry.phonetic || null;

    let audioUrl = null;
    const phonetics = entry.phonetics || [];

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
    console.warn('[Glean] Free Dictionary fetch failed:', err.message);
    return { audioUrl: null, phonetic: null };
  }
}

function getGoogleTTSUrl(word) {
  const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`;
  return { audioUrl, phonetic: null };
}

export async function fetchAudio(word, merriamWebsterKey) {
  if (merriamWebsterKey) {
    const mw = await tryMerriamWebster(word, merriamWebsterKey);
    if (mw.audioUrl) return mw;
  }

  const fd = await tryFreeDictionary(word);
  if (fd.audioUrl) return fd;

  const google = getGoogleTTSUrl(word);

  return {
    audioUrl: google.audioUrl,
    phonetic: fd.phonetic || null,
  };
}
