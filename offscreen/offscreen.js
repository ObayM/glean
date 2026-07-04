chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen' && message.type === 'PLAY_AUDIO') {
    playAudio(message.payload.audioUrl);
  }
});

function playAudio(url) {
  const existing = document.getElementById('glean-audio');
  if (existing) {
    existing.parentNode.removeChild(existing);
  }

  const audio = new Audio(url);
  audio.id = 'glean-audio';
  document.body.appendChild(audio);
  audio.play().catch(e => console.error('[Glean Offscreen] Audio play failed:', e));
}
