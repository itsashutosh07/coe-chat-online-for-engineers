function chatMockHtml() {
  return `
    <div class="connection-banner connection-banner--error hidden" data-banner="error">Connection lost. Reconnecting…</div>
    <div class="connection-banner connection-banner--success hidden" data-banner="success">Back online</div>
    <div class="chat-container">
      <header class="chat-header">
        <div class="chat-header-left">
          <button type="button" class="sidebar-toggle" aria-hidden="true">☰</button>
          <h1 class="glow"><span>⬡</span><em> COE :<span style="font-weight:500;font-size:0.55em;"> Chat Online for Engineers</span></em></h1>
        </div>
        <div class="chat-header-right">
          <button type="button" class="btn-icon" aria-hidden="true">🔊</button>
          <button type="button" class="btn-icon btn-icon--hover-demo" aria-hidden="true" title="Hover state">🔊</button>
          <span class="leave-room">Leave Room ↪</span>
          <span class="leave-room leave-room--hover-demo" title="Hover state">Leave ↪</span>
        </div>
      </header>
      <main class="chat-main">
        <aside class="chat-sidebar">
          <button type="button" class="sidebar-close" aria-hidden="true">✕</button>
          <h3>💬 Current Room:</h3>
          <h2>COE</h2>
          <h3>👥 Active Users:</h3>
          <ul>
            <li class="curr-user">ashu user</li>
            <li>user 101</li>
          </ul>
          <div class="overlay-demo">Mobile overlay scrim preview</div>
        </aside>
        <div class="chat-panel">
          <div class="chat-messages">
            <div class="history-separator">— Earlier messages —</div>
            <div class="message message--other">
              <p class="meta"><span class="meta-name">USER 101</span><span class="meta-time">10:42 AM</span></p>
              <p class="text">Hey <span class="mention">@ashu user</span>, run <code>npm start</code> then check:</p>
              <pre class="message-code"><code>const socket = io();</code></pre>
            </div>
            <div class="message message--own">
              <p class="meta"><span class="meta-name">ASHU USER</span><span class="meta-time">10:43 AM</span></p>
              <p class="text">Looks good — merging now.</p>
            </div>
            <div class="message message--bot">
              <p class="meta"><span class="meta-name">C.O.E. BOT</span><span class="meta-time">10:43 AM</span></p>
              <p class="text">Welcome to COE. Type @username to mention someone.</p>
            </div>
          </div>
          <div class="typing-indicator">user 101 is typing…</div>
          <div class="scroll-bottom" style="position:relative;margin:8px 16px 12px auto;width:34px;">↓<span class="unread-badge">3</span></div>
          <div class="scroll-bottom scroll-bottom--hover-demo" style="position:relative;margin:0 16px 12px auto;width:34px;" title="Hover state">↓</div>
        </div>
      </main>
      <div class="chat-form-container">
        <form>
          <input type="text" placeholder="Type a message (max 500 chars)" value="" readonly />
          <button type="button" class="send-btn">✈</button>
          <button type="button" class="send-btn send-btn--hover-demo" title="Hover state">✈</button>
        </form>
        <div class="hover-swatch-row">
          <span class="hover-swatch">Icon hover demo</span>
          <span class="hover-swatch">Button hover demos shown inline</span>
        </div>
      </div>
    </div>
  `;
}

function formatTokenCSSValue(key, value) {
  if (typeof value === 'number') {
    if (key.endsWith('Opacity') || key === 'metaOpacity') return String(value);
    return `${value}px`;
  }
  return value;
}

function renderPanelTheme(panelId, tokens) {
  const styleEl = document.getElementById(`${panelId}-vars`);
  if (!styleEl) return;

  const lines = Object.entries(tokens).map(
    ([key, value]) => `  ${tokenToCssVar(key)}: ${formatTokenCSSValue(key, value)};`
  );

  let css = `#${panelId}.chat-mock {\n${lines.join('\n')}\n}`;

  if (panelId === 'panel-preview') {
    css += `\n.lab-preview-scroll {
  background: ${tokens.pageBackground};
  padding: ${formatTokenCSSValue('pageWindowGap', tokens.pageWindowGap)};
}`;
  }

  styleEl.textContent = css;
}

