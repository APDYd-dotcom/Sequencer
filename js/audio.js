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

  // Apply ADSR envelope
  const { attack, decay, sustain, release } = envelope;
  const now = startTime;

  // Attack: 0 -> 1
  noteGain.gain.cancelScheduledValues(now);
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(1, now + attack);

  // Decay: 1 -> sustain
  noteGain.gain.linearRampToValueAtTime(sustain, now + attack + decay);

  // Sustain: hold until note end (gate duration)
  // Set sustain value to be held until release starts
  noteGain.gain.setValueAtTime(sustain, now + duration);

  // Release: sustain -> 0
  noteGain.gain.linearRampToValueAtTime(0, now + duration + release);

  // Start the oscillator
  oscillator.start(now);
  // Stop the oscillator after the note (including release) ends
  oscillator.stop(now + duration + release);
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
