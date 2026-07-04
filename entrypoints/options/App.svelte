<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import GlassFilter from '../../components/GlassFilter.svelte';
  import { getDefaultModel } from '../../lib/llm-api';
  import { initLiquidGlass } from '../../lib/liquid-glass';
  import { sendMessage } from '../../lib/messaging';
  import { getSettings, setSettings } from '../../lib/storage';
  import type { LlmProvider } from '../../lib/types';

  let provider = $state<LlmProvider>('hackclub');
  let hackclubApiKey = $state('');
  let hackclubModel = $state('');
  let openrouterApiKey = $state('');
  let openrouterModel = $state('');
  let mwKey = $state('');
  let deckName = $state('Glean');
  let decks = $state<string[]>(['Glean']);

  let ankiStatus = $state<'checking' | 'connected' | 'offline'>('checking');
  let keyStatus = $state<{ msg: string; type: 'success' | 'error' | 'checking' } | null>(null);
  let testingKey = $state(false);
  let toastVisible = $state(false);

  let dialogOpen = $state(false);
  let newDeckName = $state('');
  let creating = $state(false);
  let dialogError = $state('');

  let hcKeyEl = $state<HTMLInputElement>();
  let orKeyEl = $state<HTMLInputElement>();
  let mwKeyEl = $state<HTMLInputElement>();

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(async () => {
    initLiquidGlass();
    const s = await getSettings();
    provider = s.llmProvider;
    hackclubApiKey = s.hackclubApiKey;
    hackclubModel = s.hackclubModel || getDefaultModel('hackclub');
    openrouterApiKey = s.openrouterApiKey;
    openrouterModel = s.openrouterModel || getDefaultModel('openrouter');
    mwKey = s.mwKey;
    deckName = s.deckName;
    await testAnki();
  });

  async function save(notify = true) {
    await setSettings({
      llmProvider: provider,
      hackclubApiKey: hackclubApiKey.trim(),
      hackclubModel: hackclubModel.trim(),
      openrouterApiKey: openrouterApiKey.trim(),
      openrouterModel: openrouterModel.trim(),
      mwKey: mwKey.trim(),
      deckName,
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

  function togglePassword(el: HTMLInputElement | undefined) {
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
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
    provider = s.llmProvider;
    hackclubApiKey = s.hackclubApiKey;
    hackclubModel = getDefaultModel('hackclub');
    openrouterApiKey = s.openrouterApiKey;
    openrouterModel = getDefaultModel('openrouter');
    mwKey = s.mwKey;
    deckName = s.deckName;
    showToast();
  }
</script>

<GlassFilter />

<div class="options-container">
  <header class="header">
    <div class="brand">
      <img src="/icons/icon48.png" alt="" class="brand-icon" />
      <h1>Glean Settings</h1>
    </div>
    <span class="version">v1.0.0</span>
  </header>

  <main class="settings-panel">
    <div class="settings-card glass-panel">
      <h2><i class="fa-solid fa-robot"></i> AI Provider</h2>

      <div class="form-group">
        <label for="select-llm-provider">Provider</label>
        <select
          id="select-llm-provider"
          bind:value={provider}
          onchange={() => void save(true)}
        >
          <option value="hackclub">Hack Club AI (Free)</option>
          <option value="openrouter">OpenRouter (Bring your own key)</option>
        </select>
      </div>

      {#if provider === 'hackclub'}
        <div class="provider-fields">
          <div class="form-group">
            <div class="label-row">
              <label for="input-hackclub-key">Hack Club AI API Key <span class="required">*</span></label>
              <a href="https://ai.hackclub.com/dashboard" target="_blank" class="help-link">Get Free Key (for teens)<i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            </div>
            <div class="input-wrapper">
              <input id="input-hackclub-key" type="password" placeholder="paste your hc_... key here" bind:this={hcKeyEl} bind:value={hackclubApiKey} oninput={scheduleSave} />
              <button type="button" class="toggle-password-btn" title="Show key" aria-label="Toggle key visibility" onclick={() => togglePassword(hcKeyEl)}><i class="fa-solid fa-eye"></i></button>
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
              <a href="https://openrouter.ai/keys" target="_blank" class="help-link">Get Key <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            </div>
            <div class="input-wrapper">
              <input id="input-openrouter-key" type="password" placeholder="paste your sk-or-... key here" bind:this={orKeyEl} bind:value={openrouterApiKey} oninput={scheduleSave} />
              <button type="button" class="toggle-password-btn" title="Show key" aria-label="Toggle key visibility" onclick={() => togglePassword(orKeyEl)}><i class="fa-solid fa-eye"></i></button>
            </div>
          </div>
          <div class="form-group">
            <label for="input-openrouter-model">Model</label>
            <input id="input-openrouter-model" type="text" placeholder="meta-llama/llama-3.3-70b-instruct:free" bind:value={openrouterModel} oninput={scheduleSave} />
            <span class="field-hint">Any <a href="https://openrouter.ai/models" target="_blank">OpenRouter model ID</a> — free-tier ones end in <code>:free</code>.</span>
          </div>
        </div>
      {/if}

      <div class="validation-row">
        <button type="button" class="secondary-button" disabled={testingKey} onclick={testKey}>Test API Key</button>
        {#if keyStatus}
          <span class="status-msg" class:status-success={keyStatus.type === 'success'} class:status-error={keyStatus.type === 'error'}>{keyStatus.msg}</span>
        {/if}
      </div>
    </div>

    <div class="settings-card glass-panel">
      <h2><i class="fa-solid fa-volume-high"></i> Pronunciation Audio</h2>
      <div class="form-group">
        <div class="label-row">
          <label for="input-mw-key">Merriam-Webster Key <span class="optional">(optional)</span></label>
          <a href="https://dictionaryapi.com/" target="_blank" class="help-link">Register Key <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        </div>
        <div class="input-wrapper">
          <input id="input-mw-key" type="password" placeholder="paste your MW Collegiate key here" bind:this={mwKeyEl} bind:value={mwKey} oninput={scheduleSave} />
          <button type="button" class="toggle-password-btn" title="Show key" aria-label="Toggle key visibility" onclick={() => togglePassword(mwKeyEl)}><i class="fa-solid fa-eye"></i></button>
        </div>
        <span class="field-hint">Enables premium native US pronunciations. Leave empty to use the Free Dictionary API instead.</span>
      </div>
    </div>

    <div class="settings-card glass-panel">
      <h2><i class="fa-solid fa-plug"></i> Anki Integration</h2>
      <div class="anki-status-area">
        <div class="status-indicator-box">
          <span class="status-label">Anki Status:</span>
          {#if ankiStatus === 'checking'}
            <span class="badge badge-checking"><i class="fa-solid fa-spinner fa-spin"></i> Checking...</span>
          {:else if ankiStatus === 'connected'}
            <span class="badge badge-connected"><i class="fa-solid fa-circle-check"></i> Connected</span>
          {:else}
            <span class="badge badge-offline"><i class="fa-solid fa-circle-xmark"></i> Offline</span>
          {/if}
        </div>
        <button type="button" class="secondary-button" onclick={testAnki}><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>

      <div class="form-group">
        <label for="select-deck">Target Deck</label>
        <div class="input-row">
          <select id="select-deck" class="deck-select" bind:value={deckName} onchange={() => void save(true)}>
            {#each decks as deck}
              <option value={deck}>{deck}</option>
            {/each}
          </select>
          <button type="button" class="secondary-button" onclick={() => { dialogOpen = true; newDeckName = ''; dialogError = ''; }}><i class="fa-solid fa-plus"></i> New Deck</button>
        </div>
        <span class="field-hint">New vocabulary notes will be created inside this deck.</span>
      </div>
    </div>

    <div class="settings-card danger-card glass-panel">
      <h2><i class="fa-solid fa-trash"></i> Danger Zone</h2>
      <p class="section-desc">Reset all extension configurations to defaults.</p>
      <button type="button" class="danger-button" onclick={reset}><i class="fa-solid fa-trash"></i> Reset All Configurations</button>
    </div>
  </main>

  <div class="toast" class:show={toastVisible}>Settings saved automatically</div>
</div>

{#if dialogOpen}
  <div class="dialog-overlay">
    <div class="dialog glass-panel">
      <h3>Create New Deck</h3>
      <input type="text" placeholder="e.g., French Vocab" bind:value={newDeckName} onkeydown={(e) => e.key === 'Enter' && createDeck()} />
      {#if dialogError}<span class="status-msg status-error">{dialogError}</span>{/if}
      <div class="dialog-actions">
        <button class="dialog-btn cancel" onclick={() => (dialogOpen = false)}>Cancel</button>
        <button class="dialog-btn confirm" disabled={creating} onclick={createDeck}>{creating ? 'Creating...' : 'Create'}</button>
      </div>
    </div>
  </div>
{/if}