function applyTokensToPanel(panelEl, tokens) {
  if (!panelEl || !panelEl.id) return;
  renderPanelTheme(panelEl.id, tokens);
}

function cloneTokens(tokens) {
  return JSON.parse(JSON.stringify(tokens));
}

function tokensEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hexToColorInput(hex) {
  if (!hex || typeof hex !== 'string') return '#000000';
  if (hex.startsWith('#') && hex.length === 9) return hex.slice(0, 7);
  if (hex.startsWith('#') && hex.length === 7) return hex;
  if (hex.startsWith('#') && hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return '#000000';
}

function normalizeHex(value) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const h = trimmed.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return null;
}

const HISTORY_LIMIT = 100;

let previewTokens = { ...DEEP_PURPLE };
let previewPanelEl = null;
const controlInputs = new Map();
let undoStack = [];
let redoStack = [];
let editBaseline = null;
let isApplyingHistory = false;
let saveTimer;

function captureEditBaseline() {
  if (isApplyingHistory || editBaseline !== null) return;
  editBaseline = cloneTokens(previewTokens);
}

function commitEditBaseline() {
  if (isApplyingHistory || editBaseline === null) return;
  if (!tokensEqual(editBaseline, previewTokens)) {
    pushUndoSnapshot(editBaseline);
    scheduleSave();
  }
  editBaseline = null;
}

/** Run commit after input/change handlers so the final value is captured. */
function commitEditBaselineSoon() {
  queueMicrotask(commitEditBaseline);
}

function updateUndoRedoButtons() {
  document.getElementById('btn-undo').disabled = undoStack.length === 0;
  document.getElementById('btn-redo').disabled = redoStack.length === 0;
}

function pushUndoSnapshot(snapshot) {
  if (isApplyingHistory) return;
  const last = undoStack[undoStack.length - 1];
  if (last && tokensEqual(last, snapshot)) return;
  undoStack.push(cloneTokens(snapshot));
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}

function applyPreviewState(tokens, { recordHistory = false } = {}) {
  if (recordHistory && !isApplyingHistory && !tokensEqual(previewTokens, tokens)) {
    pushUndoSnapshot(previewTokens);
  }

  previewTokens = cloneTokens(tokens);
  applyPreviewTokens();
  syncControlsFromTokens(previewTokens);
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  commitEditBaseline();
  isApplyingHistory = true;
  editBaseline = null;
  const current = cloneTokens(previewTokens);
  const previous = undoStack.pop();
  if (!tokensEqual(current, previous)) {
    redoStack.push(current);
  }
  previewTokens = cloneTokens(previous);
  applyPreviewTokens();
  syncControlsFromTokens(previewTokens);
  isApplyingHistory = false;
  updateUndoRedoButtons();
  scheduleSave();
  setStatus('Undo applied.');
}

function redo() {
  if (redoStack.length === 0) return;
  commitEditBaseline();
  isApplyingHistory = true;
  editBaseline = null;
  const current = cloneTokens(previewTokens);
  const next = redoStack.pop();
  if (!tokensEqual(current, next)) {
    undoStack.push(current);
  }
  previewTokens = cloneTokens(next);
  applyPreviewTokens();
  syncControlsFromTokens(previewTokens);
  isApplyingHistory = false;
  updateUndoRedoButtons();
  scheduleSave();
  setStatus('Redo applied.');
}

function setStatus(message) {
  const status = document.getElementById('export-status');
  status.textContent = message;
  if (message) {
    setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 2000);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(
      'chat-color-lab-preview',
      JSON.stringify(buildExportJson(previewTokens, 'custom'))
    );
  }, 400);
}

