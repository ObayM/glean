<script lang="ts">
  import { onMount } from 'svelte';
  import { friendlyMessage } from '../../lib/errors';
  import { splitByWord } from '../../lib/highlight';
  import { sendMessage } from '../../lib/messaging';
  import type { WordData } from '../../lib/types';
  import { draggable, resizable } from './interactions';

  interface Props {
    word?: string;
    sentence?: string;
    pageUrl?: string;
    mode?: 'lookup' | 'prompt';
    host: HTMLElement;
    ondismiss: () => void;
  }

  let {
    word: initialWord = '',
    sentence = '',
    pageUrl = '',
    mode = 'lookup',
    host,
    ondismiss,
  }: Props = $props();

  type Phase = 'prompt' | 'loading' | 'preview' | 'error' | 'success';

  // svelte-ignore state_referenced_locally
  let phase = $state<Phase>(mode === 'prompt' ? 'prompt' : 'loading');
  // svelte-ignore state_referenced_locally
  let word = $state(initialWord);
  let data = $state<WordData | null>(null);
  let errorMsg = $state('');
  let adding = $state(false);
  let addError = $state('');
  let duplicate = $state(false);
  let drawn = $state(false);

  let inputEl = $state<HTMLInputElement>();
  let promptValue = $state('');

  const parts = $derived(data ? splitByWord(data.sentence, data.word) : []);

  onMount(() => {
    if (mode === 'lookup') void process();
    else queueMicrotask(() => inputEl?.focus());
  });

  async function process() {
    phase = 'loading';
    const res = await sendMessage('PROCESS_WORD', { word, sentence, pageUrl });
    if (!res.ok) {
      errorMsg = friendlyMessage(res.error);
      phase = 'error';
      return;
    }
    data = res.data;
    phase = 'preview';
    if (data.audioUrl) playAudio();
  }

  function submitPrompt() {
    const value = promptValue.trim();
    if (!value) return;
    word = value;
    sentence = `Manually added word: ${value}`;
    void process();
  }

  function playAudio() {
    if (!data?.audioUrl) return;
    void sendMessage('PLAY_AUDIO', { audioUrl: data.audioUrl });
  }

  async function add(force = false) {
    if (!data) return;
    adding = true;
    addError = '';
    const res = await sendMessage('ADD_TO_ANKI', {
      word: data.word,
      definition: data.definition,
      sentence: data.sentence,
      example: data.example,
      audioUrl: data.audioUrl,
      pageUrl: data.pageUrl,
      force,
    });
    adding = false;

    if (!res.ok) {
      addError = friendlyMessage(res.error);
      return;
    }
    if (res.data.status === 'duplicate') {
      duplicate = true;
      return;
    }
    phase = 'success';
    queueMicrotask(() => (drawn = true));
    setTimeout(ondismiss, 1300);
  }
</script>

{#if phase === 'success'}
  <div class="glean-card is-success">
    <div class="success-icon">
      <svg viewBox="0 0 52 52" style="display:block;width:100%;height:100%;">
        <circle
          cx="26" cy="26" r="25" fill="none"
          style="stroke:#34C759;stroke-width:2.5;stroke-dasharray:157;stroke-dashoffset:{drawn ? 0 : 157};transition:stroke-dashoffset 0.4s ease-out;"
        />
        <path
          d="M14.1 27.2l7.1 7.2 16.7-16.8" fill="none"
          style="stroke:#34C759;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:{drawn ? 0 : 40};transition:stroke-dashoffset 0.35s ease-out 0.15s;"
        />
      </svg>
    </div>
  </div>
{:else if phase === 'loading'}
  <div class="glean-card is-loading">
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <div class="loading-text">Analyzing "{word}"...</div>
    </div>
  </div>
{:else}
  <div class="glean-card {phase === 'error' ? 'is-error' : ''}">
    <div class="card-header">
      <span class="brand-logo" use:draggable={host}>Glean</span>
      <button class="btn-close" title="Dismiss (Esc)" onclick={ondismiss}>&times;</button>
    </div>

    {#if phase === 'error'}
      <div class="error-state">
        <div class="error-icon">[Error]</div>
        <div class="error-message">{errorMsg}</div>
        <button class="btn-retry" onclick={ondismiss}>Dismiss</button>
      </div>
    {:else if phase === 'prompt'}
      <div class="card-body">
        <div class="prompt-title">Add a word manually</div>
        <div class="prompt-input-group">
          <input
            id="prompt-word-input"
            type="text"
            placeholder="e.g. ephemeral"
            bind:this={inputEl}
            bind:value={promptValue}
            onkeydown={(e) => e.key === 'Enter' && submitPrompt()}
          />
        </div>
      </div>
      <div class="card-footer">
        <button class="btn-action btn-dismiss" onclick={ondismiss}>Cancel</button>
        <button class="btn-action btn-add" onclick={submitPrompt}>Look Up</button>
      </div>
    {:else if data}
      <div class="card-body">
        <div class="word-section">
          <div class="word-header">
            <span class="word-text">{data.word}</span>
            {#if data.audioUrl}
              <button class="btn-audio" title="Play pronunciation" onclick={playAudio} aria-label="Play pronunciation">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              </button>
            {/if}
          </div>
          {#if data.phonetic}<div class="word-phonetic">{data.phonetic}</div>{/if}
        </div>

        <div class="definition-section">
          <div class="definition-text">{data.definition}</div>
        </div>

        <hr class="divider" />

        <div class="context-section">
          <div class="context-label">Context Sentence</div>
          <div class="context-text">"{#each parts as part}{#if part.hit}<b>{part.text}</b>{:else}{part.text}{/if}{/each}"</div>
        </div>

        <div class="example-section">
          <div class="context-label">AI Example</div>
          <div class="context-text italic">"{data.example}"</div>
        </div>

        {#if duplicate}
          <div class="dup-note">"{data.word}" is already in your deck.</div>
        {/if}
        {#if addError}
          <div class="dup-note" style="color:#D1241C;background:rgba(255,59,48,0.08);border-color:rgba(255,59,48,0.2);">{addError}</div>
        {/if}
      </div>

      <div class="card-footer">
        <button class="btn-action btn-dismiss" onclick={ondismiss}>Dismiss</button>
        {#if duplicate}
          <button class="btn-action btn-add" disabled={adding} onclick={() => add(true)}>
            {#if adding}<span class="mini-spinner"></span> Adding...{:else}Add anyway{/if}
          </button>
        {:else}
          <button class="btn-action btn-add" disabled={adding} onclick={() => add(false)}>
            {#if adding}<span class="mini-spinner"></span> Adding...{:else}Add to Anki{/if}
          </button>
        {/if}
      </div>
    {/if}

    <div class="card-resizer" use:resizable></div>
  </div>
{/if}
