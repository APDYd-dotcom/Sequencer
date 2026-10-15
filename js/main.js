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
  
  // Initialize modules in order: audio, envelope, piano, sequencer
  initAudio();
  initEnvelope();
  initPiano(); // <-- new
  initSequencer();
  
  // After initializing sequencer, ensure piano size matches grid size
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
  
  // Waveform select
  const waveformSelect = document.getElementById('waveformSelect');
  if (waveformSelect) {
    // No action needed, value is read when playing notes
  }
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
    // Keyboard keys to play notes (white keys only)
    if (e.key in keyMap) {
      e.preventDefault();
      const row = keyMap[e.key];
      // Play the note for a fixed duration (e.g., 0.5 seconds)
      // Resume audio context if needed
      resumeAudioContext().then(() => {
        const frequency = window.state.frequencies[row];
        const duration = 0.5; // seconds
        const waveform = document.getElementById('waveformSelect').value;
        const env = {
          attack: parseFloat(document.getElementById('attackSlider').value),
          decay: parseFloat(document.getElementById('decaySlider').value),
          sustain: parseFloat(document.getElementById('sustainSlider').value),
          release: parseFloat(document.getElementById('releaseSlider').value)
        };
        playNote(frequency, audioContext.currentTime, duration, waveform, env);
        // Flash the piano key
        flashPianoKey(row, 0, duration * 1000); // delay 0, duration in ms
      });
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
