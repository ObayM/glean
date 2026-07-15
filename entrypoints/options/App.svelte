<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import GlassPanel from '../../components/GlassPanel.svelte';
  import { DEFAULT_FIELD_MAPPING, DEFAULT_NOTE_TYPE_NAME, GLEAN_FIELDS } from '../../lib/anki-connect';
  import type { GleanFieldKey } from '../../lib/anki-connect';
  import { TRIGGER_COMMAND_ID } from '../../lib/constants';
  import { SUPPORTED_LANGUAGES } from '../../lib/languages';
  import { getDefaultModel } from '../../lib/llm-api';
  import { sendMessage } from '../../lib/messaging';
  import { getSettings, setSettings } from '../../lib/storage';
  import type { CardFontSize, LlmProvider, LookupMode } from '../../lib/types';
  import {
    CircleCheck,
    CircleX,
    ExternalLink,
    Eye,
    EyeOff,
    LoaderCircle,
    Plus,
    RefreshCw,
    Trash2,
    TriangleAlert,
    X,
  } from '@lucide/svelte';

  type Section = 'general' | 'ai' | 'audio' | 'anki';

  const NAV: { id: Section; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'ai', label: 'AI Provider' },
    { id: 'audio', label: 'Pronunciation Audio' },
    { id: 'anki', label: 'Anki Integration' },
  ];

  const supportedLanguageNames = SUPPORTED_LANGUAGES.map((l) => l.label).join(', ');

  let section = $state<Section>('general');

  let lookupMode = $state<LookupMode>('ai');
  let shortcutLabel = $state('Not set');
  let noteTypeName = $state(DEFAULT_NOTE_TYPE_NAME);
  let fieldMapping = $state<Record<GleanFieldKey, string>>({ ...DEFAULT_FIELD_MAPPING });
  let noteTypes = $state<string[]>([DEFAULT_NOTE_TYPE_NAME]);
  let noteTypeFields = $state<string[]>([]);
  let loadingNoteTypeFields = $state(false);
  let provider = $state<LlmProvider>('hackclub');
  let hackclubApiKey = $state('');
  let hackclubModel = $state('');
  let openrouterApiKey = $state('');
  let openrouterModel = $state('');
  let mwKey = $state('');
  let deckName = $state('Glean');
  let decks = $state<string[]>(['Glean']);
  let cardFontSize = $state<CardFontSize>('large');

  let ankiStatus = $state<'checking' | 'connected' | 'offline'>('checking');
  let keyStatus = $state<{ msg: string; type: 'success' | 'error' | 'checking' } | null>(null);
  let testingKey = $state(false);
  let toastVisible = $state(false);

  let dialogOpen = $state(false);
  let newDeckName = $state('');
  let creating = $state(false);
  let dialogError = $state('');

  let hcKeyVisible = $state(false);
  let orKeyVisible = $state(false);
  let mwKeyVisible = $state(false);

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(async () => {
    const s = await getSettings();
    lookupMode = s.lookupMode;
    provider = s.llmProvider;
    hackclubApiKey = s.hackclubApiKey;
    hackclubModel = s.hackclubModel || getDefaultModel('hackclub');
    openrouterApiKey = s.openrouterApiKey;
    openrouterModel = s.openrouterModel || getDefaultModel('openrouter');
    mwKey = s.mwKey;
    deckName = s.deckName;
    noteTypeName = s.noteTypeName || DEFAULT_NOTE_TYPE_NAME;
    fieldMapping = { ...DEFAULT_FIELD_MAPPING, ...s.fieldMapping };
    cardFontSize = s.cardFontSize;
    await testAnki();

    const commands = await browser.commands.getAll();
    shortcutLabel = commands.find((c) => c.name === TRIGGER_COMMAND_ID)?.shortcut || 'Not set';
  });

  async function save(notify = true) {
    await setSettings({
      lookupMode,
      llmProvider: provider,
      hackclubApiKey: hackclubApiKey.trim(),
      hackclubModel: hackclubModel.trim(),
      openrouterApiKey: openrouterApiKey.trim(),
      openrouterModel: openrouterModel.trim(),
      mwKey: mwKey.trim(),
      deckName,
      noteTypeName,
      fieldMapping,
      cardFontSize,
    });
    if (notify) showToast();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void save(true), 1000);
  }

  function showToast() {
    clearTimeout(toastTimer);
    toastVisible = true;
    toastTimer = setTimeout(() => (toastVisible = false), 2000);
  }

  function setLookupMode(next: LookupMode) {
    if (lookupMode === next) return;
    lookupMode = next;
    void save(true);
  }

  async function testKey() {
    const apiKey = provider === 'openrouter' ? openrouterApiKey.trim() : hackclubApiKey.trim();
    const model =
      (provider === 'openrouter' ? openrouterModel.trim() : hackclubModel.trim()) ||
      getDefaultModel(provider);
    if (!apiKey) {
      keyStatus = { msg: 'Please enter a key first.', type: 'error' };
      return;
    }
    testingKey = true;
    keyStatus = { msg: 'Testing key...', type: 'checking' };
    const res = await sendMessage('TEST_API_KEY', { provider, apiKey, model });
    testingKey = false;
    if (res.ok && res.data.valid) {
      keyStatus = { msg: 'API Key is valid.', type: 'success' };
      await save(false);
    } else {
      const err = res.ok ? res.data.error : res.error.message;
      keyStatus = { msg: `Verification failed: ${err ?? 'Invalid API key.'}`, type: 'error' };
    }
  }

  async function testAnki() {
    ankiStatus = 'checking';
    const res = await sendMessage('CHECK_ANKI', undefined);
    if (res.ok && res.data.connected) {
      ankiStatus = 'connected';
      await loadDecks();
      await loadNoteTypes();
    } else {
      ankiStatus = 'offline';
    }
  }

  async function loadDecks() {
    const res = await sendMessage('GET_DECKS', undefined);
    if (!res.ok) return;
    const list = res.data.decks;
    if (deckName && !list.includes(deckName)) list.push(deckName);
    decks = list;
  }

  async function loadNoteTypes() {
    const res = await sendMessage('GET_NOTE_TYPES', undefined);
    if (!res.ok) return;
    const list = res.data.noteTypes;
    if (noteTypeName && !list.includes(noteTypeName)) list.push(noteTypeName);
    noteTypes = list;
    if (noteTypeName !== DEFAULT_NOTE_TYPE_NAME) {
      await loadNoteTypeFields(noteTypeName);
    }
  }

  async function loadNoteTypeFields(name: string) {
    loadingNoteTypeFields = true;
    const res = await sendMessage('GET_NOTE_TYPE_FIELDS', { noteTypeName: name });
    loadingNoteTypeFields = false;
    noteTypeFields = res.ok ? res.data.fields : [];
  }

  function guessFieldMapping(fields: string[]): Record<GleanFieldKey, string> {
    const mapping = {} as Record<GleanFieldKey, string>;
    for (const f of GLEAN_FIELDS) {
      const match = fields.find(
        (name) => name.toLowerCase() === f.key.toLowerCase() || name.toLowerCase() === f.label.toLowerCase()
      );
      mapping[f.key] = match ?? (f.required ? fields[0] ?? '' : '');
    }
    return mapping;
  }

  async function onNoteTypeChange() {
    if (noteTypeName === DEFAULT_NOTE_TYPE_NAME) {
      fieldMapping = { ...DEFAULT_FIELD_MAPPING };
      noteTypeFields = [];
    } else {
      await loadNoteTypeFields(noteTypeName);
      fieldMapping = guessFieldMapping(noteTypeFields);
    }
    await save(true);
  }

  async function createDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    creating = true;
    dialogError = '';
    const res = await sendMessage('CREATE_DECK', { deckName: name });
    creating = false;
    if (res.ok) {
      if (!decks.includes(name)) decks = [...decks, name];
      deckName = name;
      dialogOpen = false;
      await save(true);
    } else {
      dialogError = res.error.message;
    }
  }

  async function reset() {
    if (!confirm('Reset all configurations? This deletes your API keys and deck selection from the extension.')) return;
    await browser.storage.local.clear();
    const s = await getSettings();
    lookupMode = s.lookupMode;
    provider = s.llmProvider;
    hackclubApiKey = s.hackclubApiKey;
    hackclubModel = getDefaultModel('hackclub');
    openrouterApiKey = s.openrouterApiKey;
    openrouterModel = getDefaultModel('openrouter');
    mwKey = s.mwKey;
    deckName = s.deckName;
    noteTypeName = s.noteTypeName;
    fieldMapping = s.fieldMapping;
    cardFontSize = s.cardFontSize;
    noteTypeFields = [];
    showToast();
  }

  function goToGeneral() {
    lookupMode = 'ai';
    section = 'general';
    void save(true);
  }
