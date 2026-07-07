import { AppError } from './errors';
import { fetchWithTimeout } from './http';

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const ANKI_CONNECT_VERSION = 6;
const MODEL_NAME = 'Glean Vocab';
const MODEL_FIELDS = ['Word', 'Meaning', 'Definition', 'Sentence', 'Example', 'Sound', 'Image', 'Source URL'];
const CARD_TEMPLATE_NAME = 'Glean Card';

export const CARD_CSS = `
.glean-card {
  font-family: "Source Serif 4", Georgia, serif;
  max-width: 500px;
  margin: 0 auto;
  padding: 3em 2em;
  text-align: left;
  color: #000000;
  background-color: #ffffff;
  line-height: 1.6;
  border: 1px solid #000000;
}

.glean-card .word {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 2.5em;
  font-weight: 700;
  color: #000000;
  margin: 0 0 0.5em 0;
  letter-spacing: -0.02em;
}

.glean-card .meaning {
  font-size: 1em;
  color: #525252;
  margin: 0 0 0.8em 0;
  font-style: italic;
}

.glean-card .definition {
  font-size: 1.15em;
  color: #000000;
  margin: 1em 0;
  padding: 0.8em 1.2em;
  background: #f5f5f5;
  border-left: 2px solid #000000;
}

.glean-card hr {
  border: none;
  border-top: 1px solid #000000;
  margin: 1.5em 0;
}

.glean-card .sentence {
  font-size: 1.05em;
  color: #000000;
  margin: 0.8em 0;
  font-style: italic;
}

.glean-card .sentence b {
  color: #000000;
  font-style: normal;
  font-weight: 700;
  border-bottom: 1px solid #000000;
}

.glean-card .example {
  font-size: 1em;
  color: #525252;
  margin: 0.8em 0;
}

.glean-card .example em {
  color: #000000;
}

.glean-card .sound {
  margin: 1em 0;
}

.glean-card .image {
  margin: 1em 0;
}

.glean-card .image img {
  max-width: 100%;
  border: 1px solid #000000;
  border-radius: 0px;
}

.glean-card .source {
  margin-top: 1.5em;
  font-size: 0.75em;
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.glean-card .source a {
  color: #525252;
  text-decoration: none;
}

.glean-card .source a:hover {
  text-decoration: underline;
}

.night-mode .glean-card {
  color: #e8e8e8;
  background-color: #2a2a2e;
  border-color: #4a4a4f;
}

.night-mode .glean-card .word {
  color: #e8e8e8;
}

.night-mode .glean-card .meaning {
  color: #b8b8bd;
}

.night-mode .glean-card .definition {
  color: #e8e8e8;
  background: #35353a;
  border-left-color: #7aa8ff;
}

.night-mode .glean-card hr {
  border-top-color: #4a4a4f;
}

.night-mode .glean-card .sentence {
  color: #e8e8e8;
}

.night-mode .glean-card .sentence b {
  color: #ffffff;
  border-bottom-color: #ffffff;
}

.night-mode .glean-card .example {
  color: #b8b8bd;
}

.night-mode .glean-card .example em {
  color: #e8e8e8;
}

.night-mode .glean-card .image img {
  border-color: #4a4a4f;
}

.night-mode .glean-card .source a {
  color: #b8b8bd;
}
`;

const CARD_FRONT = `<div class="glean-card">
  <h1 class="word">{{Word}}</h1>
</div>`;

const CARD_BACK = `<div class="glean-card">
  <h1 class="word">{{Word}}</h1>
  {{#Meaning}}<div class="meaning">{{Meaning}}</div>{{/Meaning}}
  <div class="definition">{{Definition}}</div>
  <hr>
  <div class="sentence">{{Sentence}}</div>
  <div class="example"><em>{{Example}}</em></div>
  <div class="sound">{{Sound}}</div>
  {{#Image}}<div class="image">{{Image}}</div>{{/Image}}
  <div class="source"><a href="{{Source URL}}">source</a></div>
</div>`;

