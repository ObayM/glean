import { getDefaultModel } from '../lib/llm-api.js';

document.addEventListener('DOMContentLoaded', () => {
  const selectLlmProvider = document.getElementById('select-llm-provider');
  const providerFieldsHackclub = document.getElementById('provider-fields-hackclub');
  const providerFieldsOpenrouter = document.getElementById('provider-fields-openrouter');

  const inputHackclubKey = document.getElementById('input-hackclub-key');
  const inputHackclubModel = document.getElementById('input-hackclub-model');
  const inputOpenrouterKey = document.getElementById('input-openrouter-key');
  const inputOpenrouterModel = document.getElementById('input-openrouter-model');
  const inputMwKey = document.getElementById('input-mw-key');
  const selectDeck = document.getElementById('select-deck');

  const btnToggleHackclubKey = document.getElementById('btn-toggle-hackclub-key');
  const btnToggleOpenrouterKey = document.getElementById('btn-toggle-openrouter-key');
  const btnToggleMwKey = document.getElementById('btn-toggle-mw-key');
  const btnTestLlmKey = document.getElementById('btn-test-llm-key');
  const btnTestAnki = document.getElementById('btn-test-anki');
  const btnCreateDeck = document.getElementById('btn-create-deck');
  const btnReset = document.getElementById('btn-reset');

  const llmKeyStatus = document.getElementById('llm-key-status');
  const ankiConnectionBadge = document.getElementById('anki-connection-badge');
  const saveToast = document.getElementById('save-toast');

  const deckDialog = document.getElementById('deck-dialog');
  const inputNewDeck = document.getElementById('input-new-deck');
  const btnDialogCancel = document.getElementById('btn-dialog-cancel');
  const btnDialogConfirm = document.getElementById('btn-dialog-confirm');

  let activeToastTimeout = null;
  let autoSaveTimeout = null;

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

  btnToggleHackclubKey.addEventListener('click', () => togglePasswordVisibility(inputHackclubKey, btnToggleHackclubKey));
  btnToggleOpenrouterKey.addEventListener('click', () => togglePasswordVisibility(inputOpenrouterKey, btnToggleOpenrouterKey));
  btnToggleMwKey.addEventListener('click', () => togglePasswordVisibility(inputMwKey, btnToggleMwKey));

  function updateProviderVisibility() {
    const provider = selectLlmProvider.value;
    providerFieldsHackclub.classList.toggle('hidden', provider !== 'hackclub');
    providerFieldsOpenrouter.classList.toggle('hidden', provider !== 'openrouter');
  }

  selectLlmProvider.addEventListener('change', () => {
    updateProviderVisibility();
    saveSettings(true);
  });

  function loadSettings() {
    chrome.storage.local.get({
      llmProvider: 'hackclub',
      hackclubApiKey: '',
      hackclubModel: '',
      openrouterApiKey: '',
      openrouterModel: '',
      mwKey: '',
      deckName: 'Glean'
    }, (items) => {
      selectLlmProvider.value = items.llmProvider;
      inputHackclubKey.value = items.hackclubApiKey;
      inputHackclubModel.value = items.hackclubModel || getDefaultModel('hackclub');
      inputOpenrouterKey.value = items.openrouterApiKey;
      inputOpenrouterModel.value = items.openrouterModel || getDefaultModel('openrouter');
      inputMwKey.value = items.mwKey;

      updateProviderVisibility();
      testAnkiConnection();
      loadDeckOptions(items.deckName);
    });
  }

  function saveSettings(showNotification = true) {
    const newSettings = {
      llmProvider: selectLlmProvider.value,
      hackclubApiKey: inputHackclubKey.value.trim(),
      hackclubModel: inputHackclubModel.value.trim(),
      openrouterApiKey: inputOpenrouterKey.value.trim(),
      openrouterModel: inputOpenrouterModel.value.trim(),
      mwKey: inputMwKey.value.trim(),
      deckName: selectDeck.value
    };

    chrome.storage.local.set(newSettings, () => {
      if (showNotification) {
        triggerToast();
      }
    });
  }

  const inputFields = [inputHackclubKey, inputHackclubModel, inputOpenrouterKey, inputOpenrouterModel, inputMwKey];
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

  btnTestLlmKey.addEventListener('click', () => {
    const provider = selectLlmProvider.value;
    const keyInput = provider === 'openrouter' ? inputOpenrouterKey : inputHackclubKey;
    const modelInput = provider === 'openrouter' ? inputOpenrouterModel : inputHackclubModel;
    const key = keyInput.value.trim();
    const model = modelInput.value.trim() || getDefaultModel(provider);

    if (!key) {
      updateStatus(llmKeyStatus, 'Please enter a key first.', 'error');
      return;
    }

    btnTestLlmKey.disabled = true;
    updateStatus(llmKeyStatus, 'Testing key...', 'checking');

    chrome.runtime.sendMessage({
      type: 'TEST_API_KEY',
      payload: { provider, apiKey: key, model }
    }, (response) => {
      btnTestLlmKey.disabled = false;
      if (chrome.runtime.lastError) {
        updateStatus(llmKeyStatus, `Error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success && response.data.valid) {
        updateStatus(llmKeyStatus, 'API Key is valid.', 'success');
        saveSettings(false);
      } else {
        const err = response?.data?.error || response?.error || 'Invalid API key.';
        updateStatus(llmKeyStatus, `Verification failed: ${err}`, 'error');
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
