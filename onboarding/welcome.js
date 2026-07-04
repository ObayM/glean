document.addEventListener('DOMContentLoaded', () => {
  const steps = Array.from(document.querySelectorAll('.wizard-step'));
  const btnNextList = Array.from(document.querySelectorAll('.btn-next'));
  const btnPrevList = Array.from(document.querySelectorAll('.btn-prev'));
  const progressBar = document.getElementById('progress-bar');
  const stepDots = Array.from(document.querySelectorAll('.step-dot'));

  const inputApiKey = document.getElementById('input-api-key');
  const btnVerifyKey = document.getElementById('btn-verify-key');
  const apiVerifyStatus = document.getElementById('api-verify-status');
  const btnNextStep2 = document.getElementById('btn-next-step2');

  const checkRunning = document.getElementById('check-running');
  const lblRunning = document.getElementById('lbl-running');
  const btnTestAnki = document.getElementById('btn-test-anki');
  const ankiVerifyStatus = document.getElementById('anki-verify-status');
  const btnNextStep3 = document.getElementById('btn-next-step3');
  const btnSkipAnki = document.getElementById('btn-skip-anki');

  const selectDeck = document.getElementById('select-deck');

  const btnFinish = document.getElementById('btn-finish');
  const confettiContainer = document.getElementById('confetti-container');

  let currentStepIndex = 0;
  let hasVerifiedApiKey = false;

  function goToStep(index) {
    if (index < 0 || index >= steps.length) return;

    steps[currentStepIndex].classList.remove('active');
    stepDots[currentStepIndex].classList.remove('active');

    currentStepIndex = index;
    steps[currentStepIndex].classList.add('active');
    stepDots[currentStepIndex].classList.add('active');

    const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    if (currentStepIndex === 4) {
      triggerConfetti();
    }
  }

  btnNextList.forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStepIndex === 1 && !hasVerifiedApiKey) return;
      goToStep(currentStepIndex + 1);
    });
  });

  btnPrevList.forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(currentStepIndex - 1);
    });
  });

  btnVerifyKey.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      updateStatus(apiVerifyStatus, 'Please paste an API key first.', 'error');
      return;
    }

    btnVerifyKey.disabled = true;
    updateStatus(apiVerifyStatus, 'Verifying connection...', 'checking');

    chrome.runtime.sendMessage({
      type: 'TEST_API_KEY',
      payload: { apiKey: key }
    }, (response) => {
      btnVerifyKey.disabled = false;
      if (chrome.runtime.lastError) {
        updateStatus(apiVerifyStatus, `Error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success && response.data.valid) {
        updateStatus(apiVerifyStatus, 'Verification successful! API Key saved.', 'success');
        hasVerifiedApiKey = true;
        btnNextStep2.disabled = false;
        chrome.storage.local.set({ apiKey: key });
      } else {
        const errorMsg = response?.error || 'Invalid API Key. Please verify and try again.';
        updateStatus(apiVerifyStatus, `Verification failed: ${errorMsg}`, 'error');
        hasVerifiedApiKey = false;
        btnNextStep2.disabled = true;
      }
    });
  });

  function updateStatus(element, message, type) {
    element.textContent = message;
    element.className = 'status-msg';

    if (type === 'success') {
      element.classList.add('status-success');
    } else if (type === 'error') {
      element.classList.add('status-error');
    } else {
      element.style.color = 'var(--body-subtle)';
    }
  }

  btnTestAnki.addEventListener('click', verifyAnkiConnection);
  btnSkipAnki.addEventListener('click', () => {
    goToStep(3);
  });

  function verifyAnkiConnection() {
    updateStatus(ankiVerifyStatus, 'Connecting to AnkiConnect...', 'checking');

    chrome.runtime.sendMessage({ type: 'CHECK_ANKI' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success || !response.data || !response.data.connected) {
        updateStatus(ankiVerifyStatus, 'Anki offline. Check that Anki is open with AnkiConnect installed.', 'error');
        checkRunning.checked = false;
        lblRunning.style.color = 'var(--danger-strong)';
        btnNextStep3.disabled = true;
        return;
      }

      updateStatus(ankiVerifyStatus, 'Anki is online! Connected successfully.', 'success');
      checkRunning.checked = true;
      lblRunning.style.color = 'var(--success)';
      btnNextStep3.disabled = false;

      loadDeckOptions();
    });
  }

  function loadDeckOptions() {
    chrome.runtime.sendMessage({ type: 'GET_DECKS' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        return;
      }

      const decks = response.data.decks || [];
      selectDeck.innerHTML = '';

      decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck;
        option.textContent = deck;
        if (deck === 'Glean') {
          option.selected = true;
        }
        selectDeck.appendChild(option);
      });

      if (!decks.includes('Glean')) {
        const option = document.createElement('option');
        option.value = 'Glean';
        option.textContent = 'Glean (Create New)';
        option.selected = true;
        selectDeck.appendChild(option);
      }
    });
  }

  btnFinish.addEventListener('click', () => {
    chrome.storage.local.set({
      deckName: selectDeck.value,
      isConfigured: true
    }, () => {
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id) {
          chrome.tabs.remove(tab.id);
        }
      });
    });
  });

  function triggerConfetti() {
    confettiContainer.innerHTML = '';
    const particleCount = 100;
    const colors = ['#6366f1', '#a855f7', '#d946ef', '#10b981', '#3b82f6'];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';

      const startX = Math.random() * window.innerWidth;
      const size = Math.random() * 8 + 6;
      const delay = Math.random() * 0.5;
      const duration = Math.random() * 2 + 1.5;
      const color = colors[Math.floor(Math.random() * colors.length)];

      particle.style.left = `${startX}px`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.backgroundColor = color;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.transform = `rotate(${Math.random() * 360}deg)`;

      confettiContainer.appendChild(particle);

      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, (duration + delay) * 1000);
    }
  }

  initLiquidGlass();
});
