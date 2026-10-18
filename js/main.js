// main.js - Main application entry point, UI wiring, and initialization
let isInitialized = false;

// Keyboard mapping as MIDI note numbers (not row indexes)
// Row index = 95 - midiNote (row 0 = B6/MIDI 95, row 59 = C2/MIDI 36)
// Mapped by physical key code (e.code) so AZERTY/QWERTZ layouts work and
// Shift / CapsLock do not break notes.
const keyMap = {
  // White keys
  KeyA: 60,   // C4
  KeyS: 62,   // D4
  KeyD: 64,   // E4
  KeyF: 65,   // F4
  KeyG: 67,   // G4
  KeyH: 69,   // A4
  KeyJ: 71,   // B4
  KeyK: 72,   // C5
  KeyL: 74,   // D5
  Semicolon: 76, // E5
  KeyQ: 77,   // F5
  KeyW: 79,   // G5
  KeyE: 81,   // A5
  KeyR: 83,   // B5
  // Black keys (sharps/flats)
  KeyZ: 61,   // C#4
  KeyX: 63,   // D#4
  KeyC: 66,   // F#4
  KeyV: 68,   // G#4
  KeyB: 70,   // A#4
  KeyN: 73,   // C#5
  KeyM: 75,   // D#5
  Comma: 78,  // F#5
  Period: 80, // G#5
  Slash: 82,  // A#5
};

// Base MIDI note for keyboard mapping
const KEYBOARD_BASE_MIDI = 60; // C4
let keyboardOctaveShift = 0; // PageDown/PageUp shift octave up/down

// Display label for a physical key code
function codeLabel(code) {
  const labels = {
    Semicolon: ';',
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  if (labels[code]) return labels[code];
  return code.replace('Key', '');
}

// Convert MIDI note to row index (row 0 = highest note)
function midiToRow(midiNote) {
  // Row 0 = MIDI 95 (B6), row 59 = MIDI 36 (C2)
  const maxMidi = 36 + window.state.ROWS - 1;
  return maxMidi - midiNote;
}

// Initialize the application
function initApp() {
  if (isInitialized) return;
  isInitialized = true;
  
  // Initialize audio context first
  initAudio();
  // Update global audioContext reference
  window.audioContext = audioContext;
  
  // Initialize envelope
  initEnvelope();
  
  // Build timbre menu from code
  buildTimbreMenu();
  // Load preset for default timbre
  loadTimbrePreset('piano');
  
  // Initialize sequencer and piano (sequencer first so piano can use window.state)
  initSequencer();
  initPiano();
  
  // After initializing both, ensure piano size matches grid size
  resizePiano();

  // Render the keyboard map (playable vs unplayable keys)
  renderKeyboardMap();

  // Set up UI event listeners
  setupUIListeners();

  // Initialize dock
  initDock();

  // Initialize export
  initExport();
  
  // Load autosave if available, otherwise load demo pattern
  if (!window.loadSongFromStorage()) {
    loadDemoPattern();
  }
  
  // Update position readout
  if (typeof window.updatePositionReadout === 'function') {
    window.updatePositionReadout();
  }
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Handle window resize with a ResizeObserver on the scroller
  const scroller = document.getElementById('gridScroller');
  const ro = new ResizeObserver(() => {
    resizeCanvas();
    resizePiano();
    if (typeof window.drawOverview === 'function') window.drawOverview();
    if (typeof window.drawEnvelope === 'function') window.drawEnvelope();
  });
  if (scroller) ro.observe(scroller);

  // Redraw everything once the web font is ready (canvas fonts have a fallback)
  document.fonts.ready.then(() => {
    if (typeof window.resizeCanvas === 'function') window.resizeCanvas();
    if (typeof window.drawGrid === 'function') window.drawGrid();
    if (typeof window.drawPiano === 'function') window.drawPiano();
    if (typeof window.drawOverview === 'function') window.drawOverview();
    if (typeof window.drawEnvelope === 'function') window.drawEnvelope();
  });

  // Ensure audio context is resumed on first user interaction
  document.addEventListener('click', () => {
    resumeAudioContext().then(() => {
      console.log('AudioContext resumed');
    });
  }, { once: true });
}

// Build the timbre select options from INSTRUMENTS
function buildTimbreMenu() {
  const select = document.getElementById('waveformSelect');
  if (!select) return;
  
  // Group instruments by family
  const families = {};
  for (const [key, inst] of Object.entries(INSTRUMENTS)) {
    const family = inst.family || 'Other';
    if (!families[family]) families[family] = [];
    families[family].push({ key, label: inst.label });
  }
  
  // Clear select
  select.innerHTML = '';
  
  // Add optgroups for each family (in order)
  const familyOrder = ['Keyboards', 'Strings', 'Plucked', 'Woodwinds', 'Brass', 'Reeds & Voices', 'Mallets', 'Synth'];
  for (const family of familyOrder) {
    if (families[family]) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = family;
      for (const { key, label } of families[family]) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        optgroup.appendChild(option);
      }
      select.appendChild(optgroup);
    }
  }
  
  // Add Synth waves group
  const synthGroup = document.createElement('optgroup');
  synthGroup.label = 'Synth waves';
  const waves = ['sine', 'square', 'sawtooth', 'triangle'];
  for (const wave of waves) {
    const option = document.createElement('option');
    option.value = wave;
    option.textContent = wave.charAt(0).toUpperCase() + wave.slice(1);
    synthGroup.appendChild(option);
  }
  select.appendChild(synthGroup);
  
  // Set default selection to 'piano'
  select.value = 'piano';
}

