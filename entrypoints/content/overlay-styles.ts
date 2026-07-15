export const overlayStyles = `
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
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: var(--glean-font-size, 16px);
    box-sizing: border-box;
  }

  *, *:before, *:after {
    box-sizing: inherit;
  }

  .glean-card {
    width: calc(var(--glean-font-size) * 21.25);
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
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
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
    font-size: calc(var(--glean-font-size) * 0.6875);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #636366;
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
    font-size: calc(var(--glean-font-size) * 0.875);
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

  .word-section { margin-bottom: 12px; }

  .word-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(0, 0, 0, 0.03);
    padding-bottom: 6px;
  }

  .word-text {
    font-size: calc(var(--glean-font-size) * 1.25);
    font-weight: 750;
    color: #1C1C1E;
    letter-spacing: -0.01em;
  }

  .word-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lang-badge {
    font-size: calc(var(--glean-font-size) * 0.625);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #007AFF;
    background: rgba(0, 122, 255, 0.08);
    border: 1px solid rgba(0, 122, 255, 0.12);
    border-radius: 6px;
    padding: 2px 6px;
    line-height: 1.4;
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
    font-size: calc(var(--glean-font-size) * 0.6875);
    color: #636366;
    font-family: "JetBrains Mono", monospace;
    margin-top: 4px;
  }

  .meaning-text {
    font-size: calc(var(--glean-font-size) * 0.75);
    font-style: italic;
    color: #4F4F54;
    margin-bottom: 10px;
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
    font-size: calc(var(--glean-font-size) * 0.8125);
    line-height: 1.45;
    color: #1C1C1E;
  }

  .divider {
    border: 0;
    border-top: 1px solid rgba(0, 0, 0, 0.04);
    margin: 12px 0;
  }

  .context-section, .example-section { margin-bottom: 10px; }

  .context-label {
    font-size: calc(var(--glean-font-size) * 0.625);
    font-weight: 700;
    text-transform: uppercase;
    color: #636366;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  .context-text {
    font-size: calc(var(--glean-font-size) * 0.78125);
    line-height: 1.45;
    color: #3A3A3C;
  }

  .context-text.italic {
    font-style: italic;
    color: #4F4F54;
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
    font-size: calc(var(--glean-font-size) * 0.6875);
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

  .btn-dismiss:hover { background: rgba(0, 0, 0, 0.08); }

  .btn-add {
    background: #007AFF;
    color: white;
    box-shadow: none !important;
  }

  .btn-add:hover { background: #0062CC; box-shadow: none !important; }
  .btn-add:active { background: #004FAD; }

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
    font-size: calc(var(--glean-font-size) * 0.625);
    color: #636366;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

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

  .success-icon { width: 44px; height: 44px; }

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
    font-size: calc(var(--glean-font-size) * 0.625);
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
    font-size: calc(var(--glean-font-size) * 0.78125);
    color: #FF3B30;
    margin-bottom: 14px;
    line-height: 1.45;
  }

  .btn-retry {
    background: #FF3B30;
    color: #FFFFFF;
    padding: 6px 14px;
    font-size: calc(var(--glean-font-size) * 0.625);
    font-weight: 600;
    text-transform: uppercase;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-retry:hover { background: #D1241C; box-shadow: none !important; }

  .error-actions {
    display: flex;
    gap: 8px;
  }

  .sense-select-wrap {
    margin-bottom: 10px;
  }

  .sense-select {
    width: 100%;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.45);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    color: #1C1C1E;
    font-family: inherit;
    font-size: calc(var(--glean-font-size) * 0.78125);
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .sense-select:focus {
    border-color: #007AFF;
    background: rgba(255, 255, 255, 0.7);
  }

  .dup-note {
    font-size: calc(var(--glean-font-size) * 0.75);
    color: #D67D00;
    background: rgba(255, 149, 0, 0.1);
    border: 1px solid rgba(255, 149, 0, 0.2);
    border-radius: 6px;
    padding: 6px 10px;
    margin-top: 10px;
    line-height: 1.4;
  }

  .prompt-title {
    font-size: calc(var(--glean-font-size) * 0.875);
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
    font-size: calc(var(--glean-font-size) * 0.875);
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  #prompt-word-input:focus {
    border-color: #007AFF;
    background: rgba(255, 255, 255, 0.7);
  }

  .card-body {
    margin-bottom: 12px;
    overflow-y: auto;
  }

  .pickword-hint {
    font-size: calc(var(--glean-font-size) * 0.6875);
    color: #636366;
    margin-bottom: 10px;
    line-height: 1.4;
  }

  .pickword-tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pickword-token {
    font-family: inherit;
    font-size: calc(var(--glean-font-size) * 0.78125);
    color: #1C1C1E;
    background: rgba(0, 122, 255, 0.06);
    border: 1px solid rgba(0, 122, 255, 0.12);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pickword-token:hover {
    background: #007AFF;
    color: white;
    border-color: transparent;
  }

  .glean-gl {
    position: absolute;
    pointer-events: none;
    z-index: 0;
    display: block;
  }

  .glean-card.has-gl {
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: none !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  .glean-card.has-gl > *:not(.glean-gl) {
    position: relative;
    z-index: 1;
  }

`;
