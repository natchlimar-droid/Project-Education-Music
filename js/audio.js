/**
 * ============================================================================
 * js/audio.js — Pure Web Audio API Thai Instrument Synthesizer & Clock
 * ============================================================================
 * - Single source of truth for rhythm timing via `audioCtx.currentTime`.
 * - Built-in synthesized Ranat Ek (wooden percussive bar) & Ching/Chab
 *   (metallic Thai bronze cymbals) so the app works immediately out-of-the-box.
 * - Includes an `AudioBuffer` cache (`loadSample`) ready to swap in real
 *   `.wav` / `.mp3` Thai instrument recordings later with zero refactor.
 */

export class ThaiAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;

    // Optional external AudioBuffer overrides (e.g., 'ranat-D', 'ching', 'chab')
    this.sampleBuffers = new Map();

    // Track currently ringing Ching voices so a subsequent "Chab" dampens them
    this.activeChingVoices = [];
  }

  /**
   * Initializes or resumes the AudioContext.
   * MUST be called inside a user gesture handler (e.g., "Start & Enable Camera").
   */
  async init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      // Gentle dynamics compressor prevents clipping during two-hand chords (ตีคู่)
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer(0.25);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Authoritative hardware audio clock (in seconds).
   */
  getCurrentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /**
   * Returns the estimated audio time currently emerging from the speakers/headphones,
   * accounting for `getOutputTimestamp()` and `outputLatency` (crucial for Bluetooth).
   */
  getOutputClockTime() {
    if (!this.ctx) return 0;
    try {
      if (typeof this.ctx.getOutputTimestamp === 'function') {
        const ts = this.ctx.getOutputTimestamp();
        if (ts && Number.isFinite(ts.contextTime) && ts.contextTime > 0) {
          const perfDeltaSec = (performance.now() - ts.performanceTime) / 1000;
          return ts.contextTime + Math.max(0, Math.min(0.1, perfDeltaSec));
        }
      }
      const latency = Number(this.ctx.outputLatency || this.ctx.baseLatency || 0);
      return Math.max(0, this.ctx.currentTime - latency);
    } catch {
      return this.ctx.currentTime;
    }
  }

  /**
   * Optional future hook: load a real `.wav` or `.mp3` sample into memory.
   * Example: await audio.loadSample('ching', './assets/samples/ching.wav');
   */
  async loadSample(name, url) {
    await this.init();
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.sampleBuffers.set(name, audioBuffer);
  }

  /**
   * Plays an AudioBuffer if one was loaded for `name`. Returns true if played.
   */
  _playSampleIfAvailable(name, when = 0, gainLevel = 0.9) {
    const buffer = this.sampleBuffers.get(name);
    if (!buffer || !this.ctx) return false;

    const now = when || this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, now);

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    return true;
  }

  /**
   * Generates a reusable white noise buffer for mallet clicks & cymbal bursts.
   */
  _createNoiseBuffer(durationSec) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Synthesizes a Thai Ranat Ek (ระนาดเอก) hardwood xylophone bar strike.
   * Combines:
   *  1. Warm fundamental tone (sine + subtle triangle)
   *  2. Characteristic hardwood bar overtone (~2.76x fundamental)
   *  3. Crisp bamboo mallet impact transient (filtered noise burst)
   */
  playRanat(freq = 523.25, keyId = '', velocity = 1.0) {
    if (!this.ctx) return;
    if (keyId && this._playSampleIfAvailable(`ranat-${keyId}`, 0, 0.85 * velocity)) {
      return;
    }

    const now = this.ctx.currentTime;
    const vol = Math.min(1, Math.max(0.3, velocity));

    // 1. Primary hardwood resonance (fundamental)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.46 * vol, now + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // 2. Warm wooden body harmonic (triangle at 2x fundamental, subtle)
    const oscBody = this.ctx.createOscillator();
    const gainBody = this.ctx.createGain();
    oscBody.type = 'triangle';
    oscBody.frequency.setValueAtTime(freq * 2, now);

    gainBody.gain.setValueAtTime(0.0001, now);
    gainBody.gain.linearRampToValueAtTime(0.11 * vol, now + 0.003);
    gainBody.gain.exponentialRampToValueAtTime(0.0005, now + 0.14);

    oscBody.connect(gainBody);
    gainBody.connect(this.masterGain);
    oscBody.start(now);
    oscBody.stop(now + 0.16);

    // 3. Characteristic xylophone bar overtone (~2.76x fundamental, fast decay)
    const oscOvertone = this.ctx.createOscillator();
    const gainOvertone = this.ctx.createGain();
    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(freq * 2.76, now);

    gainOvertone.gain.setValueAtTime(0.0001, now);
    gainOvertone.gain.linearRampToValueAtTime(0.18 * vol, now + 0.002);
    gainOvertone.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);

    oscOvertone.connect(gainOvertone);
    gainOvertone.connect(this.masterGain);
    oscOvertone.start(now);
    oscOvertone.stop(now + 0.11);

    // 4. Mallet strike click transient (bandpass noise burst)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.min(4200, freq * 3.5), now);
      filter.Q.setValueAtTime(2.5, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.28 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.03);
    }
  }

  /**
   * Synthesizes Thai Ching — Open Ringing Sound ("ฉิ่ง").
   * Bright bronze cymbal shimmer using inharmonic metallic partials with long decay.
   */
  playChing() {
    if (!this.ctx) return;
    if (this._playSampleIfAvailable('ching', 0, 0.9)) return;

    const now = this.ctx.currentTime;
    const baseFreq = 2580; // Bright Thai bronze cymbal fundamental
    const partials = [
      { ratio: 1.0, amp: 0.24, decay: 1.65 },
      { ratio: 1.007, amp: 0.18, decay: 1.55 }, // Slight detune creates authentic shimmering beat
      { ratio: 2.31, amp: 0.14, decay: 1.15 },
      { ratio: 3.74, amp: 0.09, decay: 0.75 },
      { ratio: 5.18, amp: 0.05, decay: 0.45 },
    ];

    const voiceGroupGain = this.ctx.createGain();
    voiceGroupGain.gain.setValueAtTime(1.0, now);
    voiceGroupGain.connect(this.masterGain);

    const oscList = [];
    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * p.ratio, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(p.amp, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0004, now + p.decay);

      osc.connect(g);
      g.connect(voiceGroupGain);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
      oscList.push(osc);
    }

    // Crisp bronze contact ping
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(5000, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.035);

      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(voiceGroupGain);
      noise.start(now);
      noise.stop(now + 0.045);
    }

    // Register voice so a subsequent "Chab" can dampen it naturally
    const voice = { gainNode: voiceGroupGain, endTime: now + 1.75 };
    this.activeChingVoices.push(voice);
    this.activeChingVoices = this.activeChingVoices.filter((v) => v.endTime > now);
  }

  /**
   * Synthesizes Thai Ching — Dampened Sound ("ฉับ").
   * Immediately chokes any ringing "Ching" tail, then emits a tight metallic snap.
   */
  playChab() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Choke/dampen any currently ringing "Ching" voices
    for (const voice of this.activeChingVoices) {
      try {
        voice.gainNode.gain.cancelScheduledValues(now);
        voice.gainNode.gain.setValueAtTime(Math.max(0.001, voice.gainNode.gain.value), now);
        voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      } catch {
        // Ignore already-finished nodes
      }
    }
    this.activeChingVoices = [];

    if (this._playSampleIfAvailable('chab', 0, 0.95)) return;

    // 2. Dampened metallic burst (short, crisp "Chab!")
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3400, now);
      bp.Q.setValueAtTime(1.4, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.55, now);
      nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.095);
    }

    // 3. Short muted bronze partials
    const mutedFreqs = [1820, 2940, 4410];
    for (const f of mutedFreqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.065);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.075);
    }
  }

  /**
   * Synthesizes Thai Taphon / Klong (ตะโพน / กลองไทย) membrane & rim hits.
   * Distinguishes center drumhead ('thum' deep bass, 'pa' crisp slap) vs
   * drum rims ('ting' bright rim, 'ja' muted rim tap).
   */
  playTaphon(zoneId = 'thum', velocity = 0.9) {
    if (!this.ctx) return;
    if (this._playSampleIfAvailable(`taphon-${zoneId}`, 0, 0.9 * velocity)) return;

    const now = this.ctx.currentTime;
    const vol = Math.min(1, Math.max(0.35, velocity));

    const presets = {
      thum: { startHz: 165, endHz: 86, decay: 0.36, wave: 'sine', noiseHz: 420, noiseAmp: 0.16, noiseDur: 0.045 },
      pa:   { startHz: 340, endHz: 205, decay: 0.22, wave: 'triangle', noiseHz: 1850, noiseAmp: 0.32, noiseDur: 0.04 },
      ting: { startHz: 540, endHz: 430, decay: 0.18, wave: 'triangle', noiseHz: 2800, noiseAmp: 0.28, noiseDur: 0.03 },
      ja:   { startHz: 410, endHz: 290, decay: 0.095, wave: 'sine', noiseHz: 2300, noiseAmp: 0.34, noiseDur: 0.035 },
    };
    const p = presets[zoneId] || presets.thum;

    // Drum membrane / rim body oscillator with pitch-drop envelope
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.wave;
    osc.frequency.setValueAtTime(p.startHz, now);
    osc.frequency.exponentialRampToValueAtTime(p.endHz, now + p.decay * 0.65);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.55 * vol, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + p.decay);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + p.decay + 0.03);

    // Palm / rim impact transient
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(p.noiseHz, now);
      bp.Q.setValueAtTime(1.6, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(p.noiseAmp * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + p.noiseDur);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + p.noiseDur + 0.02);
    }
  }

  /**
   * Synthesizes Thai Khlui Phiang Or (ขลุ่ยเพียงออ — Bamboo Flute).
   * Combines warm oscillator + gentle LFO vibrato + bandpass-filtered breath air noise.
   */
  playKhlui(freq = 523.25, durationSec = 0.48) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = Math.max(0.25, durationSec);

    // 1. Main flute tone (sine + soft triangle overtone)
    const oscMain = this.ctx.createOscillator();
    const oscHarm = this.ctx.createOscillator();
    const mainGain = this.ctx.createGain();
    const harmGain = this.ctx.createGain();

    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(freq, now);
    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(freq * 2, now);

    // 2. Gentle LFO vibrato (~5.4 Hz) for expressive Thai flute character
    const lfo = this.ctx.createOscillator();
    const lfoDepth = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.4, now);
    lfoDepth.gain.setValueAtTime(freq * 0.008, now);
    lfo.connect(lfoDepth);
    lfoDepth.connect(oscMain.frequency);
    lfoDepth.connect(oscHarm.frequency);

    // Soft breathy envelope (45ms attack, sustain, gentle release)
    mainGain.gain.setValueAtTime(0.0001, now);
    mainGain.gain.linearRampToValueAtTime(0.32, now + 0.045);
    mainGain.gain.setValueAtTime(0.28, now + dur * 0.72);
    mainGain.gain.exponentialRampToValueAtTime(0.0006, now + dur);

    harmGain.gain.setValueAtTime(0.0001, now);
    harmGain.gain.linearRampToValueAtTime(0.06, now + 0.06);
    harmGain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

    oscMain.connect(mainGain);
    oscHarm.connect(harmGain);
    mainGain.connect(this.masterGain);
    harmGain.connect(this.masterGain);

    oscMain.start(now);
    oscHarm.start(now);
    lfo.start(now);
    oscMain.stop(now + dur + 0.04);
    oscHarm.stop(now + dur + 0.04);
    lfo.stop(now + dur + 0.04);

    // 3. Filtered breath air noise (bamboo edge turbulence)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(Math.min(4500, freq * 2.2), now);
      bp.Q.setValueAtTime(3.2, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.085, now + 0.035);
      nGain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + dur + 0.03);
    }
  }

  /**
   * Subtle tempo pulse (soft Thai woodblock / Krap) scheduled strictly on `audioCtx.currentTime`.
   */
  playMetronomeTick(when, isAccent = false) {
    if (!this.ctx) return;
    const t = Math.max(this.ctx.currentTime, when);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1100 : 780, t);
    osc.frequency.exponentialRampToValueAtTime(isAccent ? 620 : 480, t + 0.035);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(isAccent ? 0.14 : 0.08, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  /**
   * Gentle completion arpeggio when a song ends.
   */
  playCompleteFanfare() {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = this.ctx.currentTime + i * 0.11;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }
}

