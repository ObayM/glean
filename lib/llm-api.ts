import { AppError } from './errors';
import { fetchWithTimeout } from './http';
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

const SYSTEM_PROMPT = `You are a precise vocabulary assistant. You return ONLY valid JSON with exactly two fields: "definition" and "example".

Rules:
- "definition": A clear, concise definition of the word AS USED in the given sentence context. The definition MUST match the specific meaning/sense used in the context, not a generic definition.
- "example": A NEW example sentence using the word in the same sense. This must be a DIFFERENT sentence from the one provided.
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
}

export async function getWordData(
  word: string,
  sentence: string,
  provider: LlmProvider,
  apiKey: string,
  model: string
): Promise<RawWordData> {
  const config = resolveProvider(provider);
  const prefix = config.noThinkPrefix ? '/no_think\n' : '';
  const userPrompt = `${prefix}Word: "${word}"
Context sentence: "${sentence}"

Return a JSON object with "definition" and "example" fields. The definition must match how the word is used in the context sentence above.`;

  const data = await chatCompletion(
    provider,
    apiKey,
    model,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    300
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

  return { definition: parsed.definition, example: parsed.example };
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