function bindControlHistory(el, events) {
  events.forEach(({ type, handler }) => {
    el.addEventListener(type, handler);
  });
}

function renderControls() {
  const root = document.getElementById('controls-root');
  root.innerHTML = '';

  TOKEN_GROUPS.forEach((group) => {
    const details = document.createElement('details');
    details.className = 'lab-accordion';
    details.open = group.id === 'pageShell' || group.id === 'messageBubbles';

    const summary = document.createElement('summary');
    summary.textContent = group.label;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'lab-accordion-body';

    group.tokens.forEach((tokenDef) => {
      const row = document.createElement('div');
      row.className = 'control-row';

      const labelWrap = document.createElement('label');
      labelWrap.className = 'control-label';
      labelWrap.htmlFor = `ctrl-${tokenDef.key}`;
      labelWrap.innerHTML = `${tokenDef.label}<span class="control-selector">${tokenDef.cssSelector}</span>`;

      if (tokenDef.type === 'opacity' || tokenDef.type === 'length') {
        const range = document.createElement('input');
        range.type = 'range';
        range.id = `ctrl-${tokenDef.key}`;
        range.min = tokenDef.min ?? 0;
        range.max = tokenDef.max ?? (tokenDef.type === 'length' ? 64 : 1);
        range.step = tokenDef.step ?? (tokenDef.type === 'length' ? 1 : 0.05);
        range.value = previewTokens[tokenDef.key];

        const valSpan = document.createElement('span');
        valSpan.className = 'opacity-val';
        const unit = tokenDef.unit || '';
        valSpan.textContent =
          tokenDef.type === 'length'
            ? `${parseFloat(range.value)}${unit}`
            : Number(range.value).toFixed(2);

        range.addEventListener('input', () => {
          const num = parseFloat(range.value);
          valSpan.textContent = tokenDef.type === 'length' ? `${num}${unit}` : num.toFixed(2);
          updatePreviewToken(tokenDef.key, num);
        });

        bindControlHistory(range, [
          { type: 'pointerdown', handler: captureEditBaseline },
          { type: 'pointerup', handler: commitEditBaselineSoon },
          { type: 'change', handler: commitEditBaselineSoon },
        ]);

        const controls = document.createElement('div');
        controls.className = 'control-row-controls';
        controls.appendChild(range);
        controls.appendChild(valSpan);

        controlInputs.set(tokenDef.key, { type: tokenDef.type, range, valSpan, unit });
        row.appendChild(labelWrap);
        row.appendChild(controls);
      } else {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = `ctrl-${tokenDef.key}`;
        colorInput.value = hexToColorInput(previewTokens[tokenDef.key]);

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.value = previewTokens[tokenDef.key];
        hexInput.setAttribute('aria-label', `${tokenDef.label} hex`);

        const syncFromColor = () => {
          const hex = colorInput.value.toLowerCase();
          hexInput.value = hex;
          updatePreviewToken(tokenDef.key, hex);
        };

        const syncFromHex = () => {
          const normalized = normalizeHex(hexInput.value);
          if (!normalized) return;
          hexInput.value = normalized;
          colorInput.value = hexToColorInput(normalized);
          updatePreviewToken(tokenDef.key, normalized);
        };

        colorInput.addEventListener('input', syncFromColor);
        colorInput.addEventListener('change', () => {
          syncFromColor();
          commitEditBaselineSoon();
        });

        bindControlHistory(colorInput, [
          { type: 'pointerdown', handler: captureEditBaseline },
        ]);

        hexInput.addEventListener('input', syncFromHex);
        hexInput.addEventListener('change', syncFromHex);
        hexInput.addEventListener('focus', captureEditBaseline);
        hexInput.addEventListener('blur', commitEditBaselineSoon);
        hexInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            syncFromHex();
            commitEditBaselineSoon();
          }
        });

        const controls = document.createElement('div');
        controls.className = 'control-row-controls';
        controls.appendChild(colorInput);
        controls.appendChild(hexInput);

        controlInputs.set(tokenDef.key, { type: 'color', colorInput, hexInput });
        row.appendChild(labelWrap);
        row.appendChild(controls);
      }

      body.appendChild(row);
    });

    details.appendChild(body);
    root.appendChild(details);
  });
}

