const API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';
const MODEL = 'qwen/qwen3-32b';

const SYSTEM_PROMPT = `You are a precise vocabulary assistant. You return ONLY valid JSON with exactly two fields: "definition" and "example".

Rules:
- "definition": A clear, concise definition of the word AS USED in the given sentence context. The definition MUST match the specific meaning/sense used in the context, not a generic definition.
- "example": A NEW example sentence using the word in the same sense. This must be a DIFFERENT sentence from the one provided.
- Return ONLY the JSON object. No markdown, no code fences, no explanation, no extra text.
- Do NOT wrap the JSON in backticks or code blocks.`;

export async function getWordData(word, sentence, apiKey) {
  const userPrompt = `/no_think
Word: "${word}"
Context sentence: "${sentence}"

Return a JSON object with "definition" and "example" fields. The definition must match how the word is used in the context sentence above.`;

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });
  } catch (err) {
    throw new Error(`Failed to reach Hack Club AI: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Hack Club AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response content from Hack Club AI.');
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

export async function testApiKey(apiKey) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: '/no_think\nSay "ok".' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const errorText = await response.text().catch(() => '');
    return { valid: false, error: `API returned status ${response.status}: ${errorText}` };
  } catch (err) {
    return { valid: false, error: `Could not reach API: ${err.message}` };
  }
}