// Set up UI event listeners
function setupUIListeners() {
  // Play/Stop button
  const playStopBtn = document.getElementById('playStopBtn');
  if (playStopBtn) {
    playStopBtn.addEventListener('click', () => {
      togglePlay();
      // Update button text
      playStopBtn.textContent = window.state.isPlaying ? 'Stop' : 'Play';
    });
  }
  
  // BPM slider
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmValue = document.getElementById('bpmValue');
  if (bpmSlider && bpmValue) {
    bpmSlider.addEventListener('input', () => {
      const val = bpmSlider.value;
      bpmValue.textContent = val;
      setBpm(parseInt(val));
    });
    bpmValue.textContent = bpmSlider.value;
  }
  
  // Clear button
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearGrid);
  }
  
  // Random button
  const randomBtn = document.getElementById('randomBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', randomPattern);
  }

  // Bars minus
  const barsMinusBtn = document.getElementById('barsMinusBtn');
  if (barsMinusBtn) {
    barsMinusBtn.addEventListener('click', () => {
      const input = document.getElementById('barsInput');
      const val = Math.max(1, parseInt(input.value || '8') - 1);
      input.value = val;
      setBars(val);
    });
  }

  // Bars plus
  const barsPlusBtn = document.getElementById('barsPlusBtn');
  if (barsPlusBtn) {
    barsPlusBtn.addEventListener('click', () => {
      const input = document.getElementById('barsInput');
      const val = Math.min(128, parseInt(input.value || '8') + 1);
      input.value = val;
      setBars(val);
    });
  }

  // Bars input change
  const barsInput = document.getElementById('barsInput');
  if (barsInput) {
    barsInput.addEventListener('change', () => {
      const val = Math.max(1, Math.min(128, parseInt(barsInput.value || '8')));
      barsInput.value = val;
      setBars(val);
    });
  }

  // Draw / Scroll toggle (touch devices): in Draw mode the grid canvas does
  // not pan so finger painting works; in Scroll mode the scroller pans.
  const drawScrollBtn = document.getElementById('drawScrollBtn');
  const scroller = document.getElementById('gridScroller');
  let drawMode = true;
  if (drawScrollBtn && scroller) {
    function updateTouchAction() {
      scroller.style.touchAction = drawMode ? 'none' : 'pan-x pan-y';
      drawScrollBtn.setAttribute('aria-pressed', drawMode);
      drawScrollBtn.textContent = drawMode ? 'Draw' : 'Scroll';
    }
    drawScrollBtn.addEventListener('click', () => {
      drawMode = !drawMode;
      updateTouchAction();
    });
    updateTouchAction();
  }

  // Duplicate bar
  const duplicateBarBtn = document.getElementById('duplicateBarBtn');
  if (duplicateBarBtn) {
    duplicateBarBtn.addEventListener('click', duplicateBar);
  }

  // Clear bar
  const clearBarBtn = document.getElementById('clearBarBtn');
  if (clearBarBtn) {
    clearBarBtn.addEventListener('click', clearBar);
  }

  // Copy bar
  const copyBarBtn = document.getElementById('copyBarBtn');
  if (copyBarBtn) {
    copyBarBtn.addEventListener('click', copyBar);
  }

  // Paste bar
  const pasteBarBtn = document.getElementById('pasteBarBtn');
  if (pasteBarBtn) {
    pasteBarBtn.addEventListener('click', pasteBar);
  }

  // Undo / Redo
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      undo();
    });
  }
  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      redo();
    });
  }

  // Rec (step recording) toggle
  const recBtn = document.getElementById('recBtn');
  if (recBtn) {
    recBtn.addEventListener('click', () => {
      window.state.rec = !window.state.rec;
      recBtn.setAttribute('aria-pressed', window.state.rec);
      recBtn.classList.toggle('rec-on', window.state.rec);
    });
  }

  // Octave shift buttons in the Keyboard panel
  const octDownBtn = document.getElementById('octDownBtn');
  if (octDownBtn) {
    octDownBtn.addEventListener('click', () => {
      keyboardOctaveShift = Math.max(-2, keyboardOctaveShift - 1);
      renderKeyboardMap();
    });
  }
  const octUpBtn = document.getElementById('octUpBtn');
  if (octUpBtn) {
    octUpBtn.addEventListener('click', () => {
      keyboardOctaveShift = Math.min(2, keyboardOctaveShift + 1);
      renderKeyboardMap();
    });
  }

  // New song
  const newSongBtn = document.getElementById('newSongBtn');
  if (newSongBtn) {
    newSongBtn.addEventListener('click', () => {
      const hasNotes = window.state.grid.some(row => row.some(cell => cell));
      if (hasNotes) {
        if (!confirm('Start a new song? Unsaved changes will be lost.')) return;
      }
      window.state.grid = Array.from({ length: window.state.ROWS }, () =>
        Array.from({ length: window.state.COLS }, () => false));
      window.state.playStep = 0;
      window.state.startStep = 0;
      window.state.cacheDirty = true;
      window.state.undoStack = [];
      window.state.redoStack = [];
      window.drawGrid();
      window.drawOverview();
      window.updatePositionReadout();
      loadTimbrePreset('piano');
      document.getElementById('waveformSelect').value = 'piano';
    });
  }

  // Save song
  const saveSongBtn = document.getElementById('saveSongBtn');
  if (saveSongBtn) {
    saveSongBtn.addEventListener('click', saveSong);
  }

  // Open song
  const openSongBtn = document.getElementById('openSongBtn');
  const openSongInput = document.getElementById('openSongInput');
  if (openSongBtn) {
    openSongBtn.addEventListener('click', () => {
      openSongInput.click();
    });
  }
  if (openSongInput) {
    openSongInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) openSong(file);
      e.target.value = '';
    });
  }

  // Zoom out button
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      window.state.zoom = Math.max(12, window.state.zoom - 4);
      resizeCanvas();
    });
  }

  // Zoom in button
  const zoomInBtn = document.getElementById('zoomInBtn');
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      window.state.zoom = Math.min(64, window.state.zoom + 4);
      resizeCanvas();
    });
  }

  // Follow toggle
  const followBtn = document.getElementById('followBtn');
  if (followBtn) {
    followBtn.addEventListener('change', (e) => {
      window.state.follow = e.target.checked;
    });
  }

  // Volume slider
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  if (volumeSlider && volumeValue) {
    volumeSlider.addEventListener('input', () => {
      const val = volumeSlider.value;
      volumeValue.textContent = val;
      setMasterVolume(parseFloat(val));
    });
    volumeValue.textContent = volumeSlider.value;
  }
  
  // Timbre select (loads ADSR preset)
  const timbreSelect = document.getElementById('waveformSelect');
  if (timbreSelect) {
    timbreSelect.addEventListener('change', () => {
      loadTimbrePreset(timbreSelect.value);
      // Play preview note
      playPreviewNote();
    });
  }
}