function refreshJsonOutput() {
  const json = buildExportJson(previewTokens);
  document.getElementById('json-output').value = JSON.stringify(json, null, 2);
}

function syncControlsFromTokens(tokens) {
  controlInputs.forEach((inputs, key) => {
    const value = tokens[key];
    if (inputs.type === 'opacity') {
      inputs.range.value = value;
      inputs.valSpan.textContent = Number(value).toFixed(2);
    } else if (inputs.type === 'length') {
      inputs.range.value = value;
      inputs.valSpan.textContent = `${value}${inputs.unit || 'px'}`;
    } else {
      inputs.colorInput.value = hexToColorInput(value);
      inputs.hexInput.value = value;
    }
  });
}

function applyPreviewTokens() {
  if (!previewPanelEl) previewPanelEl = document.getElementById('panel-preview');
  renderPanelTheme('panel-preview', previewTokens);
  refreshJsonOutput();
}

function updatePreviewToken(key, value) {
  previewTokens[key] = value;
  applyPreviewTokens();
}

function setupBannerToggles(panelId, radioName) {
  const panel = document.getElementById(panelId);
  document.querySelectorAll(`input[name="${radioName}"]`).forEach((radio) => {
    radio.addEventListener('change', () => {
      panel.querySelectorAll('[data-banner]').forEach((el) => el.classList.add('hidden'));
      if (radio.value !== 'none') {
        panel.querySelector(`[data-banner="${radio.value}"]`)?.classList.remove('hidden');
      }
    });
  });
}

function resetToDeepPurple() {
  commitEditBaseline();
  applyPreviewState(DEEP_PURPLE, { recordHistory: true });
  localStorage.removeItem('chat-color-lab-preview');
  scheduleSave();
  setStatus('Reset to default preset.');
}

function init() {
  const previewPanel = document.getElementById('panel-preview');

  previewPanel.innerHTML = chatMockHtml();
  previewPanelEl = previewPanel;

  applyTokensToPanel(previewPanel, DEEP_PURPLE);
  previewTokens = { ...DEEP_PURPLE };

  renderControls();
  refreshJsonOutput();
  updateUndoRedoButtons();

  setupBannerToggles('panel-preview', 'banner-preview');

  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);
  document.getElementById('btn-reset').addEventListener('click', resetToDeepPurple);

  document.getElementById('btn-copy-json').addEventListener('click', async () => {
    refreshJsonOutput();
    const text = document.getElementById('json-output').value;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('JSON copied to clipboard.');
    } catch {
      setStatus('Copy failed — use Select All and copy manually.');
    }
  });

  document.getElementById('btn-select-all').addEventListener('click', () => {
    const ta = document.getElementById('json-output');
    ta.focus();
    ta.select();
  });

  document.getElementById('btn-refresh-json').addEventListener('click', () => {
    refreshJsonOutput();
    setStatus('JSON refreshed.');
  });

  // Safety net: commit any in-progress edit when pointer releases anywhere
  document.addEventListener('pointerup', commitEditBaselineSoon);

  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'json-output') return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    } else if (e.key === 'y') {
      e.preventDefault();
      redo();
    }
  });

  const saved = localStorage.getItem('chat-color-lab-preview');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.tokens && typeof parsed.tokens === 'object') {
        previewTokens = { ...DEEP_PURPLE, ...parsed.tokens };
        applyPreviewTokens();
        syncControlsFromTokens(previewTokens);
      }
    } catch {
      /* ignore corrupt localStorage */
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
