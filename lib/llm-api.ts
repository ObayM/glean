import type { DictionaryDefinition } from './audio-fetcher';
import { AppError } from './errors';
import { fetchWithTimeout } from './http';
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type LanguageCode } from './languages';
import type { LlmProvider, TestKeyResult } from './types';

interface ProviderConfig {
  label: string;
  apiUrl: string;
  defaultModel: string;
  noThinkPrefix: boolean;
}

export const PROVIDERS: Record<LlmProvider, ProviderConfig> = {
  hackclub: {
    label: 'Hack Club AI',
    apiUrl: 'https://ai.hackclub.com/proxy/v1/chat/completions',
    defaultModel: 'qwen/qwen3-32b',
    noThinkPrefix: true,
  },
  openrouter: {
    label: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    noThinkPrefix: false,
  },
};

const SUPPORTED_LANGUAGES_DESC = SUPPORTED_LANGUAGES.map((l) => `${l.code} (${l.label})`).join(', ');

const SYSTEM_PROMPT = `You are a precise multilingual vocabulary assistant. You return ONLY valid JSON with exactly four fields: "language", "meaning", "definition", and "example".

Supported languages (ISO 639-1 codes): ${SUPPORTED_LANGUAGES_DESC}.

Rules:
- "language": The ISO 639-1 code of the language the WORD itself is written in, detected from the word and its context sentence. Must be one of the supported codes above; if the word's actual language isn't supported, use "en".
- "meaning": If a numbered list of dictionary definitions is provided below, pick the ONE entry that best matches how the word is used in the context sentence and return its exact text verbatim, unmodified. If no dictionary definitions are provided, or none of them fit the context, set this to null.
- "definition": A clear, concise definition of the word AS USED in the given sentence context, written in the SAME language as "language" (a monolingual dictionary-style definition, not a translation). The definition MUST match the specific meaning/sense used in the context, not a generic definition.
- "example": A NEW example sentence using the word in the same sense, also written in the SAME language as "language". This must be a DIFFERENT sentence from the one provided.
- Return ONLY the JSON object. No markdown, no code fences, no explanation, no extra text.
- Do NOT wrap the JSON in backticks or code blocks.`;

function resolveProvider(provider: LlmProvider): ProviderConfig {
  return PROVIDERS[provider] ?? PROVIDERS.hackclub;
}

export function getDefaultModel(provider: LlmProvider): string {
  return resolveProvider(provider).defaultModel;
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function chatCompletion(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<ChatCompletionResponse> {
  const config = resolveProvider(provider);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['X-Title'] = 'Glean';
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || config.defaultModel,
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AppError('LLM_UNREACHABLE', `Failed to reach ${config.label}: ${message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new AppError(
      'LLM_HTTP_ERROR',
      `${config.label} API error (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<ChatCompletionResponse>;
}

export interface RawWordData {
  definition: string;
  example: string;
  language: LanguageCode;
  meaning: string | null;
}

export async function getWordData(
  word: string,
  sentence: string,
  provider: LlmProvider,
  apiKey: string,
  model: string,
  dictionaryDefinitions: DictionaryDefinition[] = []
): Promise<RawWordData> {
  const config = resolveProvider(provider);
  const prefix = config.noThinkPrefix ? '/no_think\n' : '';
  const dictionaryBlock = dictionaryDefinitions.length
    ? `\n\nDictionary definitions for "${word}" (pick the one that best fits the context above for "meaning"):\n${dictionaryDefinitions
        .map((d, i) => `${i + 1}. (${d.partOfSpeech}) ${d.definition}`)
        .join('\n')}`
    : '';
  const userPrompt = `${prefix}Word: "${word}"
Context sentence: "${sentence}"${dictionaryBlock}

Return a JSON object with "language", "meaning", "definition", and "example" fields. The definition must match how the word is used in the context sentence above, and must be written in the same language as the word.`;

  const data = await chatCompletion(
    provider,
    apiKey,
    model,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    800
  );

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError('LLM_BAD_RESPONSE', `No response content from ${config.label}.`);
  }

  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: Partial<RawWordData>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*"definition"[\s\S]*"example"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new AppError(
          'LLM_BAD_RESPONSE',
          `Failed to parse LLM response as JSON: ${cleaned.substring(0, 200)}`
        );
      }
    } else {
      throw new AppError(
        'LLM_BAD_RESPONSE',
        `LLM did not return valid JSON: ${cleaned.substring(0, 200)}`
      );
    }
  }

  if (!parsed.definition || !parsed.example) {
    throw new AppError(
      'LLM_BAD_RESPONSE',
      'LLM response missing required "definition" or "example" fields.'
    );
  }

  const language: LanguageCode = isSupportedLanguage(parsed.language) ? parsed.language : 'en';
  const meaning = typeof parsed.meaning === 'string' && parsed.meaning.trim() ? parsed.meaning.trim() : null;

  return { definition: parsed.definition, example: parsed.example, language, meaning };
}

export async function testApiKey(
  provider: LlmProvider,
  apiKey: string,
  model: string
): Promise<TestKeyResult> {
  const config = resolveProvider(provider);
  const prefix = config.noThinkPrefix ? '/no_think\n' : '';
  try {
    const data = await chatCompletion(
      provider,
      apiKey,
      model,
      [{ role: 'user', content: `${prefix}Say "ok".` }],
      5
    );
    if (!data.choices?.[0]?.message) {
      return { valid: false, error: `${config.label} returned an unexpected response.` };
    }
    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}
