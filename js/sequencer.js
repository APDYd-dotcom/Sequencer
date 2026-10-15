// sequencer.js - Handles the sequencer grid, scheduling, and playback
const state = {
  // Grid dimensions
  ROWS: 24,   // C4 to B5 (chromatic)
  COLS: 16,   // 16 steps
  ROW_HEIGHT: 20, // pixels per row (logical, not device pixels)
  
  // Grid state: true if cell is active
  grid: [],
  
  // Note information for each row (from high to low: B5 down to C4)
  // We'll generate arrays for note names, frequencies, and whether the key is black
  noteNames: [],
  frequencies: [],
  isBlackKey: [],
  
  // Playback state
  isPlaying: false,
  currentStep: 0,
  bpm: 100,
  
  // Scheduling
  scheduleAheadTime: 0.1, // seconds
  schedulerInterval: null,
  lastNoteTime: 0,
  
  // Canvas
  canvas: null,
  ctx: null,
  // Logical canvas width (will be set in resizeCanvas)
  logicalWidth: 0,
  logicalHeight: 0,
  
  // Colors for active cells (cycle through Google colors for rows)
  rowColors: ['#1a73e8', '#ea4335', '#fbbc04', '#34a853'], // blue, red, yellow, green
  
  // Animation frame ID for playhead
  animationFrameId: null,
};

// Initialize note arrays from MIDI 60 (C4) to 83 (B5)
// We'll store from highest to lowest so row 0 is B5, row 23 is C4.
function initNotes() {
  state.noteNames = [];
  state.frequencies = [];
  state.isBlackKey = [];
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  for (let midi = 83; midi >= 60; midi--) {
    const noteIndex = (midi - 60) % 12;
    const name = noteNames[noteIndex] + (4 + Math.floor((midi - 60) / 12));
    state.noteNames.push(name);
    
    // Frequency: 440 * 2^((midi-69)/12)
    state.frequencies.push(440 * Math.pow(2, (midi - 69) / 12));
    
    // Black key if note is C#, D#, F#, G#, A# (i.e., noteIndex in [1,3,6,8,10])
    state.isBlackKey.push([1,3,6,8,10].includes(noteIndex));
  }
}

// Initialize the sequencer canvas and set up event listeners
function initSequencer() {
  // Initialize note arrays
  initNotes();
  
  // Initialize grid to all false
  state.grid = Array.from({ length: state.ROWS }, () => 
    Array.from({ length: state.COLS }, () => false));
  
  state.canvas = document.getElementById('gridCanvas');
  if (!state.canvas) return;
  state.ctx = state.canvas.getContext('2d');
  resizeCanvas();
  drawGrid();
  
  // Set up mouse/touch events
  state.canvas.addEventListener('mousedown', handleMouseDown);
  state.canvas.addEventListener('mousemove', handleMouseMove);
  state.canvas.addEventListener('mouseup', handleMouseUp);
  state.canvas.addEventListener('mouseleave', handleMouseUp);
  state.canvas.addEventListener('touchstart', handleTouchStart, {passive: false});
  state.canvas.addEventListener('touchmove', handleTouchMove, {passive: false});
  state.canvas.addEventListener('touchend', handleTouchEnd);
  
  // We'll track if mouse is down for dragging
  state.isMouseDown = false;
  state.lastHoveredRow = -1; // to avoid retriggering the same key when dragging on piano (handled in piano.js)
}

// Resize canvas to fit container and handle HiDPI
function resizeCanvas() {
  const container = document.querySelector('.grid-area');
  if (!container) return;
  
  // Logical width: container width minus piano width? Actually, the grid area container already has the piano to its left.
  // We want the grid canvas to fill the grid area.
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // We want each row to be ROW_HEIGHT pixels tall, so the logical height is ROWS * ROW_HEIGHT
  state.logicalHeight = state.ROWS * state.ROW_HEIGHT;
  state.logicalWidth = containerWidth; // we'll use the full width of the container
  
  // Set the canvas size in device pixels
  state.canvas.width = state.logicalWidth * window.devicePixelRatio;
  state.canvas.height = state.logicalHeight * window.devicePixelRatio;
  
  // Set the CSS size
  state.canvas.style.width = state.logicalWidth + 'px';
  state.canvas.style.height = state.logicalHeight + 'px';
  
  // Set the transform to scale by devicePixelRatio
  state.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  
  // Recalculate cell dimensions (in logical pixels)
  state.cellWidth = state.logicalWidth / state.COLS;
  state.cellHeight = state.ROW_HEIGHT; // fixed
  
  drawGrid();
  
  // Also resize piano to match height
  if (window.resizePiano) {
    window.resizePiano();
  }
}