// Load ADSR preset for a timbre into sliders
function loadTimbrePreset(timbre) {
  const instrument = INSTRUMENTS[timbre];
  if (instrument && instrument.preset) {
    const { attack, decay, sustain, release } = instrument.preset;
    // Update sliders
    document.getElementById('attackSlider').value = attack;
    document.getElementById('decaySlider').value = decay;
    document.getElementById('sustainSlider').value = sustain;
    document.getElementById('releaseSlider').value = release;
    // Update displayed values
    document.getElementById('attackValue').textContent = attack;
    document.getElementById('decayValue').textContent = decay;
    document.getElementById('sustainValue').textContent = sustain;
    document.getElementById('releaseValue').textContent = release;
    // Redraw envelope
    if (typeof drawEnvelope === 'function') drawEnvelope();
  }
}

// Play a short preview note when timbre changes
function playPreviewNote() {
  if (window.state.exporting) return;
  resumeAudioContext().then(() => {
    const frequency = 440; // A4
    const duration = 0.5;
    const timbre = document.getElementById('waveformSelect').value;
    const envelope = {
      attack: parseFloat(document.getElementById('attackSlider').value),
      decay: parseFloat(document.getElementById('decaySlider').value),
      sustain: parseFloat(document.getElementById('sustainSlider').value),
      release: parseFloat(document.getElementById('releaseSlider').value)
    };
    playNote(frequency, audioContext.currentTime, duration, timbre, envelope);
  });
}

