export interface SentencePart {
  text: string;
  hit: boolean;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function splitByWord(sentence: string, word: string): SentencePart[] {
  if (!word) return [{ text: sentence, hit: false }];
  const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
  return sentence
    .split(regex)
    .filter((piece) => piece.length > 0)
    .map((piece) => ({ text: piece, hit: piece.toLowerCase() === word.toLowerCase() }));
}

export function highlightToHtml(sentence: string, word: string): string {
  return splitByWord(sentence, word)
    .map((part) => (part.hit ? `<b>${escapeHtml(part.text)}</b>` : escapeHtml(part.text)))
    .join('');
}