</script>

<div class="settings-shell">
  <GlassPanel class="sidebar" radius={0}>
    <div class="sidebar-brand">
      <img src="/icons/icon48.png" alt="" class="brand-icon" />
      <div class="brand-text">
        <span class="brand-name">Glean</span>
        <span class="brand-version">Settings</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      {#each NAV as item}
        <button
          type="button"
          class="nav-item"
          class:active={section === item.id}
          onclick={() => (section = item.id)}
        >
          {item.label}
        </button>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <div class="anki-pill" class:pill-connected={ankiStatus === 'connected'} class:pill-offline={ankiStatus === 'offline'}>
        {#if ankiStatus === 'checking'}
          <LoaderCircle size={13} class="spin" />
          <span>Checking Anki...</span>
        {:else if ankiStatus === 'connected'}
          <CircleCheck size={13} />
          <span>Anki Connected</span>
        {:else}
          <CircleX size={13} />
          <span>Anki Offline</span>
        {/if}
      </div>
    </div>
  </GlassPanel>

  <main class="content">
    <div class="content-inner">
      {#if section === 'general'}
        <header class="content-header">
          <h1>General</h1>
          <p>Core lookup behavior and how the on-page card looks.</p>
        </header>

        <GlassPanel class="settings-card settings-stack">
          <section class="settings-section">
            <h2>Lookup Mode</h2>
            <div class="mode-toggle">
              <button
                type="button"
                class="mode-btn"
                class:active={lookupMode === 'ai'}
                onclick={() => setLookupMode('ai')}
              >
                AI-Powered
              </button>
              <button
                type="button"
                class="mode-btn"
                class:active={lookupMode === 'dictionary'}
                onclick={() => setLookupMode('dictionary')}
              >
                Dictionary Only
              </button>
            </div>
            <span class="field-hint">
              {#if lookupMode === 'dictionary'}
                Uses a free English dictionary and lets you choose the right sense before adding the card.
              {:else}
                Uses context to write a definition and example. Supports {supportedLanguageNames}.
              {/if}
            </span>
          </section>

          <section class="settings-section">
            <h2>Keyboard Shortcut</h2>
            <div class="shortcut-row">
              <span>Look up selection</span>
              <span class="badge badge-connected">{shortcutLabel}</span>
            </div>
            <span class="field-hint">Select a word on any page and press this shortcut. Change it from your browser's extension shortcuts settings.</span>
          </section>

          <section class="settings-section">
            <h2>Card Appearance</h2>
            <div class="form-group">
              <label for="select-card-font-size">Font Size</label>
              <select id="select-card-font-size" bind:value={cardFontSize} onchange={() => void save(true)}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </select>
              <span class="field-hint">Controls the text size of the lookup card shown on the page.</span>
            </div>
          </section>

          <section class="settings-section danger-section">
            <div class="danger-heading">
              <h2>Danger Zone</h2>
              <p>Irreversible actions. Proceed with care.</p>
            </div>
            <h3>Reset Everything</h3>
            <p class="section-desc">Wipes all extension configuration from API keys, deck selection, and note type mapping back to defaults. Cards already added to Anki are unaffected.</p>
            <button type="button" class="danger-button" onclick={reset}><Trash2 size={12} /> Reset All Configurations</button>
          </section>
        </GlassPanel>
      {:else if section === 'ai'}
        <header class="content-header">
          <h1>AI Provider</h1>
          <p>The language model that reads context and writes definitions.</p>
        </header>

        {#if lookupMode !== 'ai'}
          <GlassPanel class="settings-card empty-state">
            <TriangleAlert size={22} strokeWidth={1.75} />
            <p>AI-powered lookup is turned off. Switch to AI mode in General to configure a provider.</p>
            <button type="button" class="secondary-button" onclick={goToGeneral}>Go to General</button>
          </GlassPanel>
        {:else}
          <GlassPanel class="settings-card">
            <div class="form-group">
              <label for="select-llm-provider">Provider</label>
              <select id="select-llm-provider" bind:value={provider} onchange={() => void save(true)}>
                <option value="hackclub">Hack Club AI</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>

            {#if provider === 'hackclub'}
              <div class="provider-fields">
                <div class="form-group">
                  <div class="label-row">
                    <label for="input-hackclub-key">Hack Club AI API Key <span class="required">*</span></label>
                    <a href="https://ai.hackclub.com/dashboard" target="_blank" class="help-link">Get Free Key (for teens) <ExternalLink size={10} /></a>
                  </div>
                  <div class="input-wrapper">
                    <input
                      id="input-hackclub-key"
                      type={hcKeyVisible ? 'text' : 'password'}
                      placeholder="paste your hc_... key here"
                      bind:value={hackclubApiKey}
                      oninput={scheduleSave}
                    />
                    <button type="button" class="toggle-password-btn" title="Toggle key visibility" aria-label="Toggle key visibility" onclick={() => (hcKeyVisible = !hcKeyVisible)}>
                      {#if hcKeyVisible}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label for="input-hackclub-model">Model</label>
                  <input id="input-hackclub-model" type="text" placeholder="qwen/qwen3-32b" bind:value={hackclubModel} oninput={scheduleSave} />
                  <span class="field-hint">Any model Hack Club's proxy supports. The default works for most people.</span>
                </div>
              </div>
            {:else}
              <div class="provider-fields">
                <div class="form-group">
                  <div class="label-row">
                    <label for="input-openrouter-key">OpenRouter API Key <span class="required">*</span></label>
                    <a href="https://openrouter.ai/keys" target="_blank" class="help-link">Get Key <ExternalLink size={10} /></a>
                  </div>
                  <div class="input-wrapper">
                    <input
                      id="input-openrouter-key"
                      type={orKeyVisible ? 'text' : 'password'}
                      placeholder="paste your sk-or-... key here"
                      bind:value={openrouterApiKey}
                      oninput={scheduleSave}
                    />
                    <button type="button" class="toggle-password-btn" title="Toggle key visibility" aria-label="Toggle key visibility" onclick={() => (orKeyVisible = !orKeyVisible)}>
                      {#if orKeyVisible}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label for="input-openrouter-model">Model</label>
                  <input id="input-openrouter-model" type="text" placeholder="meta-llama/llama-3.3-70b-instruct:free" bind:value={openrouterModel} oninput={scheduleSave} />
                  <span class="field-hint">Any <a href="https://openrouter.ai/models" target="_blank">OpenRouter model ID</a>  free-tier ones end in <code>:free</code>.</span>
                </div>
              </div>
            {/if}

            <div class="validation-row">
              <button type="button" class="secondary-button" disabled={testingKey} onclick={testKey}>Test API Key</button>
              {#if keyStatus}
                <span class="status-msg" class:status-success={keyStatus.type === 'success'} class:status-error={keyStatus.type === 'error'}>{keyStatus.msg}</span>
              {/if}
            </div>
            <span class="field-hint">Glean auto-detects the word's language and writes the definition in that language. Supported: {supportedLanguageNames}. The dictionary-verified "Meaning" field is English-only as of now!</span>
          </GlassPanel>
        {/if}
      {:else if section === 'audio'}
        <header class="content-header">
          <h1>Pronunciation Audio</h1>
          <p>Where the card's pronunciation clip comes from.</p>
        </header>

        <GlassPanel class="settings-card">
          <div class="form-group">
            <div class="label-row">
              <label for="input-mw-key">Merriam-Webster Key <span class="optional">(optional)</span></label>
              <a href="https://dictionaryapi.com/" target="_blank" class="help-link">Register Key <ExternalLink size={10} /></a>
            </div>
            <div class="input-wrapper">
              <input
                id="input-mw-key"
                type={mwKeyVisible ? 'text' : 'password'}
                placeholder="paste your MW Collegiate key here"
                bind:value={mwKey}
                oninput={scheduleSave}
              />
              <button type="button" class="toggle-password-btn" title="Toggle key visibility" aria-label="Toggle key visibility" onclick={() => (mwKeyVisible = !mwKeyVisible)}>
                {#if mwKeyVisible}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
              </button>
            </div>
            <span class="field-hint">Enables premium native US pronunciations for English words. Other supported languages always use automatic native-language pronunciation.</span>
          </div>
        </GlassPanel>
      {:else if section === 'anki'}
        <header class="content-header">
          <h1>Anki Integration</h1>
          <p>Where new cards go, and how Glean's data maps to your note type.</p>
        </header>

        <GlassPanel class="settings-card">
          <div class="anki-status-area">
            <div class="status-indicator-box">
              <span class="status-label">Anki Status:</span>
              {#if ankiStatus === 'checking'}
                <span class="badge badge-checking"><LoaderCircle size={11} class="spin" /> Checking...</span>
              {:else if ankiStatus === 'connected'}
                <span class="badge badge-connected"><CircleCheck size={11} /> Connected</span>
              {:else}
                <span class="badge badge-offline"><CircleX size={11} /> Offline</span>
              {/if}
            </div>
            <button type="button" class="secondary-button" onclick={testAnki}><RefreshCw size={11} /> Refresh</button>
          </div>

          <div class="form-group">
            <label for="select-deck">Target Deck</label>
            <div class="input-row">
              <select id="select-deck" class="deck-select" bind:value={deckName} onchange={() => void save(true)}>
                {#each decks as deck}
                  <option value={deck}>{deck}</option>
                {/each}
              </select>
              <button type="button" class="secondary-button" onclick={() => { dialogOpen = true; newDeckName = ''; dialogError = ''; }}><Plus size={11} /> New Deck</button>
            </div>
            <span class="field-hint">New vocabulary notes will be created inside this deck.</span>
          </div>

          <div class="form-group">
            <label for="select-note-type">Note Type</label>
            <select id="select-note-type" bind:value={noteTypeName} onchange={onNoteTypeChange}>
              {#each noteTypes as nt}
                <option value={nt}>{nt}{nt === DEFAULT_NOTE_TYPE_NAME ? ' (default)' : ''}</option>
              {/each}
            </select>
            <span class="field-hint">
              {#if noteTypeName === DEFAULT_NOTE_TYPE_NAME}
                Glean manages this note type automatically, its fields and card template stay in sync.
              {:else}
                Using your own note type. Map Glean's data to its fields below, Word and Definition are required, everything else can be skipped.
              {/if}
            </span>
          </div>

          {#if noteTypeName !== DEFAULT_NOTE_TYPE_NAME}
            <div class="provider-fields">
              {#if loadingNoteTypeFields}
                <span class="field-hint">Loading fields…</span>
              {:else}
                {#each GLEAN_FIELDS as f}
                  <div class="form-group">
                    <label for="map-{f.key}">{f.label}{f.required ? ' *' : ''}</label>
                    <select id="map-{f.key}" bind:value={fieldMapping[f.key]} onchange={() => void save(true)}>
                      {#if !f.required}
                        <option value="">- Don't use -</option>
                      {/if}
                      {#each noteTypeFields as nf}
                        <option value={nf}>{nf}</option>
                      {/each}
                    </select>
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </GlassPanel>
      {/if}
    </div>
  </main>
</div>

<GlassPanel class="toast {toastVisible ? 'show' : ''}" radius={20}>Settings saved automatically</GlassPanel>

{#if dialogOpen}
  <div class="dialog-overlay">
    <GlassPanel class="dialog">
      <div class="dialog-header">
        <h3>Create New Deck</h3>
        <button type="button" class="dialog-close" aria-label="Close" onclick={() => (dialogOpen = false)}><X size={14} /></button>
      </div>
      <input type="text" placeholder="e.g., French Vocab" bind:value={newDeckName} onkeydown={(e) => e.key === 'Enter' && createDeck()} />
      {#if dialogError}<span class="status-msg status-error">{dialogError}</span>{/if}
      <div class="dialog-actions">
        <button class="dialog-btn cancel" onclick={() => (dialogOpen = false)}>Cancel</button>
        <button class="dialog-btn confirm" disabled={creating} onclick={createDeck}>{creating ? 'Creating...' : 'Create'}</button>
      </div>
    </GlassPanel>
  </div>
{/if}
