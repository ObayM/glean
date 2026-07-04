const PROVIDERS = {
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

function resolveProvider(provider) {
  return PROVIDERS[provider] || PROVIDERS.hackclub;
}

export function getDefaultModel(provider) {
  return resolveProvider(provider).defaultModel;
}

async function chatCompletion(provider, apiKey, model, messages, maxTokens) {
  const config = resolveProvider(provider);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['X-Title'] = 'Glean';
  }

  let response;
  try {
    response = await fetch(config.apiUrl, {
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
    throw new Error(`Failed to reach ${config.label}: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`${config.label} API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getWordData(word, sentence, provider, apiKey, model) {
  const config = resolveProvider(provider);
  const prefix = config.noThinkPrefix ? '/no_think\n' : '';
  const userPrompt = `${prefix}Word: "${word}"
Context sentence: "${sentence}"

Return a JSON object with "definition" and "example" fields. The definition must match how the word is used in the context sentence above.`;

  const data = await chatCompletion(provider, apiKey, model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], 300);

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`No response content from ${config.label}.`);
  }

  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    const jsonMatch = cleaned.match(/\{[\s\S]*"definition"[\s\S]*"example"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error(`Failed to parse LLM response as JSON: ${cleaned.substring(0, 200)}`);
      }
    } else {
      throw new Error(`LLM did not return valid JSON: ${cleaned.substring(0, 200)}`);
    }
  }

  if (!parsed.definition || !parsed.example) {
    throw new Error('LLM response missing required "definition" or "example" fields.');
  }

  return {
    definition: parsed.definition,
    example: parsed.example,
  };
}

export async function testApiKey(provider, apiKey, model) {
  const config = resolveProvider(provider);
  const prefix = config.noThinkPrefix ? '/no_think\n' : '';
  try {
    const data = await chatCompletion(provider, apiKey, model, [
      { role: 'user', content: `${prefix}Say "ok".` },
    ], 5);

    if (!data.choices?.[0]?.message) {
      return { valid: false, error: `${config.label} returned an unexpected response.` };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