async function ankiConnectRequest<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params });

  let response: Response;
  try {
    response = await fetchWithTimeout(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }, 3000);
  } catch (err) {
    if (err instanceof AppError && err.code === 'TIMEOUT') throw err;
    throw new AppError(
      'ANKI_UNREACHABLE',
      'Cannot reach AnkiConnect. Make sure Anki is running and the AnkiConnect add-on is installed.'
    );
  }

  const data = (await response.json()) as { error: string | null; result: T };

  if (data.error) {
    throw new AppError('ANKI_ERROR', `AnkiConnect error: ${data.error}`);
  }

  return data.result;
}

export function testConnection(): Promise<number> {
  return ankiConnectRequest<number>('version');
}

export function getDeckNames(): Promise<string[]> {
  return ankiConnectRequest<string[]>('deckNames');
}

export function createDeck(name: string): Promise<number> {
  return ankiConnectRequest<number>('createDeck', { deck: name });
}

export function getModelNames(): Promise<string[]> {
  return ankiConnectRequest<string[]>('modelNames');
}

export interface AnkiAudio {
  url?: string;
  data?: string;
  filename: string;
  fields: string[];
}

export async function addNote(
  deckName: string,
  fields: Record<string, string>,
  tags: string[] = [],
  audio: AnkiAudio[] = [],
  allowDuplicate = false
): Promise<number> {
  const note: Record<string, unknown> = {
    deckName,
    modelName: MODEL_NAME,
    fields,
    tags,
    options: { allowDuplicate, duplicateScope: 'deck' },
  };
  if (audio.length > 0) {
    note.audio = audio;
  }
  return ankiConnectRequest<number>('addNote', { note });
}

function escapeAnkiQuery(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function buildDuplicateQuery(deckName: string, word: string): string {
  const cleanWord = word.trim();
  const lower = cleanWord.toLowerCase();
  const title = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();

  const escapedDeck = escapeAnkiQuery(deckName);
  const escapedLower = escapeAnkiQuery(lower);

  if (title === lower) {
    return `deck:"${escapedDeck}" "Word:${escapedLower}"`;
  }

  const escapedTitle = escapeAnkiQuery(title);
  return `deck:"${escapedDeck}" ("Word:${escapedLower}" or "Word:${escapedTitle}")`;
}

export async function wordExistsInDeck(deckName: string, word: string): Promise<boolean> {
  const query = buildDuplicateQuery(deckName, word);
  const notes = await ankiConnectRequest<number[]>('findNotes', { query });
  return notes.length > 0;
}

export async function ensureNoteType(): Promise<void> {
  const models = await getModelNames();
  if (!models.includes(MODEL_NAME)) {
    await ankiConnectRequest('createModel', {
      modelName: MODEL_NAME,
      inOrderFields: MODEL_FIELDS,
      css: CARD_CSS,
      isCloze: false,
      cardTemplates: [{ Name: CARD_TEMPLATE_NAME, Front: CARD_FRONT, Back: CARD_BACK }],
    });
    return;
  }

  const existingFields = await ankiConnectRequest<string[]>('modelFieldNames', { modelName: MODEL_NAME });
  if (!existingFields.includes('Meaning')) {
    const insertIndex = existingFields.indexOf('Definition');
    await ankiConnectRequest('modelFieldAdd', {
      modelName: MODEL_NAME,
      fieldName: 'Meaning',
      index: insertIndex >= 0 ? insertIndex : existingFields.length,
    });
    await ankiConnectRequest('updateModelTemplates', {
      model: { name: MODEL_NAME, templates: { [CARD_TEMPLATE_NAME]: { Front: CARD_FRONT, Back: CARD_BACK } } },
    });
    await ankiConnectRequest('updateModelStyling', {
      model: { name: MODEL_NAME, css: CARD_CSS },
    });
  }
}

export function ensureDeck(deckName: string): Promise<number> {
  return createDeck(deckName);
}
