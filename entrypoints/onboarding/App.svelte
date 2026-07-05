<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import GlassFilter from '../../components/GlassFilter.svelte';
  import { initLiquidGlass } from '../../lib/liquid-glass';
  import { sendMessage } from '../../lib/messaging';
  import { setSettings } from '../../lib/storage';

  const TOTAL_STEPS = 5;
  const CONFETTI_COLORS = ['#6366f1', '#a855f7', '#d946ef', '#10b981', '#3b82f6'];

  let currentStep = $state(0);
  let apiKey = $state('');
  let verifying = $state(false);
  let hasVerifiedApiKey = $state(false);
  let apiStatus = $state<{ msg: string; type: 'success' | 'error' | 'checking' } | null>(null);

  let ankiStatus = $state<{ msg: string; type: 'success' | 'error' | 'checking' } | null>(null);
  let ankiRunning = $state(false);
  let canFinishAnki = $state(false);

  let decks = $state<string[]>(['Glean']);
  let selectedDeck = $state('Glean');

  interface Particle {
    left: number;
    size: number;
    delay: number;
    duration: number;
    color: string;
    rotate: number;
  }
  let confetti = $state<Particle[]>([]);

  onMount(() => initLiquidGlass());

  function goToStep(index: number) {
    if (index < 0 || index >= TOTAL_STEPS) return;
    currentStep = index;
    if (index === 4) triggerConfetti();
  }

  async function verifyKey() {
    const key = apiKey.trim();
    if (!key) {
      apiStatus = { msg: 'Please paste an API key first.', type: 'error' };
      return;
    }
    verifying = true;
    apiStatus = { msg: 'Verifying connection...', type: 'checking' };
    const res = await sendMessage('TEST_API_KEY', { provider: 'hackclub', apiKey: key });
    verifying = false;
    if (res.ok && res.data.valid) {
      apiStatus = { msg: 'Verification successful! API Key saved.', type: 'success' };
      hasVerifiedApiKey = true;
      await setSettings({ llmProvider: 'hackclub', hackclubApiKey: key });
    } else {
      const err = res.ok ? res.data.error : res.error.message;
      apiStatus = { msg: `Verification failed: ${err ?? 'Invalid API Key.'}`, type: 'error' };
      hasVerifiedApiKey = false;
    }
  }

  async function testAnki() {
    ankiStatus = { msg: 'Connecting to AnkiConnect...', type: 'checking' };
    const res = await sendMessage('CHECK_ANKI', undefined);
    if (res.ok && res.data.connected) {
      ankiStatus = { msg: 'Anki is online! Connected successfully.', type: 'success' };
      ankiRunning = true;
      canFinishAnki = true;
      await loadDecks();
    } else {
      ankiStatus = { msg: 'Anki offline. Check that Anki is open with AnkiConnect installed.', type: 'error' };
      ankiRunning = false;
      canFinishAnki = false;
    }
  }

  async function loadDecks() {
    const res = await sendMessage('GET_DECKS', undefined);
    if (!res.ok) return;
    const list = res.data.decks;
    if (!list.includes('Glean')) list.push('Glean');
    decks = list;
  }

  async function finish() {
    await setSettings({ deckName: selectedDeck });
    await browser.storage.local.set({ isConfigured: true });
    const tab = await browser.tabs.getCurrent();
    if (tab?.id) browser.tabs.remove(tab.id);
  }

  function triggerConfetti() {
    confetti = Array.from({ length: 100 }, () => ({
      left: Math.random() * window.innerWidth,
      size: Math.random() * 8 + 6,
      delay: Math.random() * 0.5,
      duration: Math.random() * 2 + 1.5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
      rotate: Math.random() * 360,
    }));
  }
</script>

<GlassFilter />

