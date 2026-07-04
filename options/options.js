document.addEventListener('DOMContentLoaded', () => {
  const inputApiKey = document.getElementById('input-api-key');
  const inputMwKey = document.getElementById('input-mw-key');
  const selectDeck = document.getElementById('select-deck');

  const btnToggleApiKey = document.getElementById('btn-toggle-api-key');
  const btnToggleMwKey = document.getElementById('btn-toggle-mw-key');
  const btnTestApiKey = document.getElementById('btn-test-api-key');
  const btnTestAnki = document.getElementById('btn-test-anki');
  const btnCreateDeck = document.getElementById('btn-create-deck');
  const btnReset = document.getElementById('btn-reset');

  const apiKeyStatus = document.getElementById('api-key-status');
  const ankiConnectionBadge = document.getElementById('anki-connection-badge');
  const saveToast = document.getElementById('save-toast');

  const deckDialog = document.getElementById('deck-dialog');
  const inputNewDeck = document.getElementById('input-new-deck');
  const btnDialogCancel = document.getElementById('btn-dialog-cancel');
  const btnDialogConfirm = document.getElementById('btn-dialog-confirm');

  let activeToastTimeout = null;
  let autoSaveTimeout = null;

  btnToggleApiKey.addEventListener('click', () => togglePasswordVisibility(inputApiKey, btnToggleApiKey));
  btnToggleMwKey.addEventListener('click', () => togglePasswordVisibility(inputMwKey, btnToggleMwKey));

  function togglePasswordVisibility(inputEl, btnEl) {
    if (inputEl.type === 'password') {
      inputEl.type = 'text';
      btnEl.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
      btnEl.title = 'Hide key';
    } else {
      inputEl.type = 'password';
      btnEl.innerHTML = '<i class="fa-solid fa-eye"></i>';
      btnEl.title = 'Show key';
    }
  }

  function loadSettings() {
    chrome.storage.local.get({
      apiKey: '',
      mwKey: '',
      deckName: 'Glean'
    }, (items) => {
      inputApiKey.value = items.apiKey;
      inputMwKey.value = items.mwKey;

      testAnkiConnection();
      loadDeckOptions(items.deckName);
    });
  }

  function saveSettings(showNotification = true) {
    const newSettings = {
      apiKey: inputApiKey.value.trim(),
      mwKey: inputMwKey.value.trim(),
      deckName: selectDeck.value
    };

    chrome.storage.local.set(newSettings, () => {
      if (showNotification) {
        triggerToast();
      }
    });
  }

  const inputFields = [inputApiKey, inputMwKey];
  inputFields.forEach(field => {
    field.addEventListener('input', () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => saveSettings(true), 1000);
    });
  });

  selectDeck.addEventListener('change', () => saveSettings(true));

  function triggerToast() {
    if (activeToastTimeout) clearTimeout(activeToastTimeout);
    saveToast.classList.add('show');
    activeToastTimeout = setTimeout(() => {
      saveToast.classList.remove('show');
    }, 2000);
  }

  btnTestApiKey.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      updateStatus(apiKeyStatus, 'Please enter a key first.', 'error');
      return;
    }

    btnTestApiKey.disabled = true;
    updateStatus(apiKeyStatus, 'Testing key...', 'checking');

    chrome.runtime.sendMessage({
      type: 'TEST_API_KEY',
      payload: { apiKey: key }
    }, (response) => {
      btnTestApiKey.disabled = false;
      if (chrome.runtime.lastError) {
        updateStatus(apiKeyStatus, `Error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success && response.data.valid) {
        updateStatus(apiKeyStatus, 'API Key is valid.', 'success');
        saveSettings(false);
      } else {
        const err = response?.error || 'Invalid API key.';
        updateStatus(apiKeyStatus, `Verification failed: ${err}`, 'error');
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

  btnTestAnki.addEventListener('click', testAnkiConnection);

  async function testAnkiConnection() {
    ankiConnectionBadge.className = 'badge badge-checking';
    ankiConnectionBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

    chrome.runtime.sendMessage({ type: 'CHECK_ANKI' }, (response) => {
      if (chrome.runtime.lastError) {
        setAnkiStatus(false);
        return;
      }

      if (response && response.success && response.data && response.data.connected) {
        setAnkiStatus(true);
        loadDeckOptions(selectDeck.value);
      } else {
        setAnkiStatus(false);
      }
    });
  }

  function setAnkiStatus(isConnected) {
    ankiConnectionBadge.className = 'badge';
    if (isConnected) {
      ankiConnectionBadge.classList.add('badge-connected');
      ankiConnectionBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected';
    } else {
      ankiConnectionBadge.classList.add('badge-offline');
      ankiConnectionBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Offline';
    }
  }

  function loadDeckOptions(selectedDeck) {
    chrome.runtime.sendMessage({ type: 'GET_DECKS' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        return;
      }

      const decks = response.data.decks || [];

      if (selectedDeck && !decks.includes(selectedDeck)) {
        decks.push(selectedDeck);
      }

      selectDeck.innerHTML = '';
      decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck;
        option.textContent = deck;
        if (deck === selectedDeck) {
          option.selected = true;
        }
        selectDeck.appendChild(option);
      });
    });
  }

  btnCreateDeck.addEventListener('click', () => {
    deckDialog.classList.remove('hidden');
    inputNewDeck.value = '';
    inputNewDeck.focus();
  });

  btnDialogCancel.addEventListener('click', () => {
    deckDialog.classList.add('hidden');
  });

  btnDialogConfirm.addEventListener('click', () => {
    const newDeckName = inputNewDeck.value.trim();
    if (!newDeckName) return;

    btnDialogConfirm.disabled = true;
    btnDialogConfirm.textContent = 'Creating...';

    chrome.runtime.sendMessage({
      type: 'CREATE_DECK',
      payload: { deckName: newDeckName }
    }, (response) => {
      btnDialogConfirm.disabled = false;
      btnDialogConfirm.textContent = 'Create';

      if (chrome.runtime.lastError) {
        alert(`Anki is offline. Please make sure Anki is open to create a new deck.`);
        return;
      }

      if (response && response.success) {
        const option = document.createElement('option');
        option.value = newDeckName;
        option.textContent = newDeckName;
        option.selected = true;
        selectDeck.appendChild(option);

        deckDialog.classList.add('hidden');
        saveSettings(true);
      } else {
        const errorMsg = response?.error || 'Unknown error';
        alert(`Failed to create deck in Anki: ${errorMsg}`);
      }
    });
  });

  btnReset.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all configurations? This will delete your API keys and deck selection from the extension.')) {
      chrome.storage.local.clear(() => {
        loadSettings();
        triggerToast();
      });
    }
  });

  initLiquidGlass();
  loadSettings();
});
