document.addEventListener('DOMContentLoaded', () => {
  const btnSettings = document.getElementById('btn-settings');
  const btnOnboarding = document.getElementById('btn-onboarding');
  const setupPrompt = document.getElementById('setup-prompt');

  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');
  const targetDeckName = document.getElementById('target-deck-name');

  const statsCard = document.getElementById('stats-card');
  const statsToday = document.getElementById('stats-today');
  const statsTotal = document.getElementById('stats-total');
  const recentList = document.getElementById('recent-list');

  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  if (btnOnboarding) {
    btnOnboarding.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  function refreshUI() {
    chrome.storage.local.get({
      apiKey: '',
      deckName: 'Glean',
      recentWords: [],
      stats: { todayCount: 0, totalCount: 0, todayDate: '' }
    }, (items) => {
      if (!items.apiKey) {
        setupPrompt.classList.remove('hidden');
      } else {
        setupPrompt.classList.add('hidden');
      }

      targetDeckName.textContent = items.deckName;

      const todayStr = new Date().toDateString();
      let todayCount = 0;
      if (items.stats && items.stats.todayDate === todayStr) {
        todayCount = items.stats.todayCount;
      }
      const totalCount = items.stats?.totalCount || 0;
      statsToday.textContent = todayCount;
      statsTotal.textContent = totalCount;
      statsCard.classList.toggle('hidden', totalCount === 0);

      populateRecentList(items.recentWords);
    });

    chrome.runtime.sendMessage({ type: 'CHECK_ANKI' }, (response) => {
      if (chrome.runtime.lastError) {
        setConnectionState(false, 'Disconnected');
        return;
      }

      if (response && response.success && response.data && response.data.connected) {
        setConnectionState(true, 'Connected');
      } else {
        setConnectionState(false, 'Offline');
      }
    });
  }

  function setConnectionState(isConnected, text) {
    connectionDot.className = 'dot';
    if (isConnected) {
      connectionDot.classList.add('dot-connected');
    } else {
      connectionDot.classList.add('dot-disconnected');
    }
    connectionText.textContent = text;
  }

  function populateRecentList(words) {
    recentList.innerHTML = '';

    if (!words || words.length === 0) {
      recentList.innerHTML = `<li class="empty-message">Highlight 1-3 words on any page to glean your first word.</li>`;
      return;
    }

    const displayedWords = words.slice(-5).reverse();

    displayedWords.forEach(item => {
      const li = document.createElement('li');
      li.className = 'recent-item';

      const timeStr = formatRelativeTime(item.timestamp);
      li.innerHTML = `
        <div class="recent-header">
          <span class="recent-word">${escapeHtml(item.word)}</span>
          <span class="recent-time"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
          <i class="fa-solid fa-chevron-down recent-chevron"></i>
        </div>
        <div class="recent-details">
          <div class="detail-block">
            <div class="detail-label">Definition</div>
            <div class="detail-val">${escapeHtml(item.definition || '')}</div>
          </div>
          ${item.sentence ? `
            <div class="detail-block">
              <div class="detail-label">Context Sentence</div>
              <div class="detail-val italic">"${escapeHtml(item.sentence)}"</div>
            </div>
          ` : ''}
          ${item.example ? `
            <div class="detail-block">
              <div class="detail-label">AI Example</div>
              <div class="detail-val italic">"${escapeHtml(item.example)}"</div>
            </div>
          ` : ''}
        </div>
      `;

      li.addEventListener('click', (e) => {
        const isDetails = e.target.closest('.recent-details');
        if (isDetails) return;

        const wasActive = li.classList.contains('active');
        recentList.querySelectorAll('.recent-item').forEach(el => el.classList.remove('active'));
        if (!wasActive) {
          li.classList.add('active');
        }
      });

      recentList.appendChild(li);
    });
  }

  function formatRelativeTime(timestamp) {
    const elapsed = Date.now() - timestamp;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  initLiquidGlass();
  refreshUI();
});
