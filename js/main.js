// main.js - Main application entry point, UI wiring, and initialization
let isInitialized = false;

// Keyboard mapping for all rows (C4 to B5, chromatic, row 0 = B5 ... row 23 = C4)
// White keys
const keyMap = {
  'a': 23,  // C4
  's': 21,  // D4
  'd': 19,  // E4
  'f': 18,  // F4
  'g': 16,  // G4
  'h': 14,  // A4
  'j': 12,  // B4
  'k': 11,  // C5
  'l': 9,   // D5
  ';': 7,   // E5
  'q': 6,   // F5
  'w': 4,   // G5
  'e': 2,   // A5
  'r': 0,   // B5
  // Black keys (sharps/flats)
  'z': 22,  // C#4
  'x': 20,  // D#4
  'c': 17,  // F#4
  'v': 15,  // G#4
  'b': 13,  // A#4
  'n': 10,  // C#5
  'm': 8,   // D#5
  ',': 5,   // F#5
  '.': 3,   // G#5
  '/': 1,   // A#5
};

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

  // Initialize export
  initExport();
  
  // Load a demo pattern
  loadDemoPattern();
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    resizeCanvas();
    resizePiano();
    renderKeyboardMap();
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

  // Build reverse map: row -> keyboard key
  const rowToKey = {};
  for (const [key, row] of Object.entries(keyMap)) {
    rowToKey[row] = key;
  }

  container.innerHTML = '';

  const hint = document.createElement('p');
  hint.className = 'keyboard-hint-text';
  hint.textContent = 'Press a key to play the corresponding note (all 24 notes C4–B5 are mapped).';
  container.appendChild(hint);

  const mapWrap = document.createElement('div');
  mapWrap.className = 'keyboard-keys';

  for (let row = 0; row < window.state.ROWS; row++) {
    const key = rowToKey[row];
    const noteName = window.state.noteNames[row];
    const isPlayable = key !== undefined;

    const keyEl = document.createElement('div');
    keyEl.className = 'key ' + (isPlayable ? 'playable' : 'unplayable');
    keyEl.title = noteName;

    const kbd = document.createElement('kbd');
    kbd.textContent = isPlayable ? key : '—';
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
    // Space: play/stop
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
      // Update button text
      const playStopBtn = document.getElementById('playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = window.state.isPlaying ? 'Stop' : 'Play';
      }
    }
    // C: clear
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      clearGrid();
    }
    // Keyboard keys to play notes (white keys only) and toggle grid cell
    if (e.key in keyMap) {
      e.preventDefault();
      const row = keyMap[e.key];
      // Play the note, flash key, and toggle grid cell at current step via piano.js function
      window.playPianoKey(row);
    }
  });
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
