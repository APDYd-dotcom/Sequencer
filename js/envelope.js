// envelope.js - Handles ADSR envelope parameters and drawing
let envelope = {
  attack: 0.1,   // seconds
  decay: 0.1,    // seconds
  sustain: 0.5,  // 0 to 1
  release: 0.2   // seconds
};

// Update envelope parameter from slider
function setEnvelopeParam(param, value) {
  envelope[param] = parseFloat(value);
  // Redraw the envelope canvas
  drawEnvelope();
}

// Draw the ADSR envelope on the given canvas
function drawEnvelope() {
  const canvas = document.getElementById('envelopeCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio;

  // Size the canvas from its CSS (client) size * devicePixelRatio so it is
  // crisp and not stretched/distorted by CSS.
  const cssWidth = canvas.clientWidth || 120;
  const cssHeight = canvas.clientHeight || 100;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw light grid (optional)
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = (i / 4) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw ADSR curve
  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const { attack, decay, sustain, release } = envelope;
  // For visualization, we'll assume a gate duration of 1 second (so sustain stage lasts from end of decay to 1 second)
  const gateDuration = 1.0; // seconds
  const totalTime = attack + decay + gateDuration + release; // total time from start to end of release

  // Create points for the envelope
  const points = [
    { t: 0, g: 0 },                                       // start
    { t: attack, g: 1 },                                  // end of attack
    { t: attack + decay, g: sustain },                    // end of decay
    { t: attack + decay + gateDuration, g: sustain },     // end of gate (start of release)
    { t: attack + decay + gateDuration + release, g: 0 }  // end of release
  ];

  // Convert to canvas coordinates
  const scaleX = width / totalTime;
  const scaleY = height; // gain from 0 to 1 -> y from height to 0

  ctx.moveTo(points[0].t * scaleX, height - points[0].g * scaleY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].t * scaleX, height - points[i].g * scaleY);
  }
  ctx.stroke();

  // Draw labels A, D, S, R
  ctx.fillStyle = '#5f6368';
  ctx.font = '10px Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';
  // A label at the end of attack
  ctx.fillText('A', (attack * scaleX) / 2, height - 10);
  // D label at the middle of decay
  ctx.fillText('D', (attack + decay/2) * scaleX, height - 10);
  // S label at the middle of sustain (gate duration)
  ctx.fillText('S', (attack + decay + gateDuration/2) * scaleX, height - 10);
  // R label at the middle of release
  ctx.fillText('R', (attack + decay + gateDuration + release/2) * scaleX, height - 10);
}

// Initialize: set up sliders and draw initial envelope
function initEnvelope() {
  // Attack slider
  const attackSlider = document.getElementById('attackSlider');
  const attackValue = document.getElementById('attackValue');
  if (attackSlider && attackValue) {
    attackSlider.addEventListener('input', () => {
      const val = attackSlider.value;
      attackValue.textContent = val;
      setEnvelopeParam('attack', val);
    });
    attackValue.textContent = attackSlider.value;
  }

  // Decay slider
  const decaySlider = document.getElementById('decaySlider');
  const decayValue = document.getElementById('decayValue');
  if (decaySlider && decayValue) {
    decaySlider.addEventListener('input', () => {
      const val = decaySlider.value;
      decayValue.textContent = val;
      setEnvelopeParam('decay', val);
    });
    decayValue.textContent = decaySlider.value;
  }

  // Sustain slider
  const sustainSlider = document.getElementById('sustainSlider');
  const sustainValue = document.getElementById('sustainValue');
  if (sustainSlider && sustainValue) {
    sustainSlider.addEventListener('input', () => {
      const val = sustainSlider.value;
      sustainValue.textContent = val;
      setEnvelopeParam('sustain', val);
    });
    sustainValue.textContent = sustainSlider.value;
  }

  // Release slider
  const releaseSlider = document.getElementById('releaseSlider');
  const releaseValue = document.getElementById('releaseValue');
  if (releaseSlider && releaseValue) {
    releaseSlider.addEventListener('input', () => {
      const val = releaseSlider.value;
      releaseValue.textContent = val;
      setEnvelopeParam('release', val);
    });
    releaseValue.textContent = releaseSlider.value;
  }

  // Draw initial envelope
  drawEnvelope();

  // Redraw when the dock / panel resizes (collapse, sidebar, rotation)
  const canvas = document.getElementById('envelopeCanvas');
  if (canvas && canvas.parentElement) {
    const ro = new ResizeObserver(() => drawEnvelope());
    ro.observe(canvas.parentElement);
  }
}
