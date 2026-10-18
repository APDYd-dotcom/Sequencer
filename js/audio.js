// audio.js - Handles Web Audio API setup and note playback
let audioContext = null;
let masterGain = null;
let masterBus = null;
let compressor = null;
let limiter = null;
let convolver = null;

// makeAdditiveInstrument: turns a TIMBRES entry into an INSTRUMENTS entry
function makeAdditiveInstrument(name, def) {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    label: label,
    family: def.family,
    preset: def.preset,
    level: def.level,
    reverb: def.reverb,
    build: (f, t, end, out) => {
      const gain = audioContext.createGain();
      gain.gain.value = def.level;
      gain.connect(out);
      
      // Tremolo LFO on gain (if defined)
      if (def.tremolo) {
        const lfo = audioContext.createOscillator();
        lfo.frequency.value = def.tremolo.rate;
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = def.tremolo.depth * 0.5; // depth 0..1 around current level
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(t);
        lfo.stop(end);
      }
      
      // Filter for cutoff/sweep
      let filter = null;
      if (def.cutoff) {
        filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = def.cutoff;
        filter.Q.value = 1;
        filter.connect(gain);
      }
      
      // Sweep
      if (def.sweep) {
        const sweepStart = def.sweep.start || def.cutoff;
        const sweepEnd = def.sweep.end || def.cutoff;
        const tau = def.sweep.tau || 0.3;
        if (filter) {
          filter.frequency.setValueAtTime(sweepStart, t);
          filter.frequency.exponentialRampToValueAtTime(sweepEnd, t + tau);
        }
      }
      
      // Create oscillators for each harmonic and detune
      const detunes = def.detunes || [0];
      const harmonics = def.harmonics || [1.0];
      
      detunes.forEach(detuneCents => {
        harmonics.forEach((loudness, harmonicIndex) => {
          if (loudness <= 0) return;
          const osc = audioContext.createOscillator();
          osc.type = 'sine';
          const harmonicFreq = f * (harmonicIndex + 1);
          osc.frequency.value = harmonicFreq;
          // Apply detune
          osc.detune.value = detuneCents;
          
          // Vibrato LFO
          if (def.vibrato) {
            const vibLfo = audioContext.createOscillator();
            vibLfo.frequency.value = def.vibrato.rate;
            const vibGain = audioContext.createGain();
            vibGain.gain.value = def.vibrato.depth * harmonicFreq;
            vibLfo.connect(vibGain);
            vibGain.connect(osc.frequency);
            vibLfo.start(t);
            vibLfo.stop(end);
          }
          
          // Breath noise (optional)
          if (def.breath && def.breath > 0) {
            const noise = audioContext.createBufferSource();
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = (Math.random() * 2 - 1) * 0.1;
            }
            noise.buffer = buffer;
            const noiseFilter = audioContext.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.value = 1000;
            const noiseGain = audioContext.createGain();
            noiseGain.gain.value = def.breath * loudness;
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(gain);
            noise.start(t);
            noise.stop(end);
          }
          
          // Hammer click (optional) - simple transient
          if (def.hammer && def.hammer > 0) {
            const click = audioContext.createOscillator();
            click.type = 'square';
            click.frequency.value = 2000;
            const clickGain = audioContext.createGain();
            clickGain.gain.setValueAtTime(def.hammer, t);
            clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            click.connect(clickGain);
            clickGain.connect(gain);
            click.start(t);
            click.stop(t + 0.05);
          }
          
          // Connect oscillator to filter or gain
          const oscGain = audioContext.createGain();
          oscGain.gain.value = loudness;
          osc.connect(oscGain);
          if (filter) {
            oscGain.connect(filter);
          } else {
            oscGain.connect(gain);
          }
          osc.start(t);
          osc.stop(end);
        });
      });
      
      return gain;
    }
  };
}

// INSTRUMENTS object
const INSTRUMENTS = {};

// Build INSTRUMENTS from TIMBRES
if (window.TIMBRES) {
  for (const [name, def] of Object.entries(window.TIMBRES)) {
    INSTRUMENTS[name] = makeAdditiveInstrument(name, def);
  }
}

// Custom instruments
INSTRUMENTS.epiano = {
  label: 'Electric Piano',
  family: 'Keyboards',
  preset: { attack: 0.01, decay: 0.5, sustain: 0.6, release: 0.8 },
  level: 0.7,
  reverb: 0.3,
  build: (f, t, end, out) => {
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const chorusGain = audioContext.createGain();
    chorusGain.gain.value = 0.5;
    const delay1 = audioContext.createDelay();
    delay1.delayTime.value = 0.02;
    const delay2 = audioContext.createDelay();
    delay2.delayTime.value = 0.03;
    const lfo = audioContext.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 0.005;
    lfo.connect(lfoGain);
    lfoGain.connect(delay1.delayTime);
    lfoGain.connect(delay2.delayTime);
    lfo.start(t);
    lfo.stop(end);
    osc.connect(delay1);
    osc.connect(delay2);
    delay1.connect(chorusGain);
    delay2.connect(chorusGain);
    chorusGain.connect(out);
    osc.start(t);
    osc.stop(end);
    return osc;
  }
};

