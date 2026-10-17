// piano.js - Handles the piano keyboard drawing and interaction
let pianoState = {
  canvas: null,
  ctx: null,
  // Logical dimensions (will be set in resizePiano)
  logicalWidth: 0,
  logicalHeight: 0,
  // Key dimensions in logical pixels
  keyWidth: 0,
  keyHeight: 0,
  // Black key dimensions
  blackKeyWidthRatio: 0.6, // 60% of white key width
  blackKeyHeightRatio: 0.6, // 60% of white key height
  // Interaction state
  isMouseDown: false,
  lastHoveredRow: -1, // to avoid retriggering the same key when dragging
};

// Initialize the piano canvas
function initPiano() {
  pianoState.canvas = document.getElementById('pianoCanvas');
  if (!pianoState.canvas) return;
  pianoState.ctx = pianoState.canvas.getContext('2d');
  resizePiano();
  drawPiano();
  
  // Set up mouse/touch events
  pianoState.canvas.addEventListener('mousedown', handlePianoMouseDown);
  pianoState.canvas.addEventListener('mousemove', handlePianoMouseMove);
  pianoState.canvas.addEventListener('mouseup', handlePianoMouseUp);
  pianoState.canvas.addEventListener('mouseleave', handlePianoMouseUp);
  pianoState.canvas.addEventListener('touchstart', handlePianoTouchStart, {passive: false});
  pianoState.canvas.addEventListener('touchmove', handlePianoTouchMove, {passive: false});
  pianoState.canvas.addEventListener('touchend', handlePianoTouchEnd);
  
  pianoState.isMouseDown = false;
}

// Resize the piano canvas to match the grid height and handle HiDPI
function resizePiano() {
  // If canvas not yet created, we cannot set its size; just compute logical dimensions for later use
  if (!pianoState.canvas) {
    // Still compute logical dimensions based on container height (if available)
    const container = document.querySelector('.grid-area');
    if (container) {
      pianoState.logicalHeight = container.clientHeight;
      pianoState.logicalWidth = 72; // fixed width in logical pixels (as per requirement)
      // Calculate key dimensions (will be used later when canvas exists)
      if (window.state) {
        pianoState.keyHeight = pianoState.logicalHeight / window.state.ROWS; // same as grid row height
        pianoState.keyWidth = pianoState.logicalWidth;
      }
    }
    return;
  }
  
  const container = document.querySelector('.grid-area');
  if (!container) return;
  
  // The piano should be as tall as the grid area
  const containerHeight = container.clientHeight;
  pianoState.logicalHeight = containerHeight;
  pianoState.logicalWidth = 72; // fixed width in logical pixels (as per requirement)
  
  // Set the canvas size in device pixels
  pianoState.canvas.width = pianoState.logicalWidth * window.devicePixelRatio;
  pianoState.canvas.height = pianoState.logicalHeight * window.devicePixelRatio;
  
  // Set the CSS size
  pianoState.canvas.style.width = pianoState.logicalWidth + 'px';
  pianoState.canvas.style.height = pianoState.logicalHeight + 'px';
  
  // Set the transform to scale by devicePixelRatio
  pianoState.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  
  // Calculate key dimensions
  pianoState.keyHeight = pianoState.logicalHeight / window.state.ROWS; // same as grid row height
  pianoState.keyWidth = pianoState.logicalWidth;
  
  drawPiano();
}

