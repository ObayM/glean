export type ErrorCode =
  | 'NO_API_KEY'
  | 'LLM_UNREACHABLE'
  | 'LLM_HTTP_ERROR'
  | 'LLM_BAD_RESPONSE'
  | 'ANKI_UNREACHABLE'
  | 'ANKI_ERROR'
  | 'TIMEOUT'
  | 'NO_DICTIONARY_ENTRY'
  | 'UNKNOWN';

export interface SerializedError {
  code: ErrorCode;
  message: string;
}

export class AppError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  NO_API_KEY: 'No API key configured. Open Glean settings to add one.',
  LLM_UNREACHABLE: 'Could not reach the AI provider. Check your connection and try again.',
  ANKI_UNREACHABLE: 'Anki desktop is offline. Open Anki and try again.',
  TIMEOUT: 'The request took too long. Try again in a moment.',
  NO_DICTIONARY_ENTRY: 'No dictionary entry found for this word.',
};

export function friendlyMessage(err: SerializedError): string {
  return FRIENDLY[err.code] ?? err.message;
}

export function toSerializedError(err: unknown): SerializedError {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message };
  }
  return { code: 'UNKNOWN', message: String(err) };
}