INSTRUMENTS.strings = {
  label: 'Strings',
  family: 'Strings',
  preset: { attack: 0.3, decay: 0.5, sustain: 0.7, release: 1.2 },
  level: 0.5,
  reverb: 0.5,
  build: (f, t, end, out) => {
    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    osc.connect(filter);
    filter.connect(out);
    osc.start(t);
    osc.stop(end);
    return osc;
  }
};

INSTRUMENTS.marimba = {
  label: 'Marimba',
  family: 'Mallets',
  preset: { attack: 0.01, decay: 0.3, sustain: 0.0, release: 0.2 },
  level: 0.7,
  reverb: 0.1,
  build: (f, t, end, out) => {
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const gain = audioContext.createGain();
    gain.gain.value = 0.8;
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(end);
    return osc;
  }
};

// Piano (synth) - keep as a custom instrument too
INSTRUMENTS.piano = {
  label: 'Grand Piano (Synth)',
  family: 'Keyboards',
  preset: { attack: 0.01, decay: 0.8, sustain: 0.4, release: 0.9 },
  level: 0.8,
  reverb: 0.25,
  build: (f, t, end, out) => {
    const osc = audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;
    osc.connect(filter);
    filter.connect(out);
    osc.start(t);
    osc.stop(end);
    return osc;
  }
};

// Initialize the audio context and master gain
function initAudio() {
  // Create audio context if it doesn't exist
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Create master bus
  masterBus = audioContext.createGain();
  masterBus.gain.value = 1.0;
  // Compressor
  compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  // Limiter
  limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  // Master gain
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.8;
  // Connect chain: masterBus -> compressor -> limiter -> masterGain -> destination
  masterBus.connect(compressor);
  compressor.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(audioContext.destination);
  // Reverb convolver
  convolver = audioContext.createConvolver();
  // Create a simple impulse response (short reverb)
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * 0.5; // 0.5 seconds
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  convolver.buffer = impulse;
  // Connect convolver to masterGain
  convolver.connect(masterGain);
  // Expose audio nodes globally for offline export
  window.audioContext = audioContext;
  window.masterBus = masterBus;
  window.masterGain = masterGain;
  window.compressor = compressor;
  window.limiter = limiter;
  window.convolver = convolver;
}

// Apply ADSR envelope to a gain node
function applyADSR(gainNode, startTime, duration, envelope) {
  const { attack, decay, sustain, release } = envelope;
  const now = startTime;
  const gateTime = duration;
  const releaseTime = release || 0;
  const end = now + gateTime + releaseTime;
  
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(1, now + attack);
  gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
  
  // Compute value at gate end if gateTime < attack+decay
  let valueAtGateEnd = sustain;
  if (gateTime < attack + decay) {
    if (gateTime <= attack) {
      valueAtGateEnd = gateTime / attack;
    } else {
      const decayProgress = (gateTime - attack) / decay;
      valueAtGateEnd = 1 - decayProgress * (1 - sustain);
    }
  }
  gainNode.gain.setValueAtTime(valueAtGateEnd, now + gateTime);
  gainNode.gain.linearRampToValueAtTime(0, end);
}

// Play a note with given parameters
// frequency: note frequency in Hz
// startTime: when to start the note (in audio context time)
// duration: how long the note should last (gate time, in seconds)
// timbre: key in INSTRUMENTS or basic wave name
// envelope: object with attack, decay, sustain, release (in seconds)
function playNote(frequency, startTime, duration, timbre, envelope) {
  // Create gain node for this note (to apply envelope) - this is the voice gain 'out'
  const noteGain = audioContext.createGain();
  noteGain.connect(masterBus);
  // Reverb send for this voice
  const reverbGain = audioContext.createGain();
  const instrument = INSTRUMENTS[timbre];
  const reverbAmount = instrument ? instrument.reverb : 0.2;
  reverbGain.gain.value = reverbAmount;
  noteGain.connect(reverbGain);
  reverbGain.connect(convolver);
  
  // Compute end time (including release)
  const releaseTime = envelope.release || 0;
  const end = startTime + duration + releaseTime;
  
  // Build the instrument (connects to noteGain)
  if (instrument && instrument.build) {
    instrument.build(frequency, startTime, end, noteGain);
  } else {
    // Basic wave fallback
    const osc = audioContext.createOscillator();
    osc.type = timbre || 'sine';
    osc.frequency.value = frequency;
    osc.connect(noteGain);
    osc.start(startTime);
    osc.stop(end);
  }
  
  // Apply ADSR envelope to noteGain
  applyADSR(noteGain, startTime, duration, envelope);
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

// Expose INSTRUMENTS and functions
window.INSTRUMENTS = INSTRUMENTS;
window.playNote = playNote;
window.applyADSR = applyADSR;
window.setMasterVolume = setMasterVolume;
window.resumeAudioContext = resumeAudioContext;
window.initAudio = initAudio;
window.getAudioContext = () => audioContext;
window.setAudioContext = (ctx) => { audioContext = ctx; };
window.makeAdditiveInstrument = makeAdditiveInstrument;
EOF