// Draw the piano keyboard
function drawPiano() {
  // Ensure sequencer is initialized and canvas exists
  if (!window.state || !pianoState.canvas) return;
  
  const ctx = pianoState.ctx;
  const width = pianoState.logicalWidth;
  const height = pianoState.logicalHeight;
  
  // Clear background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);
  
  // First, draw all white keys (full width)
  for (let row = 0; row < window.state.ROWS; row++) {
    const y = row * pianoState.keyHeight;
    if (window.state.isBlackKey[row]) {
      // Black key row: draw white key underneath
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    } else {
      // White key row: draw white key
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    }
  }
  
  // Draw note names on white keys (right aligned, with padding)
  ctx.fillStyle = '#5f6368';
  ctx.font = '12px Roboto';
  ctx.textAlign = 'right';
  for (let row = 0; row < window.state.ROWS; row++) {
    if (!window.state.isBlackKey[row]) {
      const y = row * pianoState.keyHeight;
      const noteName = window.state.noteNames[row];
      // Make C notes bold and dark
      if (noteName.startsWith('C')) {
        ctx.fillStyle = '#202124';
        ctx.font = 'bold 12px Roboto';
      } else {
        ctx.fillStyle = '#5f6368';
        ctx.font = '12px Roboto';
      }
      ctx.fillText(noteName, pianoState.keyWidth - 4, y + pianoState.keyHeight * 0.7);
      // Reset font
      ctx.font = '12px Roboto';
    }
  }
  
  // Draw black keys on top
  for (let row = 0; row < window.state.ROWS; row++) {
    if (window.state.isBlackKey[row]) {
      const y = row * pianoState.keyHeight;
      const blackKeyWidth = pianoState.keyWidth * pianoState.blackKeyWidthRatio;
      const blackKeyHeight = pianoState.keyHeight * pianoState.blackKeyHeightRatio;
      // Center the black key horizontally
      const x = (pianoState.keyWidth - blackKeyWidth) / 2;
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, blackKeyWidth, blackKeyHeight);
    }
  }
}

// Flash a piano key (highlight it blue for a duration)
function flashPianoKey(row, delayMs, durationMs) {
  // Ensure sequencer is initialized
  if (!window.state) return;
  
  // Use setTimeout to delay the flash, then draw the highlight and remove it after duration
  setTimeout(() => {
    if (!pianoState.canvas) return;
    
    const y = row * pianoState.keyHeight;
    const highlightColor = window.state.isBlackKey[row] ? 'rgba(26, 115, 232, 0.8)' : 'rgba(138, 180, 248, 0.8)';
    
    // Save current state
    pianoState.ctx.save();
    
    // Draw the highlight rectangle over the key
    pianoState.ctx.fillStyle = highlightColor;
    if (window.state.isBlackKey[row]) {
      const blackKeyWidth = pianoState.keyWidth * pianoState.blackKeyWidthRatio;
      const blackKeyHeight = pianoState.keyHeight * pianoState.blackKeyHeightRatio;
      const x = (pianoState.keyWidth - blackKeyWidth) / 2;
      pianoState.ctx.fillRect(x, y, blackKeyWidth, blackKeyHeight);
    } else {
      pianoState.ctx.fillRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    }
    
    // Restore state
    pianoState.ctx.restore();
    
    // After durationMs, we need to redraw the key normally (by redrawing the whole piano)
    // However, to avoid flicker, we can just redraw the key part.
    // For simplicity, we'll redraw the whole piano after a short delay.
    // But note: this might cause performance issues if many notes are flashing.
    // We'll instead store the flash state and redraw in the drawPiano function? 
    // Alternatively, we can draw the highlight on top and then clear it after duration by redrawing the key.
    // We'll do: after durationMs, redraw the key (without highlight) by redrawing that row's key.
    setTimeout(() => {
      redrawPianoKey(row);
    }, durationMs);
  }, delayMs);
}

// Redraw a single piano key (used to remove highlight)
function redrawPianoKey(row) {
  if (!pianoState.canvas) return;
  
  const ctx = pianoState.ctx;
  const y = row * pianoState.keyHeight;
  
  // Clear the key area
  ctx.clearRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
  
  // Redraw the key as it should be (white or black key background)
  if (window.state.isBlackKey[row]) {
    // Draw white key background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    // Draw black key on top
    const blackKeyWidth = pianoState.keyWidth * pianoState.blackKeyWidthRatio;
    const blackKeyHeight = pianoState.keyHeight * pianoState.blackKeyHeightRatio;
    const x = (pianoState.keyWidth - blackKeyWidth) / 2;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, blackKeyWidth, blackKeyHeight);
    // Draw note name (if white key? but this is a black key row, so no name on the key itself)
    // Note names are drawn separately in drawPiano, so we need to redraw them too? 
    // To avoid complexity, we'll just redraw the whole piano when needed? 
    // But we are only redrawing one key to remove highlight, and the note names are drawn on white keys only.
    // For a black key row, there is no note name on the key, so we are safe.
    // For a white key row, we need to redraw the note name.
    if (!window.state.isBlackKey[row]) {
      ctx.fillStyle = window.state.noteNames[row].startsWith('C') ? '#202124' : '#5f6368';
      ctx.font = window.state.noteNames[row].startsWith('C') ? 'bold 12px Roboto' : '12px Roboto';
      ctx.textAlign = 'right';
      ctx.fillText(window.state.noteNames[row], pianoState.keyWidth - 4, y + pianoState.keyHeight * 0.7);
      ctx.font = '12px Roboto';
    }
  } else {
    // White key row
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, pianoState.keyWidth, pianoState.keyHeight);
    // Draw note name
    ctx.fillStyle = window.state.noteNames[row].startsWith('C') ? '#202124' : '#5f6368';
    ctx.font = window.state.noteNames[row].startsWith('C') ? 'bold 12px Roboto' : '12px Roboto';
    ctx.textAlign = 'right';
    ctx.fillText(window.state.noteNames[row], pianoState.keyWidth - 4, y + pianoState.keyHeight * 0.7);
    ctx.font = '12px Roboto';
  }
}

