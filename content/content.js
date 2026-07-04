(function () {
  if (document.getElementById('glean-overlay-host')) {
    return;
  }

  const ABBREVIATIONS = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
    'st', 'ave', 'blvd', 'dept', 'est', 'govt',
    'vs', 'etc', 'approx', 'appt', 'apt',
    'inc', 'ltd', 'corp', 'co',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
    'i.e', 'e.g', 'viz', 'cf', 'al',
    'fig', 'vol', 'no', 'op', 'ed', 'rev', 'trans',
    'u.s', 'u.k', 'u.n',
  ]);

  const MAX_SENTENCE_LENGTH = 200;

  function isSentenceBoundary(text, dotIndex) {
    const before = text.substring(Math.max(0, dotIndex - 50), dotIndex);
    if (/https?:\/\/\S*$/i.test(before) || /www\.\S*$/i.test(before)) {
      return false;
    }

    if (dotIndex > 0 && dotIndex < text.length - 1) {
      if (/\d/.test(text[dotIndex - 1]) && /\d/.test(text[dotIndex + 1])) {
        return false;
      }
    }

    let wordStart = dotIndex - 1;
    while (wordStart >= 0 && /[a-zA-Z.]/.test(text[wordStart])) {
      wordStart--;
    }
    const wordBeforeDot = text.substring(wordStart + 1, dotIndex).toLowerCase();
    if (ABBREVIATIONS.has(wordBeforeDot)) {
      return false;
    }

    if (wordBeforeDot.length === 1 && /[A-Z]/.test(text[dotIndex - 1])) {
      return false;
    }

    return true;
  }

  function findSentenceBoundaries(text) {
    const boundaries = [0];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '!' || char === '?') {
        let end = i + 1;
        while (end < text.length && /["')\]]/.test(text[end])) end++;
        while (end < text.length && /\s/.test(text[end])) end++;
        boundaries.push(end);
        continue;
      }

      if (char === '.') {
        if (isSentenceBoundary(text, i)) {
          if (text[i + 1] === '.' && text[i + 2] === '.') {
            i += 2;
            let end = i + 1;
            while (end < text.length && /\s/.test(text[end])) end++;
            boundaries.push(end);
            continue;
          }

          let end = i + 1;
          while (end < text.length && /["')\]]/.test(text[end])) end++;
          while (end < text.length && /\s/.test(text[end])) end++;
          boundaries.push(end);
        }
      }
    }

    boundaries.push(text.length);
    return boundaries;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractSentence(text, wordOffset, word) {
    if (!text || typeof text !== 'string') return '';
    if (wordOffset < 0 || wordOffset >= text.length) {
      const idx = text.toLowerCase().indexOf(word.toLowerCase());
      if (idx >= 0) {
        wordOffset = idx;
      } else {
        return text.substring(0, MAX_SENTENCE_LENGTH);
      }
    }

    const boundaries = findSentenceBoundaries(text);

    let sentenceStart = 0;
    let sentenceEnd = text.length;

    for (let i = 0; i < boundaries.length - 1; i++) {
      if (wordOffset >= boundaries[i] && wordOffset < boundaries[i + 1]) {
        sentenceStart = boundaries[i];
        sentenceEnd = boundaries[i + 1];
        break;
      }
    }

    let sentence = text.substring(sentenceStart, sentenceEnd).trim();

    if (sentence.length > MAX_SENTENCE_LENGTH) {
      const wordPosInSentence = wordOffset - sentenceStart;
      const halfWindow = Math.floor((MAX_SENTENCE_LENGTH - word.length) / 2);

      let start = Math.max(0, wordPosInSentence - halfWindow);
      let end = Math.min(sentence.length, wordPosInSentence + word.length + halfWindow);

      if (start > 0) {
        const spaceIdx = sentence.indexOf(' ', start);
        if (spaceIdx !== -1 && spaceIdx < wordPosInSentence) {
          start = spaceIdx + 1;
        }
      }
      if (end < sentence.length) {
        const spaceIdx = sentence.lastIndexOf(' ', end);
        if (spaceIdx !== -1 && spaceIdx > wordPosInSentence + word.length) {
          end = spaceIdx;
        }
      }

      sentence =
        (start > 0 ? '...' : '') +
        sentence.substring(start, end).trim() +
        (end < sentence.length ? '...' : '');
    }

    const wordRegex = new RegExp(`(${escapeRegex(word)})`, 'gi');
    sentence = sentence.replace(wordRegex, '<b>$1</b>');

    return sentence;
  }

  let activeOverlay = null;
  let lastRightClickTarget = null;

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('contextmenu', (event) => {
    lastRightClickTarget = event.composedPath()[0];
  });

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      dismissOverlay();
    }
  }

  function getSelectionContext(selection, selectedText) {
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return null;

    const word = selectedText.split(/\s+/)[0].replace(/[^a-zA-Z0-9'-]/g, '');
    if (!word || word.length < 2) return null;

    let blockElement = anchorNode.parentElement;
    const blockTags = ['P', 'DIV', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'SPAN'];

    while (blockElement && !blockTags.includes(blockElement.tagName)) {
      blockElement = blockElement.parentElement;
    }

    if (!blockElement) {
      blockElement = anchorNode.parentElement || document.body;
    }

    const textContent = blockElement.textContent;
    const wordOffset = textContent.indexOf(selectedText);

    const sentence = extractSentence(textContent, wordOffset >= 0 ? wordOffset : 0, word);

    return { word, sentence };
  }

  function showOverlay(word, fullContextText, mouseEvent, isCentered = false, overrideRects = null) {
    dismissOverlay();

    const host = document.createElement('div');
    host.id = 'glean-overlay-host';
    document.body.appendChild(host);
    activeOverlay = host;

    const selection = window.getSelection();
    let rects = overrideRects;
    const hasSelection = rects || (selection && selection.rangeCount > 0 && selection.toString().trim().length > 0);

    if (isCentered || !hasSelection) {
      host.style.position = 'fixed';
      host.style.left = '50%';
      host.style.top = '50%';
      host.style.transform = 'translate(-50%, -50%) scale(0.8)';
    } else {
      if (!rects) {
        rects = selection.getRangeAt(0).getBoundingClientRect();
      }
      const x = window.scrollX + rects.left + rects.width / 2;
      const y = window.scrollY + rects.top - 8;

      host.style.position = 'absolute';
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
      host.style.transform = 'translate(-50%, -100%) scale(0.8)';
    }

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getOverlayStyles();
    shadow.appendChild(style);

    const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgFilter.setAttribute('width', '0');
    svgFilter.setAttribute('height', '0');
    svgFilter.style.position = 'absolute';
    svgFilter.style.pointerEvents = 'none';
    svgFilter.innerHTML = `
      <defs>
        <filter id="liquid-refraction" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves="2" result="noise"></feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
          <feSpecularLighting in="noise" specularExponent="30" specularConstant="1.0" lighting-color="#ffffff" result="light">
            <feDistantLight azimuth="225" elevation="55"></feDistantLight>
          </feSpecularLighting>
          <feBlend in="light" in2="displaced" mode="screen"></feBlend>
        </filter>
      </defs>
    `;
    shadow.appendChild(svgFilter);

    const card = document.createElement('div');
    card.className = 'glean-card is-loading';
    card.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">Analyzing "${word}"...</div>
      </div>
    `;
    shadow.appendChild(card);
    setupShadowLiquidHover(card, shadow);

    host.classList.add('glean-active');

    if (rects) {
      setTimeout(() => {
        const cardRect = card.getBoundingClientRect();

        if (cardRect.right > window.innerWidth) {
          host.style.left = `${window.innerWidth - cardRect.width / 2 - 16}px`;
        }
        if (cardRect.left < 0) {
          host.style.left = `${cardRect.width / 2 + 16}px`;
        }

        if (cardRect.top < 16) {
          host.style.top = `${window.scrollY + rects.bottom + 8}px`;
          host.style.transform = 'translate(-50%, 0) scale(0.8)';
        }
      }, 10);
    }

    chrome.runtime.sendMessage({
      type: 'PROCESS_WORD',
      payload: {
        word,
        sentence: fullContextText,
        pageUrl: window.location.href
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        showError(card, `Extension error: ${chrome.runtime.lastError.message}`, host);
        return;
      }

      if (!response || !response.success) {
        showError(card, response?.error || 'Failed to process word.', host);
        return;
      }

      renderPreview(card, response.data, host);
    });
  }

  function renderPreview(card, data, host) {
    card.className = 'glean-card';
    card.innerHTML = `
      <div class="card-content" style="opacity: 1; transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);">
        <div class="card-header">
          <span class="brand-logo">Glean</span>
          <button class="btn-close" title="Dismiss (Esc)">&times;</button>
        </div>
        <div class="card-body">
          <div class="word-section">
            <div class="word-header">
              <span class="word-text">${data.word}</span>
              ${data.audioUrl ? `
                <button class="btn-audio" title="Play pronunciation">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
            ${data.phonetic ? `<div class="word-phonetic">${data.phonetic}</div>` : ''}
          </div>
          <div class="definition-section">
            <div class="definition-text">${data.definition}</div>
          </div>
          <hr class="divider">
          <div class="context-section">
            <div class="context-label">Context Sentence</div>
            <div class="context-text">"${data.sentence}"</div>
          </div>
          <div class="example-section">
            <div class="context-label">AI Example</div>
            <div class="context-text italic">"${data.example}"</div>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn-action btn-dismiss">Dismiss</button>
          <button class="btn-action btn-add">Add to Anki</button>
        </div>
      </div>

      <div class="success-state" style="opacity: 0; pointer-events: none; position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: scale(0.5); transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);">
        <div class="success-icon" style="width: 44px; height: 44px;">
          <svg viewBox="0 0 52 52" style="display: block; width: 100%; height: 100%;">
            <circle class="success-circle" cx="26" cy="26" r="25" fill="none" style="stroke: #34C759; stroke-width: 2.5; stroke-dasharray: 157; stroke-dashoffset: 157; transition: stroke-dashoffset 0.4s ease-out;"/>
            <path class="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style="stroke: #34C759; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; transition: stroke-dashoffset 0.35s ease-out 0.15s;"/>
          </svg>
        </div>
      </div>
    `;

    const audioBtn = card.querySelector('.btn-audio');
    if (audioBtn && data.audioUrl) {
      const playAudio = () => {
        chrome.runtime.sendMessage({
          type: 'PLAY_AUDIO_OFFSCREEN',
          payload: { audioUrl: data.audioUrl }
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Glean] Offscreen audio play failed:', chrome.runtime.lastError.message);
          }
        });
      };

      audioBtn.addEventListener('click', playAudio);
      playAudio();
    }

    card.querySelector('.btn-close').addEventListener('click', dismissOverlay);
    card.querySelector('.btn-dismiss').addEventListener('click', dismissOverlay);

    const addBtn = card.querySelector('.btn-add');
    addBtn.addEventListener('click', () => {
      addBtn.disabled = true;
      addBtn.innerHTML = '<span class="mini-spinner"></span> Adding...';

      chrome.runtime.sendMessage({
        type: 'ADD_TO_ANKI',
        payload: {
          word: data.word,
          definition: data.definition,
          sentence: data.sentence,
          example: data.example,
          audioUrl: data.audioUrl,
          pageUrl: data.pageUrl
        }
      }, (ankiResponse) => {
        if (!ankiResponse || !ankiResponse.success) {
          addBtn.disabled = false;
          addBtn.innerHTML = 'Add to Anki';

          let errMsg = ankiResponse?.error || 'Failed to add card.';
          if (errMsg.includes('Cannot reach AnkiConnect')) {
            errMsg = 'Anki desktop is offline. Open Anki and try again.';
          }
          alert(`[Glean] Error: ${errMsg}`);
          return;
        }

        renderSuccess(card);
      });
    });

    makeDraggable(card, host);
    makeResizable(card);
  }

  function renderSuccess(card) {
    card.classList.add('is-success');

    const contentEl = card.querySelector('.card-content');
    const successEl = card.querySelector('.success-state');

    if (contentEl) {
      contentEl.style.opacity = '0';
      contentEl.style.transform = 'scale(0.8)';
      contentEl.style.pointerEvents = 'none';
      setTimeout(() => {
        contentEl.style.display = 'none';
      }, 300);
    }

    if (successEl) {
      successEl.style.opacity = '1';
      successEl.style.transform = 'scale(1)';
      successEl.style.pointerEvents = 'auto';

      setTimeout(() => {
        const circle = successEl.querySelector('.success-circle');
        const check = successEl.querySelector('.success-check');
        if (circle) circle.style.strokeDashoffset = '0';
        if (check) check.style.strokeDashoffset = '0';
      }, 50);
    }

    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-30px) scale(0.8)';
      card.style.transition = 'opacity 0.25s cubic-bezier(0.25, 1, 0.5, 1), transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';

      setTimeout(() => {
        dismissOverlay();
      }, 250);
    }, 1300);
  }

  function showError(card, errorMessage, host) {
    card.className = 'glean-card is-error';
    card.innerHTML = `
      <div class="card-header">
        <span class="brand-logo">Glean</span>
        <button class="btn-close">&times;</button>
      </div>
      <div class="error-state">
        <div class="error-icon">[Error]</div>
        <div class="error-message">${errorMessage}</div>
        <button class="btn-retry">Dismiss</button>
      </div>
    `;

    card.querySelector('.btn-close').addEventListener('click', dismissOverlay);
    card.querySelector('.btn-retry').addEventListener('click', dismissOverlay);

    makeDraggable(card, host);
    makeResizable(card);
  }

  function dismissOverlay() {
    if (!activeOverlay) return;

    const host = activeOverlay;
    activeOverlay = null;

    const card = host.shadowRoot.querySelector('.glean-card');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-20px) scale(0.85)';
      card.style.transition = 'opacity 0.25s cubic-bezier(0.25, 1, 0.5, 1), transform 0.25s cubic-bezier(0.25, 1, 0.5, 1) !important';
    }

    setTimeout(() => {
      if (host.parentNode) {
        host.parentNode.removeChild(host);
      }
    }, 250);
  }

  function showInputPrompt() {
    dismissOverlay();

    const host = document.createElement('div');
    host.id = 'glean-overlay-host';
    document.body.appendChild(host);
    activeOverlay = host;

    host.style.position = 'fixed';
    host.style.left = '50%';
    host.style.top = '50%';
    host.style.transform = 'translate(-50%, -50%) scale(0.8)';

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getOverlayStyles();
    shadow.appendChild(style);

    const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgFilter.setAttribute('width', '0');
    svgFilter.setAttribute('height', '0');
    svgFilter.style.position = 'absolute';
    svgFilter.style.pointerEvents = 'none';
    svgFilter.innerHTML = `
      <defs>
        <filter id="liquid-refraction" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves="2" result="noise"></feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
          <feSpecularLighting in="noise" specularExponent="30" specularConstant="1.0" lighting-color="#ffffff" result="light">
            <feDistantLight azimuth="225" elevation="55"></feDistantLight>
          </feSpecularLighting>
          <feBlend in="light" in2="displaced" mode="screen"></feBlend>
        </filter>
      </defs>
    `;
    shadow.appendChild(svgFilter);

    const card = document.createElement('div');
    card.className = 'glean-card prompt-card';
    card.innerHTML = `
      <div class="card-header">
        <span class="brand-logo">Glean</span>
        <button class="btn-close" title="Close">&times;</button>
      </div>
      <div class="card-body">
        <div class="prompt-title">Add a word manually</div>
        <div class="prompt-input-group">
          <input type="text" id="prompt-word-input" placeholder="e.g. ephemeral" autofocus />
        </div>
      </div>
      <div class="card-footer">
        <button class="btn-action btn-dismiss">Cancel</button>
        <button class="btn-action btn-add btn-submit-word">Look Up</button>
      </div>
    `;
    shadow.appendChild(card);
    setupShadowLiquidHover(card, shadow);
    makeDraggable(card, host);
    makeResizable(card);

    host.classList.add('glean-active');

    const input = card.querySelector('#prompt-word-input');
    input.focus();

    const submitWord = () => {
      const value = input.value.trim();
      if (!value) return;
      showOverlay(value, `Manually snapped word: ${value}`, null, true);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitWord();
      }
    });

    card.querySelector('.btn-close').addEventListener('click', dismissOverlay);
    card.querySelector('.btn-dismiss').addEventListener('click', dismissOverlay);
    card.querySelector('.btn-submit-word').addEventListener('click', submitWord);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRIGGER_CONTEXT_MENU') {
      const { word } = message.payload;
      let sentence = `Context selected word: ${word}`;
      let rects = null;

      if (lastRightClickTarget) {
        let blockElement = lastRightClickTarget;
        if (blockElement.nodeType === Node.TEXT_NODE) {
          blockElement = blockElement.parentElement;
        }
        const blockTags = ['P', 'DIV', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'SPAN'];
        while (blockElement && !blockTags.includes(blockElement.tagName)) {
          blockElement = blockElement.parentElement;
        }
        if (!blockElement) {
          blockElement = (lastRightClickTarget.nodeType === Node.TEXT_NODE ? lastRightClickTarget.parentElement : lastRightClickTarget) || document.body;
        }

        const textContent = blockElement.textContent;
        const wordOffset = textContent ? textContent.toLowerCase().indexOf(word.toLowerCase()) : -1;
        if (wordOffset >= 0) {
          sentence = extractSentence(textContent, wordOffset, word);
        }

        if (lastRightClickTarget.getBoundingClientRect) {
          rects = lastRightClickTarget.getBoundingClientRect();
        }
      }

      if (sentence.startsWith('Context selected word:')) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const selectionData = getSelectionContext(selection, selection.toString().trim());
          if (selectionData && selectionData.sentence) {
            sentence = selectionData.sentence;
            if (!rects) {
              rects = selection.getRangeAt(0).getBoundingClientRect();
            }
          }
        }
      }

      showOverlay(word, sentence, null, false, rects);
      sendResponse({ success: true });
    } else if (message.type === 'TRIGGER_CONTEXT_MENU_PROMPT') {
      showInputPrompt();
      sendResponse({ success: true });
    }
    return true;
  });

  function setupShadowLiquidHover(card, shadow) {
    const displacementMap = shadow.querySelector('#liquid-refraction feDisplacementMap');
    const specularLighting = shadow.querySelector('#liquid-refraction feSpecularLighting');

    if (!displacementMap || !specularLighting) return;

    let currentScale = 15;
    let targetScale = 15;
    let currentSpecular = 1.0;
    let targetSpecular = 1.0;
    let animating = false;

    function animateFilter() {
      currentScale += (targetScale - currentScale) * 0.15;
      currentSpecular += (targetSpecular - currentSpecular) * 0.15;

      displacementMap.setAttribute('scale', currentScale.toFixed(2));
      specularLighting.setAttribute('specularConstant', currentSpecular.toFixed(2));

      if (Math.abs(currentScale - targetScale) > 0.05 || Math.abs(currentSpecular - targetSpecular) > 0.01) {
        requestAnimationFrame(animateFilter);
      } else {
        animating = false;
      }
    }

    function triggerAnimation() {
      if (!animating) {
        animating = true;
        requestAnimationFrame(animateFilter);
      }
    }

    card.addEventListener('mouseenter', () => {
      targetScale = 25;
      targetSpecular = 1.4;
      triggerAnimation();
    });
    card.addEventListener('mouseleave', () => {
      targetScale = 15;
      targetSpecular = 1.0;
      triggerAnimation();
    });
    card.addEventListener('mousedown', () => {
      targetScale = 10;
      targetSpecular = 0.8;
      triggerAnimation();
    });
    card.addEventListener('mouseup', () => {
      targetScale = 25;
      targetSpecular = 1.4;
      triggerAnimation();
    });
  }

  function makeDraggable(card, host) {
    const dragHandle = card.querySelector('.brand-logo');
    if (!dragHandle) return;

    dragHandle.style.cursor = 'move';
    dragHandle.style.userSelect = 'none';

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let hostLeft = 0;
    let hostTop = 0;

    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      hostLeft = parseFloat(host.style.left) || host.offsetLeft;
      hostTop = parseFloat(host.style.top) || host.offsetTop;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      e.preventDefault();
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      host.style.left = `${hostLeft + dx}px`;
      host.style.top = `${hostTop + dy}px`;
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  function makeResizable(card) {
    const resizer = document.createElement('div');
    resizer.className = 'card-resizer';
    card.appendChild(resizer);

    let isResizing = false;
    let startWidth = 0;
    let startHeight = 0;
    let startX = 0;
    let startY = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = card.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;

      card.style.height = `${startHeight}px`;

      const cardBody = card.querySelector('.card-body');
      if (cardBody) {
        cardBody.style.maxHeight = 'none';
        cardBody.style.overflowY = 'auto';
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      e.preventDefault();
      e.stopPropagation();
    });

    function onMouseMove(e) {
      if (!isResizing) return;
      const scaleFactor = 0.8;
      const dx = (e.clientX - startX) / scaleFactor;
      const dy = (e.clientY - startY) / scaleFactor;

      const newWidth = Math.max(240, startWidth + dx);
      const newHeight = Math.max(160, startHeight + dy);

      card.style.width = `${newWidth}px`;
      card.style.height = `${newHeight}px`;

      const header = card.querySelector('.card-header');
      const footer = card.querySelector('.card-footer');
      const cardBody = card.querySelector('.card-body');
      if (cardBody) {
        const headerHeight = header ? header.offsetHeight : 30;
        const footerHeight = footer ? footer.offsetHeight : 45;
        const padding = 32;
        const newBodyHeight = newHeight - headerHeight - footerHeight - padding;
        cardBody.style.height = `${Math.max(60, newBodyHeight)}px`;
      }
    }

    function onMouseUp() {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  function getOverlayStyles() {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

      @property --displace-scale {
        syntax: '<number>';
        inherits: true;
        initial-value: 15;
      }

      @property --specular-constant {
        syntax: '<number>';
        inherits: true;
        initial-value: 1.0;
      }

      :host {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
        box-sizing: border-box;
      }

      *, *:before, *:after {
        box-sizing: inherit;
      }

      .glean-card {
        width: 340px;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: url(#liquid-refraction) blur(40px) saturate(210%) !important;
        -webkit-backdrop-filter: url(#liquid-refraction) blur(40px) saturate(210%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        border-radius: 14px !important;
        color: #3A3A3C !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7) !important;
        padding: 16px !important;
        opacity: 1;
        transform: translateY(0) scale(1);
        --displace-scale: 15;
        --specular-constant: 1.0;
        transition: opacity 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
                    transform 150ms cubic-bezier(0.25, 0.8, 0.25, 1),
                    background 0.3s ease,
                    --displace-scale 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
                    --specular-constant 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
        animation: card-appear 200ms cubic-bezier(0.25, 0.8, 0.25, 1);
        pointer-events: auto;
        position: relative !important;
        z-index: 10 !important;
        overflow: hidden !important;
      }

      .glean-card:hover {
        --displace-scale: 25;
        --specular-constant: 1.4;
      }

      .glean-card:active {
        --displace-scale: 10;
        --specular-constant: 0.8;
      }

      .glean-card.is-success {
        width: 100px !important;
        height: 100px !important;
        border-radius: 50px !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255, 255, 255, 0.45) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7) !important;
        transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1) !important;
      }

      @keyframes card-appear {
        from {
          opacity: 0;
          transform: translateY(6px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.04);
        padding-bottom: 8px;
      }

      .brand-logo {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #8E8E93;
        cursor: move;
        user-select: none;
      }

      .btn-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: rgba(0, 0, 0, 0.04);
        border: none;
        color: #55565A;
        font-size: 14px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        border-radius: 50%;
        transition: all 0.2s ease;
      }

      .btn-close:hover {
        background: rgba(0, 0, 0, 0.08);
        color: #1C1C1E;
      }

      .word-section {
        margin-bottom: 12px;
      }

      .word-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(0, 0, 0, 0.03);
        padding-bottom: 6px;
      }

      .word-text {
        font-size: 20px;
        font-weight: 750;
        color: #1C1C1E;
        letter-spacing: -0.01em;
      }

      .btn-audio {
        background: rgba(0, 122, 255, 0.08);
        border: 1px solid rgba(0, 122, 255, 0.12);
        border-radius: 6px;
        color: #007AFF;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        transition: all 0.2s ease;
      }

      .btn-audio:hover {
        background: #007AFF;
        color: white;
        border-color: transparent;
      }

      .word-phonetic {
        font-size: 11px;
        color: #8E8E93;
        font-family: "JetBrains Mono", monospace;
        margin-top: 4px;
      }

      .definition-section {
        background: rgba(255, 255, 255, 0.35);
        border-left: 3px solid #007AFF;
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        border-top: 1px solid rgba(255,255,255,0.4);
        border-bottom: 1px solid rgba(0,0,0,0.02);
        border-right: 1px solid rgba(0,0,0,0.02);
      }

      .definition-text {
        font-size: 13px;
        line-height: 1.45;
        color: #1C1C1E;
      }

      .divider {
        border: 0;
        border-top: 1px solid rgba(0, 0, 0, 0.04);
        margin: 12px 0;
      }

      .context-section, .example-section {
        margin-bottom: 10px;
      }

      .context-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: #8E8E93;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
      }

      .context-text {
        font-size: 12.5px;
        line-height: 1.45;
        color: #3A3A3C;
      }

      .context-text.italic {
        font-style: italic;
        color: #6E6E73;
      }

      .context-text b {
        color: #007AFF;
        font-weight: 600;
        border-bottom: 1px dashed rgba(0, 122, 255, 0.3);
      }

      .card-footer {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }

      .btn-action {
        flex: 1;
        padding: 8px 12px;
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-radius: 8px;
        cursor: pointer;
        border: none;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn-dismiss {
        background: rgba(0, 0, 0, 0.04);
        color: #55565A;
        border: 1px solid rgba(0, 0, 0, 0.03);
      }

      .btn-dismiss:hover {
        background: rgba(0, 0, 0, 0.08);
      }

      .btn-add {
        background: #007AFF;
        color: white;
        box-shadow: none !important;
      }

      .btn-add:hover {
        background: #0062CC;
        box-shadow: none !important;
      }

      .btn-add:active {
        background: #004FAD;
      }

      .btn-add:disabled {
        background: rgba(0, 0, 0, 0.05);
        color: #AEAEB2;
        cursor: not-allowed;
      }

      .is-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 90px;
        padding: 20px;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(0, 122, 255, 0.1);
        border-top-color: #007AFF;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .loading-text {
        font-size: 10px;
        color: #8E8E93;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 600;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .mini-spinner {
        display: inline-block;
        width: 10px;
        height: 10px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 6px;
        vertical-align: middle;
      }

      .success-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 16px;
        text-align: center;
      }

      .success-icon {
        width: 40px;
        height: 40px;
        margin-bottom: 10px;
      }

      .success-circle {
        stroke: #34C759;
        stroke-width: 2;
        stroke-dasharray: 157;
        stroke-dashoffset: 0;
        animation: draw-circle 0.4s ease-out forwards;
      }

      .success-check {
        stroke: white;
        stroke-width: 3.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 40;
        stroke-dashoffset: 40;
        animation: draw-check 0.35s ease-out 0.15s forwards;
      }

      @keyframes draw-circle {
        from { stroke-dashoffset: 157; }
        to { stroke-dashoffset: 0; }
      }

      @keyframes draw-check {
        from { stroke-dashoffset: 40; }
        to { stroke-dashoffset: 0; }
      }

      .success-text {
        font-size: 11px;
        font-weight: 700;
        color: #34C759;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .is-error {
        border-color: rgba(255, 59, 48, 0.3) !important;
      }

      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 6px;
        text-align: center;
      }

      .error-icon {
        font-size: 10px;
        font-weight: 700;
        color: #FF3B30;
        border: 1px solid rgba(255, 59, 48, 0.2);
        background: rgba(255, 59, 48, 0.08);
        padding: 3px 8px;
        border-radius: 4px;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .error-message {
        font-size: 12.5px;
        color: #FF3B30;
        margin-bottom: 14px;
        line-height: 1.45;
      }

      .btn-retry {
        background: #FF3B30;
        color: #FFFFFF;
        padding: 6px 14px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-retry:hover {
        background: #D1241C;
        box-shadow: none !important;
      }

      .prompt-card {
        width: 320px !important;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: url(#liquid-refraction) blur(40px) saturate(210%) !important;
        -webkit-backdrop-filter: url(#liquid-refraction) blur(40px) saturate(210%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7) !important;
        padding: 16px !important;
      }

      .prompt-title {
        font-size: 14px;
        font-weight: 700;
        color: #1C1C1E;
        margin-bottom: 12px;
      }

      .prompt-input-group {
        width: 100%;
        margin-bottom: 12px;
      }

      #prompt-word-input {
        width: 100%;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.45);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        color: #1C1C1E;
        font-family: inherit;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        transition: all 0.2s ease;
      }

      #prompt-word-input:focus {
        border-color: #007AFF;
        background: rgba(255, 255, 255, 0.7);
      }

      .btn-submit-word {
        background: #007AFF !important;
        color: white !important;
      }

      .btn-submit-word:hover {
        background: #0062CC !important;
      }

      .card-body {
        margin-bottom: 12px;
        overflow-y: auto;
      }

      .card-resizer {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 14px;
        height: 14px;
        cursor: se-resize;
        background: linear-gradient(135deg, transparent 45%, #8e8e93 45%, transparent 55%, #8e8e93 55%, transparent 100%);
        background-size: 5px 5px;
        opacity: 0.4;
        transition: opacity 0.2s ease;
        z-index: 100;
        border-bottom-right-radius: 14px;
      }

      .card-resizer:hover {
        opacity: 0.8;
      }
    `;
  }
})();
