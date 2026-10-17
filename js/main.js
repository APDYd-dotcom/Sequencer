// main.js - Main application entry point, UI wiring, and initialization
let isInitialized = false;

// Keyboard mapping for white keys (two octaves, low to high)
// Notes: C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5, A5, B5
const keyMap = {
  'a': 0,  // C4
  's': 1,  // D4
  'd': 2,  // E4
  'f': 3,  // F4
  'g': 4,  // G4
  'h': 5,  // A4
  'j': 6,  // B4
  'k': 7,  // C5
  'l': 8,  // D5
  ';': 9,  // E5
  'q': 10, // F5
  'w': 11, // G5
  'e': 12, // A5
  'r': 13  // B5
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
  
  // Initialize sequencer and piano (sequencer first so piano can use window.state)
  initSequencer();
  initPiano();
  
  // After initializing both, ensure piano size matches grid size
  resizePiano();
  
  // Set up UI event listeners
  setupUIListeners();
  
  // Load a demo pattern
  loadDemoPattern();
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    resizeCanvas();
    resizePiano();
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

// Set up keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
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
