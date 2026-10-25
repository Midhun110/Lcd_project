/**
 * PARITY GUARD — 4-Bit XOR Parity Error Detection System
 * Core Application Logic & ESP32 Hardware Integration Controller
 */

(() => {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. APPLICATION STATE
  // -------------------------------------------------------------------------
  const state = {
    // Current bit states
    d1: 1, // GPIO 18
    d2: 0, // GPIO 19
    d3: 1, // GPIO 21
    d4: 0, // GPIO 22
    receivedParity: 0, // GPIO 25 (Switch 5: P_RX)

    // Calculated fields
    x1: 0, // D1 XOR D2
    x2: 0, // D3 XOR D4
    calculatedParity: 0, // X1 XOR X2 = D1 ^ D2 ^ D3 ^ D4
    hasError: false, // calculatedParity !== receivedParity
    errorLed: false, // GPIO 26 output (HIGH when error detected)

    // Operational mode: 'demo' or 'live'
    mode: 'demo',

    // Connection & Telemetry
    esp32Status: 'ready', // 'ready', 'connected', 'disconnected', 'polling'
    apiEndpoint: '/api/status',
    pollIntervalMs: 500,
    pollingTimer: null,
    cycleCount: 0,
    lastUpdated: null,
    consecutiveFailures: 0,

    // Audit Event Log
    history: []
  };

  // -------------------------------------------------------------------------
  // 2. DOM ELEMENT REFERENCES
  // -------------------------------------------------------------------------
  const dom = {
    // Connection & Header
    connectionBanner: document.getElementById('connectionBanner'),
    bannerEndpoint: document.getElementById('bannerEndpoint'),
    bannerDismissBtn: document.getElementById('bannerDismissBtn'),
    connectionDot: document.getElementById('connectionDot'),
    connectionText: document.getElementById('connectionText'),
    telemetryModeText: document.getElementById('telemetryModeText'),
    modeDemoBtn: document.getElementById('modeDemoBtn'),
    modeLiveBtn: document.getElementById('modeLiveBtn'),
    modeCallout: document.getElementById('modeCallout'),
    calloutBadge: document.getElementById('calloutBadge'),
    calloutText: document.getElementById('calloutText'),
    demoPresetsBar: document.getElementById('demoPresetsBar'),

    // Hero Status Card
    mainStatusCard: document.getElementById('mainStatusCard'),
    heroGlow: document.getElementById('heroGlow'),
    heroIconContainer: document.getElementById('heroIconContainer'),
    heroIconSlot: document.getElementById('heroIconSlot'),
    heroHeadline: document.getElementById('heroHeadline'),
    heroTag: document.getElementById('heroTag'),
    heroExplanation: document.getElementById('heroExplanation'),
    heroPcalc: document.getElementById('heroPcalc'),
    heroPrx: document.getElementById('heroPrx'),
    heroOnesCount: document.getElementById('heroOnesCount'),
    lastUpdatedTs: document.getElementById('lastUpdatedTs'),

    // ESP32 Error LED
    errorLedDome: document.getElementById('errorLedDome'),
    errorLedEmitter: document.getElementById('errorLedEmitter'),
    errorLedHalo: document.getElementById('errorLedHalo'),
    ledStatusBadge: document.getElementById('ledStatusBadge'),
    ledStateText: document.getElementById('ledStateText'),
    ledVoltageText: document.getElementById('ledVoltageText'),
    ledDescText: document.getElementById('ledDescText'),
    hexDisplay: document.getElementById('hexDisplay'),
    comparatorResult: document.getElementById('comparatorResult'),
    cycleCounter: document.getElementById('cycleCounter'),

    // Switch Cards
    switchCards: [
      { card: document.getElementById('swCard1'), val: document.getElementById('valD1'), led: document.getElementById('ledD1'), status: document.getElementById('statusD1'), hint: document.getElementById('hintD1'), key: 'd1' },
      { card: document.getElementById('swCard2'), val: document.getElementById('valD2'), led: document.getElementById('ledD2'), status: document.getElementById('statusD2'), hint: document.getElementById('hintD2'), key: 'd2' },
      { card: document.getElementById('swCard3'), val: document.getElementById('valD3'), led: document.getElementById('ledD3'), status: document.getElementById('statusD3'), hint: document.getElementById('hintD3'), key: 'd3' },
      { card: document.getElementById('swCard4'), val: document.getElementById('valD4'), led: document.getElementById('ledD4'), status: document.getElementById('statusD4'), hint: document.getElementById('hintD4'), key: 'd4' },
      { card: document.getElementById('swCard5'), val: document.getElementById('valPrx'), led: document.getElementById('ledPrx'), status: document.getElementById('statusPrx'), hint: document.getElementById('hintPrx'), key: 'receivedParity' }
    ],

    // Logic Gate Visual Diagram Nodes & Wires
    nodeD1: document.getElementById('nodeD1'),
    nodeD2: document.getElementById('nodeD2'),
    nodeD3: document.getElementById('nodeD3'),
    nodeD4: document.getElementById('nodeD4'),
    wireD1: document.getElementById('wireD1'),
    wireD2: document.getElementById('wireD2'),
    wireD3: document.getElementById('wireD3'),
    wireD4: document.getElementById('wireD4'),
    wireX1: document.getElementById('wireX1'),
    wireX2: document.getElementById('wireX2'),
    wirePcalc: document.getElementById('wirePcalc'),
    gateCard1: document.getElementById('gateCard1'),
    gateCard2: document.getElementById('gateCard2'),
    gateCard3: document.getElementById('gateCard3'),
    gateOutX1: document.getElementById('gateOutX1'),
    gateOutX2: document.getElementById('gateOutX2'),
    gateOutPcalc: document.getElementById('gateOutPcalc'),
    comparatorCard: document.getElementById('comparatorCard'),
    compResultTag: document.getElementById('compResultTag'),
    compCalcDisplay: document.getElementById('compCalcDisplay'),
    compRecvDisplay: document.getElementById('compRecvDisplay'),
    compDiffDisplay: document.getElementById('compDiffDisplay'),

    // Explanations
    binaryStringVal: document.getElementById('binaryStringVal'),
    rxParityBadge: document.getElementById('rxParityBadge'),
    evenParityExplanation: document.getElementById('evenParityExplanation'),
    xorMathExplanation: document.getElementById('xorMathExplanation'),

    // Truth Table & Audit Log
    truthTableBody: document.getElementById('truthTableBody'),
    auditLogList: document.getElementById('auditLogList'),
    clearLogBtn: document.getElementById('clearLogBtn'),

    // Config Modal
    configModal: document.getElementById('configModal'),
    configModalOpenBtn: document.getElementById('configModalOpenBtn'),
    configModalCloseBtn: document.getElementById('configModalCloseBtn'),
    apiUrlInput: document.getElementById('apiUrlInput'),
    pollIntervalInput: document.getElementById('pollIntervalInput'),
    pollIntervalVal: document.getElementById('pollIntervalVal'),
    saveConfigBtn: document.getElementById('saveConfigBtn')
  };

  // -------------------------------------------------------------------------
  // 3. SVG ICON TEMPLATES
  // -------------------------------------------------------------------------
  const icons = {
    shieldCheck: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    `,
    alertTriangle: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    `
  };

  // -------------------------------------------------------------------------
  // 4. COMPUTATION LOGIC (XOR & PARITY)
  // -------------------------------------------------------------------------
  /**
   * Recalculates parity and error state according to:
   * X1 = D1 XOR D2
   * X2 = D3 XOR D4
   * P_calc = X1 XOR X2
   * Error = (P_calc !== P_rx)
   */
  function recomputeParity() {
    // 7486 2-input XOR Gate 1: D1 ^ D2
    state.x1 = state.d1 ^ state.d2;

    // 7486 2-input XOR Gate 2: D3 ^ D4
    state.x2 = state.d3 ^ state.d4;

    // 7486 2-input XOR Gate 3: X1 ^ X2 (Parity generator)
    state.calculatedParity = state.x1 ^ state.x2;

    // Main Error condition
    state.hasError = (state.calculatedParity !== state.receivedParity);

    // ESP32 GPIO26 Error LED: Active HIGH on error
    state.errorLed = state.hasError;

    state.cycleCount++;
    state.lastUpdated = new Date();
  }

  // -------------------------------------------------------------------------
  // 5. UI RENDER ENGINE
  // -------------------------------------------------------------------------
  function renderUI(triggerReason = 'State Update') {
    recomputeParity();

    const onesCount = state.d1 + state.d2 + state.d3 + state.d4;
    const isCountEven = (onesCount % 2 === 0);
    const timeFormatted = state.lastUpdated ? state.lastUpdated.toLocaleTimeString() : '--:--:--';

    // 5.1 Update Last Updated Timestamp & Cycle Counter
    if (dom.lastUpdatedTs) dom.lastUpdatedTs.textContent = timeFormatted;
    if (dom.cycleCounter) dom.cycleCounter.textContent = state.cycleCount;

    // 5.2 Update 5 Physical Switch Cards
    dom.switchCards.forEach((item) => {
      const isHigh = state[item.key] === 1;

      // Toggle card class
      item.card.classList.toggle('state-on', isHigh);

      // Digital digit display
      item.val.textContent = isHigh ? '1' : '0';

      // Indicator status text
      item.status.textContent = isHigh ? 'ON' : 'OFF';

      // Interactivity cursor & hint based on operational mode
      if (state.mode === 'demo') {
        item.card.classList.add('interactive-cursor');
        item.hint.textContent = 'Click to toggle';
      } else {
        item.card.classList.remove('interactive-cursor');
        item.hint.textContent = 'ESP32 controlled';
      }
    });

    // 5.3 Update Hero Status Card
    if (state.hasError) {
      dom.mainStatusCard.classList.remove('state-pass');
      dom.mainStatusCard.classList.add('state-fail');
      dom.heroIconSlot.innerHTML = icons.alertTriangle;
      dom.heroHeadline.textContent = 'PARITY ERROR DETECTED';
      dom.heroTag.textContent = 'TRANSMISSION CORRUPTED';
      dom.heroExplanation.textContent =
        `Calculated parity (${state.calculatedParity}) does not match received parity (${state.receivedParity}). Single-bit inversion or data bus noise detected!`;
    } else {
      dom.mainStatusCard.classList.remove('state-fail');
      dom.mainStatusCard.classList.add('state-pass');
      dom.heroIconSlot.innerHTML = icons.shieldCheck;
      dom.heroHeadline.textContent = 'NO ERROR DETECTED';
      dom.heroTag.textContent = 'EVEN PARITY VERIFIED';
      dom.heroExplanation.textContent =
        `Calculated parity (${state.calculatedParity}) matches received parity (${state.receivedParity}). The 4-bit word transmission is valid under Even Parity rules.`;
    }

    dom.heroPcalc.textContent = state.calculatedParity;
    dom.heroPrx.textContent = state.receivedParity;
    dom.heroOnesCount.textContent = `${onesCount} (${isCountEven ? 'Even' : 'Odd'})`;

    // 5.4 Update ESP32 GPIO26 Error LED Assembly
    const ledAssembly = dom.errorLedDome.closest('.led-assembly');
    if (state.errorLed) {
      ledAssembly.classList.add('led-active');
      dom.ledStateText.textContent = 'LED ON (HIGH)';
      dom.ledVoltageText.textContent = '3.3V (ACTIVE)';
      dom.ledDescText.textContent =
        'Output pin GPIO26 driven HIGH. Visual red alarm LED illuminated to notify operator of parity mismatch.';
      dom.comparatorResult.textContent = 'MISMATCH';
      dom.comparatorResult.className = 'ms-val text-red';
    } else {
      ledAssembly.classList.remove('led-active');
      dom.ledStateText.textContent = 'LED OFF (LOW)';
      dom.ledVoltageText.textContent = '0.0V (NORMAL)';
      dom.ledDescText.textContent =
        'Output pin GPIO26 driven LOW. Parity verified; transmission line integrity maintained.';
      dom.comparatorResult.textContent = 'MATCH';
      dom.comparatorResult.className = 'ms-val text-green';
    }

    // HEX readout of 4-bit word
    const hexVal = (state.d1 * 8 + state.d2 * 4 + state.d3 * 2 + state.d4).toString(16).toUpperCase();
    dom.hexDisplay.textContent = `0x${hexVal}`;

    // 5.5 Update 7486 XOR Gate Cascade Diagram
    updateGateDiagram();

    // 5.6 Update Educational Breakdown Strings
    dom.binaryStringVal.textContent = `${state.d1} ${state.d2} ${state.d3} ${state.d4}`;
    dom.rxParityBadge.textContent = `P_RX = ${state.receivedParity}`;

    dom.evenParityExplanation.innerHTML =
      `Data word has <strong>${onesCount}</strong> '1' bit${onesCount === 1 ? '' : 's'} (${isCountEven ? 'Even count' : 'Odd count'}). To satisfy Even Parity, calculated parity must be <strong>${state.calculatedParity}</strong>.`;

    dom.xorMathExplanation.innerHTML =
      `${state.d1} ⊕ ${state.d2} ⊕ ${state.d3} ⊕ ${state.d4} = <strong>${state.calculatedParity}</strong>. Comparing with received P (${state.receivedParity}): difference = <strong>${state.calculatedParity ^ state.receivedParity}</strong> (${state.hasError ? '<span class="text-red">Error Flagged</span>' : '<span class="text-green">Transmission Valid</span>'}).`;

    // 5.7 Highlight Active Row in Truth Table
    highlightActiveTruthRow();

    // 5.8 Record in Audit History Log
    addAuditLogEntry(triggerReason);
  }

  // -------------------------------------------------------------------------
  // 6. GATE CASCADE DIAGRAM LOGIC
  // -------------------------------------------------------------------------
  function updateGateDiagram() {
    // Inputs
    dom.nodeD1.classList.toggle('active', state.d1 === 1);
    dom.nodeD1.querySelector('.node-val').textContent = state.d1;

    dom.nodeD2.classList.toggle('active', state.d2 === 1);
    dom.nodeD2.querySelector('.node-val').textContent = state.d2;

    dom.nodeD3.classList.toggle('active', state.d3 === 1);
    dom.nodeD3.querySelector('.node-val').textContent = state.d3;

    dom.nodeD4.classList.toggle('active', state.d4 === 1);
    dom.nodeD4.querySelector('.node-val').textContent = state.d4;

    // Stage 1 Wires
    dom.wireD1.classList.toggle('active', state.d1 === 1);
    dom.wireD2.classList.toggle('active', state.d2 === 1);
    dom.wireD3.classList.toggle('active', state.d3 === 1);
    dom.wireD4.classList.toggle('active', state.d4 === 1);

    // Gate 1 & 2 outputs
    dom.gateCard1.classList.toggle('gate-active', state.x1 === 1);
    dom.gateOutX1.textContent = `X1 = ${state.x1}`;
    dom.gateOutX1.classList.toggle('active', state.x1 === 1);

    dom.gateCard2.classList.toggle('gate-active', state.x2 === 1);
    dom.gateOutX2.textContent = `X2 = ${state.x2}`;
    dom.gateOutX2.classList.toggle('active', state.x2 === 1);

    // Stage 2 Wires
    dom.wireX1.classList.toggle('active', state.x1 === 1);
    dom.wireX2.classList.toggle('active', state.x2 === 1);

    // Gate 3 (Calculated Parity)
    dom.gateCard3.classList.toggle('gate-active', state.calculatedParity === 1);
    dom.gateOutPcalc.textContent = `P_calc = ${state.calculatedParity}`;
    dom.gateOutPcalc.classList.toggle('active', state.calculatedParity === 1);

    // Stage 3 Wire
    dom.wirePcalc.classList.toggle('active-alt', state.calculatedParity === 1);

    // Comparator Card
    dom.compCalcDisplay.textContent = state.calculatedParity;
    dom.compRecvDisplay.textContent = state.receivedParity;

    const diff = state.calculatedParity ^ state.receivedParity;
    if (diff === 0) {
      dom.comparatorCard.classList.remove('comp-error');
      dom.comparatorCard.classList.add('comp-match');
      dom.compResultTag.textContent = 'MATCH';
      dom.compDiffDisplay.innerHTML = `<span class="text-green">0 (PASS)</span>`;
    } else {
      dom.comparatorCard.classList.remove('comp-match');
      dom.comparatorCard.classList.add('comp-error');
      dom.compResultTag.textContent = 'MISMATCH';
      dom.compDiffDisplay.innerHTML = `<span class="text-red">1 (ERROR)</span>`;
    }
  }

  // -------------------------------------------------------------------------
  // 7. TRUTH TABLE INITIALIZATION & ACTIVE ROW HIGHLIGHT
  // -------------------------------------------------------------------------
  function initTruthTable() {
    const rows = [];
    for (let i = 0; i < 16; i++) {
      const d1 = (i >> 3) & 1;
      const d2 = (i >> 2) & 1;
      const d3 = (i >> 1) & 1;
      const d4 = i & 1;
      const ones = d1 + d2 + d3 + d4;
      const expectedParity = d1 ^ d2 ^ d3 ^ d4;
      const frame = `${d1}${d2}${d3}${d4}-${expectedParity}`;

      rows.push(`
        <tr id="truthRow_${i}" data-dec="${i}">
          <td>${i}</td>
          <td>${d1}</td>
          <td>${d2}</td>
          <td>${d3}</td>
          <td>${d4}</td>
          <td>${ones}</td>
          <td><strong class="text-cyan">${expectedParity}</strong></td>
          <td><code>${frame}</code></td>
        </tr>
      `);
    }
    dom.truthTableBody.innerHTML = rows.join('');
  }

  function highlightActiveTruthRow() {
    const currentDec = (state.d1 << 3) | (state.d2 << 2) | (state.d3 << 1) | state.d4;

    // Remove active class from all rows
    const allRows = dom.truthTableBody.querySelectorAll('tr');
    allRows.forEach((r) => r.classList.remove('active-truth-row'));

    // Highlight active row
    const targetRow = document.getElementById(`truthRow_${currentDec}`);
    if (targetRow) {
      targetRow.classList.add('active-truth-row');
      // Scroll into view if container allows
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // -------------------------------------------------------------------------
  // 8. AUDIT LOGGING
  // -------------------------------------------------------------------------
  function addAuditLogEntry(trigger) {
    const word = `${state.d1}${state.d2}${state.d3}${state.d4}`;
    const timeStr = state.lastUpdated ? state.lastUpdated.toLocaleTimeString() : '--:--:--';
    const isError = state.hasError;

    const entry = {
      id: Date.now(),
      time: timeStr,
      word: word,
      pCalc: state.calculatedParity,
      pRx: state.receivedParity,
      hasError: isError,
      trigger: trigger
    };

    // Prepend to internal array (keep max 30 items)
    state.history.unshift(entry);
    if (state.history.length > 30) state.history.pop();

    renderAuditLog();
  }

  function renderAuditLog() {
    if (!dom.auditLogList) return;

    if (state.history.length === 0) {
      dom.auditLogList.innerHTML = `
        <div class="log-entry" style="justify-content: center; color: var(--text-dim);">
          No events recorded yet. Toggle switches or connect ESP32.
        </div>
      `;
      return;
    }

    const html = state.history.map((e) => `
      <div class="log-entry ${e.hasError ? 'log-fail' : 'log-pass'}">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span class="log-time">${e.time}</span>
          <span class="log-bits">D=[${e.word}] P_rx=[${e.pRx}]</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.68rem; color: var(--text-muted);">${e.trigger}</span>
          <span class="log-badge">${e.hasError ? 'PARITY ERROR' : 'VALID'}</span>
        </div>
      </div>
    `).join('');

    dom.auditLogList.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // 9. ESP32 LIVE POLLING & API INTEGRATION
  // -------------------------------------------------------------------------
  /**
   * Polls the ESP32 endpoint.
   * Expected JSON payload format:
   * {
   *   "d1": 1,
   *   "d2": 0,
   *   "d3": 1,
   *   "d4": 0,
   *   "received_parity": 0,
   *   "calculated_parity": 0,
   *   "error": false,
   *   "error_led": false
   * }
   */
  async function pollEsp32Status() {
    if (state.mode !== 'live') return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1400);

    try {
      const response = await fetch(state.apiEndpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Successfully received hardware telemetry
      state.consecutiveFailures = 0;
      setConnectionStatus(true);

      // Verify and update state from actual physical hardware pins
      let stateChanged = false;

      if (data.d1 !== undefined && state.d1 !== data.d1) { state.d1 = data.d1; stateChanged = true; }
      if (data.d2 !== undefined && state.d2 !== data.d2) { state.d2 = data.d2; stateChanged = true; }
      if (data.d3 !== undefined && state.d3 !== data.d3) { state.d3 = data.d3; stateChanged = true; }
      if (data.d4 !== undefined && state.d4 !== data.d4) { state.d4 = data.d4; stateChanged = true; }
      if (data.received_parity !== undefined && state.receivedParity !== data.received_parity) {
        state.receivedParity = data.received_parity;
        stateChanged = true;
      }

      // Re-render UI on hardware state change or periodic cycle tick
      renderUI(stateChanged ? 'ESP32 Switch Changed' : 'ESP32 Polling Cycle');

    } catch (err) {
      clearTimeout(timeoutId);
      state.consecutiveFailures++;

      // After 2 consecutive failed polls, flag as disconnected
      if (state.consecutiveFailures >= 2) {
        setConnectionStatus(false);
      }
    }
  }

  function setConnectionStatus(isConnected) {
    if (isConnected) {
      dom.connectionDot.className = 'status-dot connected';
      dom.connectionText.textContent = 'Connected';
      dom.connectionText.style.color = 'var(--green-pass)';
      dom.connectionBanner.classList.add('hidden');
    } else {
      dom.connectionDot.className = 'status-dot disconnected';
      dom.connectionText.textContent = 'Disconnected';
      dom.connectionText.style.color = 'var(--red-fail)';
      dom.bannerEndpoint.textContent = state.apiEndpoint;
      dom.connectionBanner.classList.remove('hidden');
    }
  }

  function startLivePolling() {
    stopLivePolling();
    // Immediate first poll
    pollEsp32Status();
    state.pollingTimer = setInterval(pollEsp32Status, state.pollIntervalMs);
  }

  function stopLivePolling() {
    if (state.pollingTimer) {
      clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // 10. OPERATIONAL MODE SWITCHING (DEMO vs LIVE)
  // -------------------------------------------------------------------------
  function setMode(newMode) {
    state.mode = newMode;

    if (newMode === 'demo') {
      stopLivePolling();
      dom.modeDemoBtn.classList.add('active');
      dom.modeLiveBtn.classList.remove('active');

      dom.modeCallout.classList.remove('live-active');
      dom.modeCallout.classList.add('demo-active');
      dom.calloutBadge.textContent = 'DEMO SIMULATION ACTIVE';
      dom.calloutBadge.style.color = 'var(--cyan)';
      dom.calloutText.textContent =
        'Interactive preview mode enabled. Click switches or choose test vectors to simulate error detection.';
      dom.demoPresetsBar.classList.remove('hidden');

      dom.telemetryModeText.textContent = 'DEMO SIM';
      dom.connectionDot.className = 'status-dot connected';
      dom.connectionText.textContent = 'Ready (Sim)';
      dom.connectionText.style.color = 'var(--cyan)';
      dom.connectionBanner.classList.add('hidden');

      renderUI('Switched to Demo Mode');
    } else {
      // Live ESP32 Mode
      dom.modeDemoBtn.classList.remove('active');
      dom.modeLiveBtn.classList.add('active');

      dom.modeCallout.classList.remove('demo-active');
      dom.modeCallout.classList.add('live-active');
      dom.calloutBadge.textContent = 'ESP32 LIVE HARDWARE ACTIVE';
      dom.calloutText.textContent =
        `Polling hardware pins via ${state.apiEndpoint} every ${state.pollIntervalMs}ms. Manual switch clicking is disabled in live mode to preserve hardware truth.`;
      dom.demoPresetsBar.classList.add('hidden');

      dom.telemetryModeText.textContent = `LIVE ${state.pollIntervalMs}ms`;
      dom.connectionDot.className = 'status-dot';
      dom.connectionText.textContent = 'Connecting...';
      dom.connectionText.style.color = 'var(--text-secondary)';

      startLivePolling();
      renderUI('Switched to Live ESP32 Mode');
    }
  }

  // -------------------------------------------------------------------------
  // 11. EVENT LISTENERS & INTERACTION BINDINGS
  // -------------------------------------------------------------------------
  function initEventListeners() {
    // Mode Switcher Buttons
    dom.modeDemoBtn.addEventListener('click', () => setMode('demo'));
    dom.modeLiveBtn.addEventListener('click', () => setMode('live'));

    // Switch Card Clicks (Only active in Demo mode)
    dom.switchCards.forEach((item, index) => {
      item.card.addEventListener('click', () => {
        if (state.mode !== 'demo') {
          // Subtle notification that live hardware is read-only
          alert('Dashboard is in ESP32 Live Hardware Mode. In this mode, physical DIP switches on the breadboard are the authoritative source of truth.');
          return;
        }

        // Toggle bit value
        state[item.key] = state[item.key] === 1 ? 0 : 1;
        renderUI(`Switch ${index + 1} Toggled (${state[item.key]})`);
      });
    });

    // Preset Vectors in Demo Mode
    const presetButtons = document.querySelectorAll('.preset-btn[data-preset]');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;

        switch (preset) {
          case 'valid-0':
            state.d1 = 0; state.d2 = 0; state.d3 = 0; state.d4 = 0;
            state.receivedParity = 0; // 0 ^ 0 ^ 0 ^ 0 = 0
            renderUI('Preset: All 0s (Clean)');
            break;

          case 'valid-1':
            state.d1 = 1; state.d2 = 1; state.d3 = 1; state.d4 = 1;
            state.receivedParity = 0; // 1 ^ 1 ^ 1 ^ 1 = 0
            renderUI('Preset: All 1s (Clean)');
            break;

          case 'sample-valid':
            state.d1 = 1; state.d2 = 0; state.d3 = 1; state.d4 = 0;
            state.receivedParity = 0; // 1 ^ 0 ^ 1 ^ 0 = 0
            renderUI('Preset: 1010 Pattern (Clean)');
            break;

          case 'inject-error':
            // Invert received parity bit to guarantee a parity error
            state.receivedParity = state.calculatedParity === 0 ? 1 : 0;
            renderUI('Preset: Injected Bit Error (Mismatch)');
            break;

          case 'random':
            state.d1 = Math.random() > 0.5 ? 1 : 0;
            state.d2 = Math.random() > 0.5 ? 1 : 0;
            state.d3 = Math.random() > 0.5 ? 1 : 0;
            state.d4 = Math.random() > 0.5 ? 1 : 0;
            // 60% chance valid, 40% chance error
            const validP = state.d1 ^ state.d2 ^ state.d3 ^ state.d4;
            state.receivedParity = Math.random() > 0.4 ? validP : (validP === 1 ? 0 : 1);
            renderUI('Preset: Random Vector Test');
            break;
        }
      });
    });

    // Clear Audit Log
    if (dom.clearLogBtn) {
      dom.clearLogBtn.addEventListener('click', () => {
        state.history = [];
        renderAuditLog();
      });
    }

    // Dismiss Connection Banner
    if (dom.bannerDismissBtn) {
      dom.bannerDismissBtn.addEventListener('click', () => {
        dom.connectionBanner.classList.add('hidden');
      });
    }

    // Configuration Modal
    if (dom.configModalOpenBtn) {
      dom.configModalOpenBtn.addEventListener('click', () => {
        dom.apiUrlInput.value = state.apiEndpoint;
        dom.pollIntervalInput.value = state.pollIntervalMs;
        dom.pollIntervalVal.textContent = `${state.pollIntervalMs} ms`;
        dom.configModal.classList.remove('hidden');
      });
    }

    if (dom.configModalCloseBtn) {
      dom.configModalCloseBtn.addEventListener('click', () => {
        dom.configModal.classList.add('hidden');
      });
    }

    if (dom.pollIntervalInput) {
      dom.pollIntervalInput.addEventListener('input', (e) => {
        dom.pollIntervalVal.textContent = `${e.target.value} ms`;
      });
    }

    if (dom.saveConfigBtn) {
      dom.saveConfigBtn.addEventListener('click', () => {
        state.apiEndpoint = dom.apiUrlInput.value.trim() || '/api/status';
        state.pollIntervalMs = parseInt(dom.pollIntervalInput.value, 10) || 500;
        dom.configModal.classList.add('hidden');

        if (state.mode === 'live') {
          startLivePolling();
          dom.telemetryModeText.textContent = `LIVE ${state.pollIntervalMs}ms`;
        }
      });
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
      if (e.target === dom.configModal) {
        dom.configModal.classList.add('hidden');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 12. INITIALIZATION
  // -------------------------------------------------------------------------
  function init() {
    initTruthTable();
    initEventListeners();

    // Initial state: D1=1, D2=0, D3=1, D4=0 -> 1010, P_rx = 0 (Clean transmission)
    state.d1 = 1;
    state.d2 = 0;
    state.d3 = 1;
    state.d4 = 0;
    state.receivedParity = 0;

    renderUI('Dashboard Initialized (1010)');
  }

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