// Load a demo pattern (some notes filled in)
function loadDemoPattern() {
  // Clear first
  clearGrid();
  // Define a demo pattern using note names
  const demoPattern = {
    'C5': [0, 4, 8, 12],
    'D5': [2, 6, 10, 14],
    'E5': [1, 5, 9, 13],
    'G5': [3, 7, 11, 15],
    'A5': [0, 2, 4, 6, 8, 10, 12, 14],
    'C4': [1, 3, 5, 7, 9, 11, 13, 15],
    'D4': [0, 4, 8, 12],
    'E4': [2, 6, 10, 14]
  };
  
  // For each note in the demo pattern, set the corresponding row in the grid
  for (const [noteName, steps] of Object.entries(demoPattern)) {
    const rowIndex = window.state.noteNames.indexOf(noteName);
    if (rowIndex >= 0) {
      steps.forEach(col => {
        window.state.grid[rowIndex][col] = true;
      });
    }
  }
  drawGrid();
}

// Render the keyboard map showing which keys can/cannot be used to play notes
function renderKeyboardMap() {
  const container = document.getElementById('keyboardMap');
  if (!container || !window.state) return;

  const maxMidi = 36 + window.state.ROWS - 1;

  container.innerHTML = '';

  const hint = document.createElement('p');
  hint.className = 'keyboard-hint-text';
  const octaveText = keyboardOctaveShift !== 0 ? ` (octave ${keyboardOctaveShift > 0 ? '+' : ''}${keyboardOctaveShift})` : '';
  hint.textContent = 'Press a key to play the corresponding note' + octaveText + '.';
  container.appendChild(hint);

  const mapWrap = document.createElement('div');
  mapWrap.className = 'keyboard-keys';

  for (let row = 0; row < window.state.ROWS; row++) {
    // Find which key maps to this row
    let keyForRow = null;
    for (const [key, midiNote] of Object.entries(keyMap)) {
      const adjustedMidi = midiNote + keyboardOctaveShift * 12;
      const r = maxMidi - adjustedMidi;
      if (r === row) {
        keyForRow = key;
        break;
      }
    }
    const noteName = window.state.noteNames[row];
    const isPlayable = keyForRow !== null;

    const keyEl = document.createElement('div');
    keyEl.className = 'key ' + (isPlayable ? 'playable' : 'unplayable');
    keyEl.title = noteName;

    const kbd = document.createElement('kbd');
    kbd.textContent = isPlayable ? codeLabel(keyForRow) : '—';
    keyEl.appendChild(kbd);

    const note = document.createElement('span');
    note.className = 'key-note';
    note.textContent = noteName;
    keyEl.appendChild(note);

    mapWrap.appendChild(keyEl);
  }

  container.appendChild(mapWrap);
}