// Draw the entire grid
function drawGrid() {
  const ctx = state.ctx;
  const width = state.logicalWidth;
  const height = state.logicalHeight;
  
  // Clear background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);
  
  // Draw row backgrounds: white for white keys, very light grey for black keys
  for (let row = 0; row < state.ROWS; row++) {
    if (state.isBlackKey[row]) {
      ctx.fillStyle = '#eceff1'; // light grey
    } else {
      ctx.fillStyle = '#ffffff'; // white
    }
    ctx.fillRect(0, row * state.cellHeight, width, state.cellHeight);
  }
  
  // Draw horizontal grid lines (between rows)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let row = 0; row <= state.ROWS; row++) {
    const y = row * state.cellHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Draw vertical grid lines (between columns)
  // Make every 4th line stronger (beats)
  for (let col = 0; col <= state.COLS; col++) {
    const x = col * state.cellWidth;
    if (col % 4 === 0) {
      ctx.strokeStyle = '#b0b0b0'; // stronger for beats
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Draw active cells
  for (let row = 0; row < state.ROWS; row++) {
    const colorIndex = row % state.rowColors.length;
    ctx.fillStyle = state.rowColors[colorIndex];
    for (let col = 0; col < state.COLS; col++) {
      if (state.grid[row][col]) {
        const x = col * state.cellWidth;
        const y = row * state.cellHeight;
        ctx.fillRect(x, y, state.cellWidth, state.cellHeight);
      }
    }
  }
  
  // Draw playhead only when not playing (so we see it when stopped)
  if (!state.isPlaying) {
    ctx.fillStyle = 'rgba(26, 115, 232, 0.3)'; // translucent blue
    ctx.fillRect(state.currentStep * state.cellWidth, 0, state.cellWidth, height);
  }
}

// Handle mouse down event
function handleMouseDown(e) {
  const pos = getMousePos(state.canvas, e);
  toggleCell(pos.x, pos.y);
  state.isMouseDown = true;
}

// Handle mouse move event (only if mouse is down)
function handleMouseMove(e) {
  if (!state.isMouseDown) return;
  const pos = getMousePos(state.canvas, e);
  toggleCell(pos.x, pos.y);
}

// Handle mouse up event
function handleMouseUp() {
  state.isMouseDown = false;
}

// Handle touch start
function handleTouchStart(e) {
  e.preventDefault();
  const pos = getTouchPos(state.canvas, e);
  toggleCell(pos.x, pos.y);
  state.isMouseDown = true;
}

// Handle touch move
function handleTouchMove(e) {
  e.preventDefault();
  if (!state.isMouseDown) return;
  const pos = getTouchPos(state.canvas, e);
  toggleCell(pos.x, pos.y);
}

// Handle touch end
function handleTouchEnd() {
  state.isMouseDown = false;
}

// Toggle a cell at canvas coordinates (x, y)
function toggleCell(x, y) {
  // Convert to grid coordinates
  const col = Math.floor(x / state.cellWidth);
  const row = Math.floor(y / state.cellHeight);
  if (row >= 0 && row < state.ROWS && col >= 0 && col < state.COLS) {
    state.grid[row][col] = !state.grid[row][col];
    drawGrid();
  }
}

// Get mouse position relative to canvas
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

// Get touch position relative to canvas
function getTouchPos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

// Start the sequencer
function startSequencer() {
  if (state.isPlaying) return;
  state.isPlaying = true;
  state.currentStep = 0;
  state.lastNoteTime = audioContext.currentTime;
  // Start the scheduler
  state.schedulerInterval = setInterval(scheduler, 25); // check every 25ms
  // Start animation loop for playhead
  animatePlayhead();
}

// Stop the sequencer
function stopSequencer() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  clearInterval(state.schedulerInterval);
  state.schedulerInterval = null;
  // Cancel animation frame
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

// Toggle play/stop
function togglePlay() {
  if (state.isPlaying) {
    stopSequencer();
  } else {
    startSequencer();
  }
}

// Set BPM
function setBpm(bpm) {
  state.bpm = bpm;
}

// Clear the grid
function clearGrid() {
  state.grid = Array.from({ length: state.ROWS }, () => 
    Array.from({ length: state.COLS }, () => false));
  drawGrid();
}

// Generate a random pattern (about 10% chance per cell)
function randomPattern() {
  state.grid = Array.from({ length: state.ROWS }, () => 
    Array.from({ length: state.COLS }, () => Math.random() > 0.9));
  drawGrid();
}

// The scheduler: called periodically to check if we need to play notes
function scheduler() {
  const currentTime = audioContext.currentTime;
  const lookahead = state.scheduleAheadTime; // how far ahead to schedule
  // While there are notes that need to be played ahead of time
  while (state.lastNoteTime < currentTime + lookahead) {
    const secondsPerBeat = 60.0 / state.bpm;
    const stepTime = secondsPerBeat / 4; // each step is a 16th note (assuming 16 steps per measure of 16th notes)
    
    // Play notes for the current step
    for (let row = 0; row < state.ROWS; row++) {
      if (state.grid[row][state.currentStep]) {
        const frequency = state.frequencies[row];
        // Envelope parameters from envelope.js
        const env = {
          attack: parseFloat(document.getElementById('attackSlider').value),
          decay: parseFloat(document.getElementById('decaySlider').value),
          sustain: parseFloat(document.getElementById('sustainSlider').value),
          release: parseFloat(document.getElementById('releaseSlider').value)
        };
        // The note duration is stepTime (the length of a step)
        playNote(frequency, state.lastNoteTime, stepTime, document.getElementById('waveformSelect').value, env);
        
        // Flash the piano key for this note
        // Calculate delay in milliseconds from now to when the note starts
        const delayMs = (state.lastNoteTime - audioContext.currentTime) * 1000;
        const durationMs = stepTime * 1000;
        flashPianoKey(row, delayMs, durationMs);
      }
    }
    
    // Advance the step and time
    state.lastNoteTime += stepTime;
    state.currentStep = (state.currentStep + 1) % state.COLS;
  }
}

// Animation loop for smooth playhead movement
function animatePlayhead() {
  if (!state.isPlaying) return;
  
  // We'll draw the grid and then the playhead at the exact position based on audio time
  // This ensures smooth movement even if the scheduler runs at a different interval.
  drawGrid();
  
  // Calculate the exact step position based on audio time
  const secondsPerBeat = 60.0 / state.bpm;
  const stepTime = secondsPerBeat / 4; // 16th note
  const beatsSinceStart = (audioContext.currentTime - (state.lastNoteTime - state.currentStep * stepTime)) / stepTime;
  const exactStep = beatsSinceStart % state.COLS;
  
  // Draw playhead at exactStep
  state.ctx.fillStyle = 'rgba(26, 115, 232, 0.3)';
  state.ctx.fillRect(exactStep * state.cellWidth, 0, state.cellWidth, state.logicalHeight);
  
  // Request next frame
  state.animationFrameId = requestAnimationFrame(animatePlayhead);
}

// Expose functions for main.js and piano.js
window.initSequencer = initSequencer;
window.resizeCanvas = resizeCanvas;
window.drawGrid = drawGrid;
window.startSequencer = startSequencer;
window.stopSequencer = stopSequencer;
window.togglePlay = togglePlay;
window.setBpm = setBpm;
window.clearGrid = clearGrid;
window.randomPattern = randomPattern;
window.state = state; // for debugging

// Initialize notes on load
initNotes();