// Handle piano mouse down
function handlePianoMouseDown(e) {
  if (!window.state) return;
  const pos = getMousePos(pianoState.canvas, e);
  const row = Math.floor(pos.y / pianoState.keyHeight);
  if (row >= 0 && row < window.state.ROWS) {
    playPianoKey(row);
    pianoState.isMouseDown = true;
    pianoState.lastHoveredRow = row;
  }
}

// Handle piano mouse move
function handlePianoMouseMove(e) {
  if (!pianoState.isMouseDown || !window.state) return;
  const pos = getMousePos(pianoState.canvas, e);
  const row = Math.floor(pos.y / pianoState.keyHeight);
  if (row >= 0 && row < window.state.ROWS && row !== pianoState.lastHoveredRow) {
    playPianoKey(row);
    pianoState.lastHoveredRow = row;
  }
}

// Handle piano mouse up
function handlePianoMouseUp() {
  pianoState.isMouseDown = false;
  pianoState.lastHoveredRow = -1;
}

// Handle piano touch start
function handlePianoTouchStart(e) {
  e.preventDefault();
  if (!window.state) return;
  const pos = getTouchPos(pianoState.canvas, e);
  const row = Math.floor(pos.y / pianoState.keyHeight);
  if (row >= 0 && row < window.state.ROWS) {
    playPianoKey(row);
    pianoState.isMouseDown = true;
    pianoState.lastHoveredRow = row;
  }
}

// Handle piano touch move
function handlePianoTouchMove(e) {
  e.preventDefault();
  if (!pianoState.isMouseDown || !window.state) return;
  const pos = getTouchPos(pianoState.canvas, e);
  const row = Math.floor(pos.y / pianoState.keyHeight);
  if (row >= 0 && row < window.state.ROWS && row !== pianoState.lastHoveredRow) {
    playPianoKey(row);
    pianoState.lastHoveredRow = row;
  }
}

// Handle piano touch end
function handlePianoTouchEnd() {
  pianoState.isMouseDown = false;
  pianoState.lastHoveredRow = -1;
}

// Play a note on the piano key (preview) and toggle grid cell at current step
function playPianoKey(row) {
  if (!window.state) return;
  
  // Resume audio context if needed
  resumeAudioContext().then(() => {
    const frequency = window.state.frequencies[row];
    // Use a fixed duration of 0.3s for preview
    const duration = 0.3;
    // Use current waveform and ADSR values from the UI
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
    // Toggle grid cell at current step (sequencer state is guaranteed to exist after initSequencer)
    window.state.grid[row][window.state.currentStep] = !window.state.grid[row][window.state.currentStep];
    window.drawGrid();
    
    // Step recording: advance to the next step so the next note goes to the next column
    // Only advance if the sequencer is not currently playing (to avoid interfering with playback)
    if (!window.state.isPlaying) {
      window.state.currentStep = (window.state.currentStep + 1) % window.state.COLS;
      window.drawGrid();
    }
  });
}

// Get mouse position relative to piano canvas
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

// Get touch position relative to piano canvas
function getTouchPos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const touch = evt.touches[0];
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

// Expose functions
window.initPiano = initPiano;
window.drawPiano = drawPiano;
window.flashPianoKey = flashPianoKey;
window.resizePiano = resizePiano;

// Initialize on load (but we'll call it from main.js after DOM is ready)
// We'll not auto-init here to avoid errors if DOM isn't ready.
// Instead, we'll call initPiano from main.js.
// However, to be safe, we can check if DOM is ready.
// We'll leave it to main.js to call initPiano.
