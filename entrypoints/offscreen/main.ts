interface OffscreenMessage {
  target?: string;
  type?: string;
  payload?: { audioUrl: string };
}

browser.runtime.onMessage.addListener((message: OffscreenMessage) => {
  if (message.target === 'offscreen' && message.type === 'PLAY_AUDIO' && message.payload) {
    playAudio(message.payload.audioUrl);
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
