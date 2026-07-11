export function normalizeSelection(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function cleanWord(raw: string): string {
  return raw.replace(/[^\p{L}\p{M}\p{N}'-]/gu, '');
}

export function wordTokens(text: string): string[] {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
}
