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
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Outfit', sans-serif;
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

  .word-section { margin-bottom: 12px; }

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

  .word-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lang-badge {
    font-size: 10px;
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
    font-size: 11px;
    color: #8E8E93;
    font-family: "JetBrains Mono", monospace;
    margin-top: 4px;
  }

  .meaning-text {
    font-size: 12px;
    font-style: italic;
    color: #6E6E73;
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
    font-size: 13px;
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
    font-size: 10px;
    color: #8E8E93;
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
    font-size: 12.5px;
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .sense-select:focus {
    border-color: #007AFF;
    background: rgba(255, 255, 255, 0.7);
  }

  .dup-note {
    font-size: 12px;
    color: #D67D00;
    background: rgba(255, 149, 0, 0.1);
    border: 1px solid rgba(255, 149, 0, 0.2);
    border-radius: 6px;
    padding: 6px 10px;
    margin-top: 10px;
    line-height: 1.4;
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

  .card-resizer:hover { opacity: 0.8; }
`;