// Set up keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts while a dialog is open
    if (document.querySelector('dialog[open]')) return;

    // Ignore all shortcuts when focus is inside an input / select / textarea /
    // contenteditable (typing "e" in the Bars box must not play a note)
    const target = document.activeElement;
    if (target && (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA')) {
      return;
    }

    // With ctrl/meta/alt held, handle ONLY undo/redo/duplicate and return.
    // Notes only fire with no modifiers.
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Space (ctrl+space) hijacks nothing here; handled below without modifiers
      // Ctrl/Cmd + Z: undo
      if (e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: redo
      if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
        e.preventDefault();
        redo();
        return;
      }
      // Ctrl/Cmd + D: duplicate bar
      if (e.code === 'KeyD') {
        e.preventDefault();
        duplicateBar();
        return;
      }
      return;
    }

    // Space: play/stop. Only when no modifier; never hijack a focused button
    // or select (Space on a focused button only activates that button).
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
      const playStopBtn = document.getElementById('playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = window.state.isPlaying ? 'Stop' : 'Play';
      }
      return;
    }

    // Ignore key repeat for note keys (holding a key retriggers it)
    if (e.repeat) return;

    // Note keys only fire with no modifiers (checked above). e.code based.
    if (e.code in keyMap) {
      e.preventDefault();
      const midiNote = keyMap[e.code] + keyboardOctaveShift * 12;
      const row = midiToRow(midiNote);
      if (row >= 0 && row < window.state.ROWS) {
        window.playPianoKey(row);
      }
    }

    // Home: go to start of song
    if (e.code === 'Home') {
      e.preventDefault();
      window.state.startStep = 0;
      window.state.playStep = 0;
      window.drawGrid();
      window.drawOverview();
      window.updatePositionReadout();
    }
    // End: go to end of song
    if (e.code === 'End') {
      e.preventDefault();
      window.state.startStep = window.state.COLS - 1;
      window.state.playStep = window.state.COLS - 1;
      window.drawGrid();
      window.drawOverview();
      window.updatePositionReadout();
    }
    // PageDown: octave down
    if (e.code === 'PageDown') {
      e.preventDefault();
      keyboardOctaveShift = Math.max(-2, keyboardOctaveShift - 1);
      renderKeyboardMap();
    }
    // PageUp: octave up
    if (e.code === 'PageUp') {
      e.preventDefault();
      keyboardOctaveShift = Math.min(2, keyboardOctaveShift + 1);
      renderKeyboardMap();
    }
  });

  // Ctrl/Cmd + mouse wheel for zoom only when the pointer is over #gridScroller.
  // Never hijack browser zoom elsewhere.
  document.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const scroller = document.getElementById('gridScroller');
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -4 : 4;
    window.state.zoom = Math.max(12, Math.min(64, window.state.zoom + delta));
    resizeCanvas();
  }, { passive: false });
}

// Start the app when the DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Expose a global function for debugging if needed
window.app = {
  initApp,
  state: window.state
};

// Global toggleRec used by the More popover
window.toggleRec = function () {
  const btn = document.getElementById('recBtn');
  if (!btn) return;
  window.state.rec = !window.state.rec;
  btn.setAttribute('aria-pressed', window.state.rec);
  btn.classList.toggle('rec-on', window.state.rec);
};

// Dock toggle + tab switching
window.initDock = function () {
  const dock = document.getElementById('dock');
  const toggle = document.getElementById('dockToggle');
  const content = document.querySelector('.dock-content');
  if (!dock || !toggle) return;

  let collapsed = window.innerHeight < 800;

  function setCollapsed(c) {
    collapsed = c;
    toggle.setAttribute('aria-expanded', !collapsed);
    if (collapsed) {
      content.style.display = 'none';
      dock.style.height = '36px';
      toggle.textContent = '▸ Sound / Keyboard';
    } else {
      content.style.display = '';
      dock.style.height = '';
      toggle.textContent = '▾ Sound / Keyboard';
    }
  }

  setCollapsed(collapsed);
  toggle.addEventListener('click', () => setCollapsed(!collapsed));

  window.addEventListener('resize', () => {
    const want = window.innerHeight < 800;
    if (want !== collapsed) setCollapsed(want);
  });

  // Tab switching
  const tabs = document.querySelectorAll('.dock-tab');
  const panels = document.querySelectorAll('.dock-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('dock' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });
};
