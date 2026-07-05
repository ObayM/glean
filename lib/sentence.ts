const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
  'st', 'ave', 'blvd', 'dept', 'est', 'govt',
  'vs', 'etc', 'approx', 'appt', 'apt',
  'inc', 'ltd', 'corp', 'co',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'i.e', 'e.g', 'viz', 'cf', 'al',
  'fig', 'vol', 'no', 'op', 'ed', 'rev', 'trans',
  'u.s', 'u.k', 'u.n',
  // German
  'usw', 'bzw', 'ca', 'geb', 'gest', 'str', 'jh', 'nr',
  // French
  'mme', 'mlle', 'bd', 'tél',
  // Spanish / Portuguese
  'sra', 'srta', 'ud', 'uds', 'pág', 'núm', 'cía',
  // Italian
  'sig', 'dott', 'ecc', 'pag',
  // Dutch
  'dhr', 'mevr', 'ing', 'blz',
]);

const MAX_SENTENCE_LENGTH = 200;

function isSentenceBoundary(text: string, dotIndex: number): boolean {
  const before = text.substring(Math.max(0, dotIndex - 50), dotIndex);
  if (/https?:\/\/\S*$/i.test(before) || /www\.\S*$/i.test(before)) {
    return false;
  }

  if (dotIndex > 0 && dotIndex < text.length - 1) {
    if (/\d/.test(text[dotIndex - 1]!) && /\d/.test(text[dotIndex + 1]!)) {
      return false;
    }
  }

  let wordStart = dotIndex - 1;
  while (wordStart >= 0 && /[\p{L}.]/u.test(text[wordStart]!)) {
    wordStart--;
  }
  const wordBeforeDot = text.substring(wordStart + 1, dotIndex).toLowerCase();
  if (ABBREVIATIONS.has(wordBeforeDot)) {
    return false;
  }

  if (wordBeforeDot.length === 1 && /\p{Lu}/u.test(text[dotIndex - 1]!)) {
    return false;
  }

  return true;
}

function findSentenceBoundaries(text: string): number[] {
  const boundaries = [0];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '!' || char === '?') {
      let end = i + 1;
      while (end < text.length && /["')\]]/.test(text[end]!)) end++;
      while (end < text.length && /\s/.test(text[end]!)) end++;
      boundaries.push(end);
      continue;
    }

    if (char === '.') {
      if (isSentenceBoundary(text, i)) {
        if (text[i + 1] === '.' && text[i + 2] === '.') {
          i += 2;
          let end = i + 1;
          while (end < text.length && /\s/.test(text[end]!)) end++;
          boundaries.push(end);
          continue;
        }

        let end = i + 1;
        while (end < text.length && /["')\]]/.test(text[end]!)) end++;
        while (end < text.length && /\s/.test(text[end]!)) end++;
        boundaries.push(end);
      }
    }
  }

  boundaries.push(text.length);
  return boundaries;
}

export function extractSentence(text: string, wordOffset: number, word: string): string {
  if (!text || typeof text !== 'string') return '';
  if (wordOffset < 0 || wordOffset >= text.length) {
    const idx = text.toLowerCase().indexOf(word.toLowerCase());
    if (idx >= 0) {
      wordOffset = idx;
    } else {
      return text.substring(0, MAX_SENTENCE_LENGTH);
    }
  }

  const boundaries = findSentenceBoundaries(text);

  let sentenceStart = 0;
  let sentenceEnd = text.length;

  for (let i = 0; i < boundaries.length - 1; i++) {
    if (wordOffset >= boundaries[i]! && wordOffset < boundaries[i + 1]!) {
      sentenceStart = boundaries[i]!;
      sentenceEnd = boundaries[i + 1]!;
      break;
    }
  }

  let sentence = text.substring(sentenceStart, sentenceEnd).trim();

  if (sentence.length > MAX_SENTENCE_LENGTH) {
    const wordPosInSentence = wordOffset - sentenceStart;
    const halfWindow = Math.floor((MAX_SENTENCE_LENGTH - word.length) / 2);

    let start = Math.max(0, wordPosInSentence - halfWindow);
    let end = Math.min(sentence.length, wordPosInSentence + word.length + halfWindow);

    if (start > 0) {
      const spaceIdx = sentence.indexOf(' ', start);
      if (spaceIdx !== -1 && spaceIdx < wordPosInSentence) {
        start = spaceIdx + 1;
      }
    }
    if (end < sentence.length) {
      const spaceIdx = sentence.lastIndexOf(' ', end);
      if (spaceIdx !== -1 && spaceIdx > wordPosInSentence + word.length) {
        end = spaceIdx;
      }
    }

    sentence =
      (start > 0 ? '...' : '') +
      sentence.substring(start, end).trim() +
      (end < sentence.length ? '...' : '');
  }

  return sentence;
}