<div class="welcome-container">
  <header class="wizard-header">
    <div class="steps-indicator">
      {#each Array(TOTAL_STEPS) as _, i}
        <span class="step-dot" class:active={currentStep === i}></span>
      {/each}
    </div>
  </header>

  <main class="wizard-card glass-panel">
    <section class="wizard-step" class:active={currentStep === 0}>
      <div class="welcome-hero">
        <img src="/icons/icon128.png" alt="" class="hero-icon" />
        <h1>Glean</h1>
        <p class="hero-tagline">See a new word. One click. It's in Anki.</p>
      </div>
      <div class="demo-box">
        <div class="demo-page">
          <span class="demo-text">The universe is full of </span>
          <span class="demo-highlight">ephemeral</span>
          <span class="demo-text"> beauty that fades in a moment.</span>
        </div>
      </div>
      <div class="actions-row">
        <button type="button" class="primary-btn" onclick={() => goToStep(1)}>Get Started</button>
      </div>
    </section>

    <section class="wizard-step" class:active={currentStep === 1}>
      <h2>Connect to AI Translation</h2>
      <p class="step-desc">Glean uses AI to translate words and write example sentences based on context. Get your free key in 30 seconds.</p>
      <div class="card-action-box">
        <a href="https://ai.hackclub.com/dashboard" target="_blank" class="dashboard-btn">Get Free API Key (For teens)</a>
      </div>
      <div class="form-group">
        <label for="input-api-key">Paste your Hack Club AI API Key:</label>
        <div class="input-row">
          <input id="input-api-key" type="password" placeholder="hc_..." bind:value={apiKey} />
          <button type="button" class="secondary-btn" disabled={verifying} onclick={verifyKey}>Verify Key</button>
        </div>
        {#if apiStatus}
          <span class="status-msg" class:status-success={apiStatus.type === 'success'} class:status-error={apiStatus.type === 'error'}>{apiStatus.msg}</span>
        {/if}
      </div>
      <div class="actions-row">
        <button type="button" class="secondary-btn" onclick={() => goToStep(0)}>Back</button>
        <button type="button" class="primary-btn" disabled={!hasVerifiedApiKey} onclick={() => goToStep(2)}>Next Step</button>
      </div>
    </section>

    <section class="wizard-step" class:active={currentStep === 2}>
      <h2>Connect to Anki</h2>
      <p class="step-desc">Glean integrates directly with your desktop study deck. Make sure Anki is open.</p>
      <div class="checklist">
        <div class="check-item">
          <input id="chk-installed" type="checkbox" checked disabled />
          <label for="chk-installed">Anki Desktop application is installed.</label>
        </div>
        <div class="check-item">
          <span class="bullet">&gt;</span>
          <div>
            <strong>AnkiConnect Add-on is installed:</strong><br />
            In Anki: Go to Tools > Add-ons > Get Add-ons, enter code 2055492159, and restart Anki.
          </div>
        </div>
        <div class="check-item">
          <input id="chk-running" type="checkbox" checked={ankiRunning} disabled />
          <label for="chk-running" style={ankiStatus?.type === 'error' ? 'color: var(--danger-strong);' : ankiRunning ? 'color: var(--success);' : ''}>Anki is currently open and running.</label>
        </div>
      </div>
      <div class="anki-test-row">
        <button type="button" class="secondary-btn" onclick={testAnki}>Test Connection</button>
        {#if ankiStatus}
          <span class="status-msg" class:status-success={ankiStatus.type === 'success'} class:status-error={ankiStatus.type === 'error'}>{ankiStatus.msg}</span>
        {/if}
      </div>
      <div class="actions-row">
        <button type="button" class="secondary-btn" onclick={() => goToStep(1)}>Back</button>
        <div class="nav-right">
          <button type="button" class="text-link-btn" onclick={() => goToStep(3)}>Skip for now</button>
          <button type="button" class="primary-btn" disabled={!canFinishAnki} onclick={() => goToStep(3)}>Next Step</button>
        </div>
      </div>
    </section>

    <section class="wizard-step" class:active={currentStep === 3}>
      <h2>Select Target Deck</h2>
      <p class="step-desc">Choose which vocabulary deck newly added flashcards should go to. We will create it if it doesn't exist.</p>
      <div class="form-group">
        <label for="select-deck">Choose Target Deck:</label>
        <select id="select-deck" bind:value={selectedDeck}>
          {#each decks as deck}
            <option value={deck}>{deck}</option>
          {/each}
        </select>
      </div>
      <div class="actions-row">
        <button type="button" class="secondary-btn" onclick={() => goToStep(2)}>Back</button>
        <button type="button" class="primary-btn" onclick={() => goToStep(4)}>Next Step</button>
      </div>
    </section>

    <section class="wizard-step" class:active={currentStep === 4}>
      <div class="celebration-hero">
        <h2>You are All Set</h2>
        <p>Glean is configured and ready to build your vocabulary.</p>
      </div>
      <div class="tutorial-card glass-panel">
        <h3>How to use:</h3>
        <div class="tutorial-step">
          <span class="step-num">1</span>
          <span class="step-text">Right-click a word on any website and choose "Glean: Add Word".</span>
        </div>
        <div class="tutorial-step">
          <span class="step-num">2</span>
          <span class="step-text">Review the pronunciation, context-aware definition, and example sentence.</span>
        </div>
        <div class="tutorial-step">
          <span class="step-num">3</span>
          <span class="step-text">Click "Add to Anki" - that is it!</span>
        </div>
      </div>
      <div class="actions-row">
        <button type="button" class="primary-btn finish-btn" onclick={finish}>Start Studying!</button>
      </div>
    </section>
  </main>
</div>

<div class="confetti-container">
  {#each confetti as p}
    <div
      class="confetti-particle"
      style="left:{p.left}px;width:{p.size}px;height:{p.size}px;background-color:{p.color};animation-delay:{p.delay}s;animation-duration:{p.duration}s;transform:rotate({p.rotate}deg);"
    ></div>
  {/each}
</div>
