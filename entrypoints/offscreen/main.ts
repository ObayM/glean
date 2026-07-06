import type { OffscreenMessage } from '../../lib/types';

browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    message &&
    typeof message === 'object' &&
    (message as Record<string, unknown>).target === 'offscreen' &&
    (message as Record<string, unknown>).type === 'PLAY_AUDIO'
  ) {
    const msg = message as OffscreenMessage;
    playAudio(msg.payload.audioUrl);
  }
});

function playAudio(url: string): void {
  const existing = document.getElementById('glean-audio');
  if (existing) existing.remove();

  const audio = new Audio(url);
  audio.id = 'glean-audio';
  document.body.appendChild(audio);
  audio.play().catch((e) => console.error('[Glean Offscreen] Audio play failed:', e));
}
