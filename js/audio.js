// audio.js - Handles Web Audio API setup and note playback
let audioContext = null;
let masterGain = null;

// Initialize the audio context and master gain
function initAudio() {
  // Create audio context if it doesn't exist
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Create master gain node
  masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);
  // Set default volume (0.8)
  masterGain.gain.value = 0.8;
}

// Play a note with given parameters
// frequency: note frequency in Hz
// startTime: when to start the note (in audio context time)
// duration: how long the note should last (gate time, in seconds)
// waveform: type of oscillator ('sine', 'square', 'sawtooth', 'triangle')
// envelope: object with attack, decay, sustain, release (in seconds)
function playNote(frequency, startTime, duration, waveform, envelope) {
  // Create oscillator
  const oscillator = audioContext.createOscillator();
  oscillator.type = waveform;
  oscillator.frequency.value = frequency;

  // Create gain node for this note (to apply envelope)
  const noteGain = audioContext.createGain();
  
  // Connect oscillator to gain, gain to master
  oscillator.connect(noteGain);
  noteGain.connect(masterGain);

  // Apply ADSR envelope correctly for any gate duration
  const { attack, decay, sustain, release } = envelope;
  const now = startTime;
  const gateTime = duration;

  // Attack: 0 -> 1
  noteGain.gain.cancelScheduledValues(now);
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(1, now + attack);

  // Decay: 1 -> sustain
  noteGain.gain.linearRampToValueAtTime(sustain, now + attack + decay);

  // Compute the value at the end of the gate if we were to follow attack+decay only
  let valueAtGateEnd = sustain;
  if (gateTime < attack + decay) {
    // During attack or decay
    if (gateTime <= attack) {
      // Still in attack phase
      valueAtGateEnd = gateTime / attack; // linear from 0 to 1
    } else {
      // In decay phase
      const decayProgress = (gateTime - attack) / decay;
      valueAtGateEnd = 1 - decayProgress * (1 - sustain); // from 1 to sustain
    }
  }
  // Set the value at the end of the gate to valueAtGateEnd
  noteGain.gain.setValueAtTime(valueAtGateEnd, now + gateTime);
  // Release: valueAtGateEnd -> 0
  noteGain.gain.linearRampToValueAtTime(0, now + gateTime + release);

  // Start the oscillator
  oscillator.start(now);
  // Stop the oscillator after the note (including release) ends
  oscillator.stop(now + gateTime + release);
}

// Set master volume
function setMasterVolume(volume) {
  if (masterGain) {
    masterGain.gain.value = volume;
  }
}

// Resume audio context (for autoplay policy)
function resumeAudioContext() {
  if (audioContext) {
    return audioContext.resume();
  }
  return Promise.resolve();
}
