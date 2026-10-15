// sequencer.js - Handles the sequencer grid, scheduling, and playback
const state = {
  // Grid: 8 rows (notes) x 16 columns (steps)
  grid: Array.from({ length: 8 }, () => Array(16).fill(false)),
  // Notes: C major pentatonic over 2 octaves, top row = highest pitch
  // We'll define frequencies for each row (from high to low)
  notes: [
    // Row 0 (top): C5
    523.25,
    // Row 1: D5
    587.33,
    // Row 2: E5
    659.25,
    // Row 3: G5
    783.99,
    // Row 4: A5
    880.00,
    // Row 5: C4 (one octave below C5)
    261.63,
    // Row 6: D4
    293.66,
    // Row 7: E4
    329.63
  ],
  // Note names for display (left of grid)
  noteNames: ['C5', 'D5', 'E5', 'G5', 'A5', 'C4', 'D4', 'E4'],
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
  cellWidth: 0,
  cellHeight: 0,
  // Colors for rows (cycle through Google colors)
  rowColors: ['#1a73e8', '#ea4335', '#fbbc04', '#34a853'] // blue, red, yellow, green
};

// Initialize the sequencer canvas and set up event listeners
function initSequencer() {
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
  state.canvas.addEventListener('touchstart', handleTouchStart);
  state.canvas.addEventListener('touchmove', handleTouchMove);
  state.canvas.addEventListener('touchend', handleTouchEnd);
  // We'll track if mouse is down for dragging
  state.isMouseDown = false;
}

// Resize canvas to fit container and handle HiDPI
function resizeCanvas() {
  const canvas = state.canvas;
  const containerWidth = canvas.parentElement.clientWidth;
  // Set the canvas width to container width, height based on aspect ratio (8 rows, 16 cols)
  const desiredHeight = (containerWidth * 8) / 16; // 8/16 = 0.5
  canvas.width = containerWidth * window.devicePixelRatio;
  canvas.height = desiredHeight * window.devicePixelRatio;
  canvas.style.width = containerWidth + 'px';
  canvas.style.height = desiredHeight + 'px';
  // Scale context for HiDPI
  state.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  // Recalculate cell dimensions
  state.cellWidth = canvas.width / window.devicePixelRatio / 16;
  state.cellHeight = canvas.height / window.devicePixelRatio / 8;
  drawGrid();
}

// Draw the entire grid
function drawGrid() {
  const ctx = state.ctx;
  const width = state.canvas.width / window.devicePixelRatio;
  const height = state.canvas.height / window.devicePixelRatio;
  // Clear background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);
  // Draw beat markers (every 4th column)
  ctx.fillStyle = '#e8eaed';
  for (let col = 0; col < 16; col++) {
    if (col % 4 === 0) {
      ctx.fillRect(col * state.cellWidth, 0, state.cellWidth, height);
    }
  }
  // Draw rows (notes) and cells
  for (let row = 0; row < 8; row++) {
    // Draw note name on the left
    ctx.fillStyle = '#5f6368';
    ctx.font = '12px Roboto';
    ctx.textAlign = 'right';
    ctx.fillText(state.noteNames[row], -4, row * state.cellHeight + state.cellHeight * 0.75);
    // Draw cells in this row
    for (let col = 0; col < 16; col++) {
      const x = col * state.cellWidth;
      const y = row * state.cellHeight;
      // If cell is active, fill with row color
      if (state.grid[row][col]) {
        const colorIndex = row % state.rowColors.length;
        ctx.fillStyle = state.rowColors[colorIndex];
        ctx.fillRect(x, y, state.cellWidth, state.cellHeight);
      }
    }
  }
  // Draw playhead (current step)
  ctx.fillStyle = 'rgba(26, 115, 232, 0.3)'; // translucent blue
  ctx.fillRect(state.currentStep * state.cellWidth, 0, state.cellWidth, height);
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
  if (row >= 0 && row < 8 && col >= 0 && col < 16) {
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
}

// Stop the sequencer
function stopSequencer() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  clearInterval(state.schedulerInterval);
  state.schedulerInterval = null;
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
  state.grid = Array.from({ length: 8 }, () => Array(16).fill(false));
  drawGrid();
}

// Generate a random pattern
function randomPattern() {
  state.grid = Array.from({ length: 8 }, () =>
    Array.from({ length: 16 }, () => Math.random() > 0.7)
  );
  drawGrid();
}

// The scheduler: called periodically to check if we need to play notes
function scheduler() {
  const currentTime = audioContext.currentTime;
  const lookahead = state.scheduleAheadTime; // how far ahead to schedule
  // While there are notes that need to be played ahead of time
  while (state.lastNoteTime < currentTime + lookahead) {
    const secondsPerBeat = 60.0 / state.bpm;
    const stepSeconds = secondsPerBeat; // each step is a beat (16th note? Actually we have 16 steps per measure, each step is a 16th note if we consider 4/4 with 16th notes)
    // But we want each step to be a 16th note? Let's assume the grid is 16th notes.
    // So the time for each step is secondsPerBeat / 4? Wait: if BPM is beats per minute, and each beat is a quarter note, then a 16th note is 1/4 of a beat.
    // However, we have 16 steps in the grid, which could be 4 measures of 16th notes? Let's keep it simple: each step is a 16th note.
    // Then the time per step = (60 / BPM) * (1/4) = 15 / BPM seconds.
    // But we can also think of the grid as 16 steps per measure (4/4) with each step being a 16th note.
    // So we'll use: stepTime = 60 / (BPM * 4) = 15 / BPM.
    const stepTime = 60.0 / (state.bpm * 4); // seconds per 16th note
    // Play notes for the current step
    for (let row = 0; row < 8; row++) {
      if (state.grid[row][state.currentStep]) {
        const frequency = state.notes[row];
        // Envelope parameters from envelope.js
        const env = {
          attack: parseFloat(document.getElementById('attackSlider').value),
          decay: parseFloat(document.getElementById('decaySlider').value),
          sustain: parseFloat(document.getElementById('sustainSlider').value),
          release: parseFloat(document.getElementById('releaseSlider').value)
        };
        // The note duration is stepTime (the length of a step)
        // But we want the note to be played for the step duration, and the envelope will shape it.
        // However, the envelope's sustain is held until the note ends (which is stepTime).
        // We'll pass the stepTime as the duration to playNote.
        // Note: the envelope's release will happen after the note duration.
        playNote(frequency, state.lastNoteTime, stepTime, document.getElementById('waveformSelect').value, env);
      }
    }
    // Advance the step and time
    state.lastNoteTime += stepTime;
    state.currentStep = (state.currentStep + 1) % 16;
  }
  // Update the playhead position based on the current time
  // We can compute the current step from the elapsed time since the start of the sequence.
  // But we are already advancing currentStep in the scheduler. However, we also want to draw the playhead smoothly.
  // We'll compute the current step based on the audio time for the draw.
  // We'll do that in the draw function (or we can set state.currentStep based on time).
  // Let's compute the current step for drawing in the drawGrid function (we'll use a separate variable for drawing).
  // For now, we'll keep the currentStep as the step that is being scheduled (or just played).
  // We'll use the same currentStep for drawing, which is updated in the scheduler.
}

// We need to expose functions for main.js
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
