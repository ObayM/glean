export type LanguageCode = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl';

export interface LanguageInfo {
  code: LanguageCode;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
];

const CODE_SET = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

export function isSupportedLanguage(code: string | undefined | null): code is LanguageCode {
  return typeof code === 'string' && CODE_SET.has(code);
}

export function languageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
