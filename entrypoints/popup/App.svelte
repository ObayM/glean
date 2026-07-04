<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import GlassFilter from '../../components/GlassFilter.svelte';
  import { initLiquidGlass } from '../../lib/liquid-glass';
  import { sendMessage } from '../../lib/messaging';
  import { getHistory, getSettings } from '../../lib/storage';
  import type { RecentWord } from '../../lib/types';

  let connected = $state<boolean | null>(null);
  let connectionText = $state('Checking...');
  let deckName = $state('Checking...');
  let todayCount = $state(0);
  let totalCount = $state(0);
  let recentWords = $state<RecentWord[]>([]);
  let setupNeeded = $state(false);
  let expanded = $state<number | null>(null);

  const displayed = $derived([...recentWords].slice(-5).reverse());

  onMount(async () => {
    initLiquidGlass();
    await refresh();
  });

  async function refresh() {
    const settings = await getSettings();
    const activeKey =
      settings.llmProvider === 'openrouter' ? settings.openrouterApiKey : settings.hackclubApiKey;
    setupNeeded = !activeKey;
    deckName = settings.deckName;

    const { recentWords: recents, stats } = await getHistory();
    recentWords = recents;
    const todayStr = new Date().toDateString();
    todayCount = stats.todayDate === todayStr ? stats.todayCount : 0;
    totalCount = stats.totalCount;

    const res = await sendMessage('CHECK_ANKI', undefined);
    if (res.ok && res.data.connected) {
      connected = true;
      connectionText = 'Connected';
    } else {
      connected = false;
      connectionText = 'Offline';
    }
  }

  function openOptions() {
    browser.runtime.openOptionsPage();
  }

  function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function toggle(index: number) {
    expanded = expanded === index ? null : index;
  }
</script>

<GlassFilter />

<div class="popup-container">
  <header class="header">
    <div class="logo-area">
      <img src="/icons/icon48.png" alt="" class="logo-icon" />
      <span class="logo-text">Glean</span>
    </div>
    <button class="icon-button" title="Open Settings" onclick={openOptions} aria-label="Open Settings">
      <i class="fa-solid fa-gear"></i>
    </button>
  </header>

  <main class="main-content">
    <section class="status-card glass-panel">
      <div class="status-row">
        <span class="status-label"><i class="fa-solid fa-plug"></i> Anki Connection</span>
        <div class="status-indicator">
          <span
            class="dot"
            class:dot-connected={connected === true}
            class:dot-disconnected={connected === false}
            class:dot-unknown={connected === null}
          ></span>
          <span>{connectionText}</span>
        </div>
      </div>
      <div class="status-row">
        <span class="status-label"><i class="fa-solid fa-folder"></i> Target Deck</span>
        <span class="deck-badge">{deckName}</span>
      </div>
    </section>

    {#if totalCount > 0}
      <section class="stats-card glass-panel">
        <h3 class="card-title">Today's Activity</h3>
        <div class="stats-grid">
          <div class="stat-box">
            <i class="fa-solid fa-bolt stat-icon"></i>
            <span class="stat-number">{todayCount}</span>
            <span class="stat-label">Added Today</span>
          </div>
          <div class="stat-box">
            <i class="fa-solid fa-book stat-icon"></i>
            <span class="stat-number">{totalCount}</span>
            <span class="stat-label">Total Added</span>
          </div>
        </div>
      </section>
    {/if}

    <section class="recent-section glass-panel">
      <h3 class="section-title">Recent Snapshots</h3>
      <ul class="recent-list">
        {#if displayed.length === 0}
          <li class="empty-message">Highlight 1-3 words on any page to glean your first word.</li>
        {:else}
          {#each displayed as item, index}
            <li class="recent-item" class:active={expanded === index}>
              <div
                class="recent-header"
                role="button"
                tabindex="0"
                onclick={() => toggle(index)}
                onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(index)}
              >
                <span class="recent-word">{item.word}</span>
                <span class="recent-time"><i class="fa-regular fa-clock"></i> {formatRelativeTime(item.timestamp)}</span>
                <i class="fa-solid fa-chevron-down recent-chevron"></i>
              </div>
              <div class="recent-details">
                <div class="detail-block">
                  <div class="detail-label">Definition</div>
                  <div class="detail-val">{item.definition || ''}</div>
                </div>
                {#if item.sentence}
                  <div class="detail-block">
                    <div class="detail-label">Context Sentence</div>
                    <div class="detail-val italic">"{item.sentence}"</div>
                  </div>
                {/if}
                {#if item.example}
                  <div class="detail-block">
                    <div class="detail-label">AI Example</div>
                    <div class="detail-val italic">"{item.example}"</div>
                  </div>
                {/if}
              </div>
            </li>
          {/each}
        {/if}
      </ul>
    </section>

    {#if setupNeeded}
      <section class="setup-prompt glass-panel">
        <div class="setup-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3>API Key Required</h3>
        <p>You need to enter your Hack Club AI key to use Glean.</p>
        <button class="primary-button" onclick={openOptions}>Setup Now</button>
      </section>
    {/if}
  </main>
</div>
