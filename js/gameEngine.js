/**
 * ============================================================================
 * js/gameEngine.js — Audio-Synced Rhythm Game Loop, Hit Detection & Renderer
 * ============================================================================
 * - All note positions, hit judgements, and metronome cues are strictly synced
 *   to `audioEngine.getCurrentTime()` (`audioCtx.currentTime`). Never uses `setInterval`.
 * - Renders mirrored 640x480 webcam feed onto a responsive DPR-scaled Canvas.
 * - Supports both Ranat Ek (5 or 7 virtual wooden bars) and Ching (open/dampened).
 */

import { DIFFICULTY_CONFIG, buildTimeline } from './beatmaps.js';
import { HAND_CONNECTIONS } from './vision.js';

export class RhythmGameEngine {
  constructor({ canvas, videoEl, audioEngine, visionTracker, callbacks }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.videoEl = videoEl;
    this.audio = audioEngine;
    this.vision = visionTracker;
    this.callbacks = callbacks || {};

    this.state = 'idle'; // 'idle' | 'calibrating' | 'playing' | 'paused' | 'finished'
    this.rafId = null;
    this.lang = 'th';
    this.useCamera = true;
    this.landmarkIdx = 8; // 8 = Index Fingertip, 9 = Palm Center (UDL option)

    // Active song & difficulty config
    this.beatmap = null;
    this.diffConfig = null;
    this.timeline = null;
    this.keys = [];

    // Audio-clock timing state
    this.songStartTime = 0;
    this.pauseStartedAudioTime = 0;
    this.nextMetronomeBeat = 0;

    // Calibration state (3-second readiness check)
    this.calibHoldSec = 0;
    this.calibRequiredSec = 3.0;
    this.lastFramePerfMs = 0;

    // Scoring & progression stats
    this.stats = this._freshStats();

    // Visual feedback state (key glow timers, floating hit texts, particles)
    this.laneGlow = [];
    this.chingRingGlow = { intensity: 0, color: '#dfb258' };
    this.floatingTexts = [];
    this.particles = [];

    // Virtual Ranat Ek bar layout in normalized [0..1] canvas coordinates
    this.ranatBounds = {
      leftX: 0.05,
      rightX: 0.95,
      topY: 0.72,
      bottomY: 0.94,
    };

    // Resize observer for crisp responsive canvas
    this._handleResize = this.resize.bind(this);
    window.addEventListener('resize', this._handleResize);
  }

  _freshStats() {
    return {
      score: 0,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
      perfect: 0,
      good: 0,
      miss: 0,
    };
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  setLandmarkIndex(idx) {
    this.landmarkIdx = Number(idx) === 9 ? 9 : 8;
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(240, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  /**
   * Prepares a new session for the selected beatmap and enters Calibration (or Playing in keyboard mode).
   */
  startSession(beatmap, { useCamera = true, landmarkIdx = 8 } = {}) {
    this.stop();
    this.resize();

    this.beatmap = beatmap;
    this.diffConfig = DIFFICULTY_CONFIG[beatmap.level];
    this.timeline = buildTimeline(beatmap);
    this.keys = this.diffConfig.ranatKeys;
    this.useCamera = useCamera;
    this.landmarkIdx = landmarkIdx;

    this.stats = this._freshStats();
    this.laneGlow = new Array(this.keys.length).fill(0);
    this.chingRingGlow = { intensity: 0, color: '#dfb258' };
    this.floatingTexts = [];
    this.particles = [];
    this.calibHoldSec = 0;
    this.nextMetronomeBeat = 0;
    this.vision.resetGestureState();

    this._emitHud(0);

    if (this.useCamera) {
      this.state = 'calibrating';
      this.callbacks.onStateChange?.('calibrating');
    } else {
      this.beginSongPlayback();
    }

    this.lastFramePerfMs = performance.now();
    this.rafId = requestAnimationFrame((t) => this._loop(t));
  }

  /**
   * Transitions from Calibration into active audio-synced gameplay.
   */
  beginSongPlayback() {
    this.state = 'playing';
    this.songStartTime = this.audio.getCurrentTime();
    this.nextMetronomeBeat = 0;
    this.vision.resetGestureState();
    this.callbacks.onStateChange?.('playing');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pauseStartedAudioTime = this.audio.getCurrentTime();
    this.callbacks.onStateChange?.('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    // Shift songStartTime forward by exact pause duration so audio sync never drifts
    const pausedDuration = this.audio.getCurrentTime() - this.pauseStartedAudioTime;
    this.songStartTime += pausedDuration;
    this.state = 'playing';
    this.lastFramePerfMs = performance.now();
    this.callbacks.onStateChange?.('playing');
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.state = 'idle';
  }

  /**
   * Keyboard fallback / accessibility input handler.
   */
  handleKeyInput(keyLower) {
    if (this.state !== 'playing') return;

    if (this.beatmap.instrument === 'ranat') {
      const laneIdx = this.keys.findIndex((k) => k.keyHint.toLowerCase() === keyLower);
      if (laneIdx !== -1) {
        this._processRanatStrike(laneIdx, this.audio.getCurrentTime(), 0.9);
      }
    } else if (this.beatmap.instrument === 'ching') {
      if (keyLower === 'c' || keyLower === ' ') {
        this._processChingAction('ching', this.audio.getCurrentTime());
      } else if (keyLower === 'v' || keyLower === 'enter') {
        this._processChingAction('chab', this.audio.getCurrentTime());
      }
    }
  }

  // ==========================================================================
  // Main Animation Loop (requestAnimationFrame)
  // ==========================================================================
  _loop(nowMs) {
    const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - this.lastFramePerfMs) / 1000));
    this.lastFramePerfMs = nowMs;

    // 1. Run MediaPipe hand tracking if camera is active
    if (this.useCamera && this.vision.isReady) {
      this.vision.detect(nowMs);
    }

    // 2. Update game logic based on state
    if (this.state === 'calibrating') {
      this._updateCalibration(dtSec);
    } else if (this.state === 'playing') {
      this._updateGameplay(nowMs, dtSec);
    }

    // 3. Render current frame
    this._render(dtSec);

    if (this.state !== 'idle' && this.state !== 'finished') {
      this.rafId = requestAnimationFrame((t) => this._loop(t));
    }
  }

  // ==========================================================================
  // 3-Second Hand Calibration Readiness Check
  // ==========================================================================
  _updateCalibration(dtSec) {
    const handsCount = this.vision.hands.length;
    if (handsCount >= 2) {
      this.calibHoldSec = Math.min(this.calibRequiredSec, this.calibHoldSec + dtSec);
    } else {
      // Smooth decay rather than jarring instant reset for seniors/children
      this.calibHoldSec = Math.max(0, this.calibHoldSec - dtSec * 1.5);
    }

    const progress = this.calibHoldSec / this.calibRequiredSec;
    const secondsLeft = Math.max(1, Math.ceil(this.calibRequiredSec - this.calibHoldSec));

    this.callbacks.onCalibrationUpdate?.({
      handsCount,
      progress,
      secondsLeft,
    });

    if (this.calibHoldSec >= this.calibRequiredSec) {
      this.audio.playMetronomeTick(this.audio.getCurrentTime(), true);
      this.beginSongPlayback();
    }
  }

  // ==========================================================================
  // Audio-Synced Gameplay Update
  // ==========================================================================
  _updateGameplay(nowMs, dtSec) {
    const audioNow = this.audio.getCurrentTime();
    const songTime = audioNow - this.songStartTime;

    // 1. Schedule subtle Web Audio metronome clicks (lookahead 120ms)
    const lookaheadTime = songTime + 0.12;
    const totalBeats = Math.floor(this.timeline.totalDuration / this.timeline.secPerBeat);
    while (
      this.nextMetronomeBeat < totalBeats &&
      this.nextMetronomeBeat * this.timeline.secPerBeat <= lookaheadTime
    ) {
      const beatAudioTime = this.songStartTime + this.nextMetronomeBeat * this.timeline.secPerBeat;
      const isAccent = this.nextMetronomeBeat % 4 === 0;
      this.audio.playMetronomeTick(beatAudioTime, isAccent);
      this.nextMetronomeBeat++;
    }

    // 2. Process real-time webcam gestures
    if (this.useCamera && this.vision.isReady) {
      if (this.beatmap.instrument === 'ranat') {
        const barBounds = {
          ...this.ranatBounds,
          laneCount: this.keys.length,
        };
        const strikes = this.vision.evaluateRanatStrikes(nowMs, this.landmarkIdx, barBounds);
        for (const strike of strikes) {
          this._processRanatStrike(strike.lane, audioNow, strike.velocity);
        }
      } else {
        const gesture = this.vision.evaluateChingGesture(nowMs, audioNow);
        if (gesture) {
          this._processChingAction(gesture.type, gesture.impactAudioTime);
        }
      }
    }

    // 3. Auto-miss notes that have passed beyond the Good timing window
    const goodWin = this.diffConfig.timingWindows.good;
    for (const note of this.timeline.notes) {
      if (note.status === 'pending' && songTime - note.time > goodWin) {
        note.status = 'miss';
        this._recordJudgement('miss', note);
      }
    }

    // 4. Decay visual effects
    for (let i = 0; i < this.laneGlow.length; i++) {
      this.laneGlow[i] = Math.max(0, this.laneGlow[i] - dtSec * 3.8);
    }
    this.chingRingGlow.intensity = Math.max(0, this.chingRingGlow.intensity - dtSec * 3.5);
    this._updateEffects(dtSec);

    // 5. Update HUD & check song completion
    const progressPct = Math.min(100, Math.max(0, (songTime / this.timeline.totalDuration) * 100));
    this._emitHud(progressPct);

    if (songTime >= this.timeline.totalDuration) {
      this._finishSong();
    }
  }

  // ==========================================================================
  // Hit Judgement Math (Ranat Ek & Ching)
  // ==========================================================================
  _processRanatStrike(laneIdx, impactAudioTime, velocity = 0.9) {
    const key = this.keys[laneIdx];
    if (!key) return;

    // Immediate acoustic & visual feedback
    this.audio.playRanat(key.freq, key.id, velocity);
    this.laneGlow[laneIdx] = 1.0;

    const songTime = impactAudioTime - this.songStartTime;
    const { perfect, good } = this.diffConfig.timingWindows;

    // Find closest pending note in this lane within the Good window
    let bestNote = null;
    let bestDelta = Infinity;

    for (const note of this.timeline.notes) {
      if (note.status !== 'pending' || note.lane !== laneIdx) continue;
      const delta = Math.abs(songTime - note.time);
      if (delta <= good && delta < bestDelta) {
        bestDelta = delta;
        bestNote = note;
      }
    }

    if (bestNote) {
      const judgement = bestDelta <= perfect ? 'perfect' : 'good';
      bestNote.status = judgement;
      this._recordJudgement(judgement, bestNote);
    }
  }

  _processChingAction(actionType, impactAudioTime) {
    // Immediate acoustic & visual feedback
    if (actionType === 'ching') {
      this.audio.playChing();
      this.chingRingGlow = { intensity: 1.0, color: '#dfb258' };
    } else {
      this.audio.playChab();
      this.chingRingGlow = { intensity: 1.0, color: '#e87458' };
    }

    const songTime = impactAudioTime - this.songStartTime;
    const { perfect, good } = this.diffConfig.timingWindows;

    // Match closest pending note within Good window
    let bestNote = null;
    let bestDelta = Infinity;

    for (const note of this.timeline.notes) {
      if (note.status !== 'pending') continue;
      const delta = Math.abs(songTime - note.time);
      if (delta <= good && delta < bestDelta) {
        bestDelta = delta;
        bestNote = note;
      }
    }

    if (bestNote) {
      if (bestNote.type === actionType) {
        const judgement = bestDelta <= perfect ? 'perfect' : 'good';
        bestNote.status = judgement;
        this._recordJudgement(judgement, bestNote);
      } else {
        // Right time, wrong articulation (e.g., played Chab on a Ching note)
        bestNote.status = 'miss';
        this._recordJudgement('miss', bestNote, true);
      }
    }
  }

  _recordJudgement(judgement, note, wrongGesture = false) {
    if (judgement === 'perfect' || judgement === 'good') {
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

      // Level 3 Combo Multiplier (x2 at 10+ streak, x4 at 25+ streak)
      if (this.diffConfig.comboMultiplier) {
        if (this.stats.combo >= 25) this.stats.multiplier = 4;
        else if (this.stats.combo >= 10) this.stats.multiplier = 2;
        else this.stats.multiplier = 1;
      } else {
        this.stats.multiplier = 1;
      }

      const basePts = judgement === 'perfect' ? 100 : 50;
      this.stats.score += basePts * this.stats.multiplier;
      if (judgement === 'perfect') this.stats.perfect += 1;
      else this.stats.good += 1;
    } else {
      this.stats.combo = 0;
      this.stats.multiplier = 1;
      this.stats.miss += 1;
    }

    // Spawn floating feedback text & particles at target position
    const pos = this._getNoteTargetScreenPos(note);
    const labelMap = {
      perfect: this.lang === 'th' ? 'ยอดเยี่ยม!' : 'PERFECT!',
      good: this.lang === 'th' ? 'ดี!' : 'GOOD',
      miss: wrongGesture
        ? (this.lang === 'th' ? 'ผิดจังหวะ!' : 'WRONG!')
        : (this.lang === 'th' ? 'พลาด' : 'MISS'),
    };
    const colorMap = {
      perfect: '#f5d487',
      good: '#4cc2a8',
      miss: '#e87458',
    };

    this.floatingTexts.push({
      text: labelMap[judgement],
      color: colorMap[judgement],
      x: pos.x,
      y: pos.y - 24,
      age: 0,
      life: 0.72,
    });

    if (judgement !== 'miss') {
      this._spawnHitParticles(pos.x, pos.y, colorMap[judgement], judgement === 'perfect' ? 14 : 7);
    }
  }

  _getNoteTargetScreenPos(note) {
    if (this.beatmap.instrument === 'ranat') {
      const leftPx = this.ranatBounds.leftX * this.viewW;
      const widthPx = (this.ranatBounds.rightX - this.ranatBounds.leftX) * this.viewW;
      const laneW = widthPx / this.keys.length;
      return {
        x: leftPx + (note.lane + 0.5) * laneW,
        y: this.ranatBounds.topY * this.viewH,
      };
    }
    return {
      x: this.viewW * 0.5,
      y: this.viewH * 0.76,
    };
  }

  _spawnHitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 70 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 3 + Math.random() * 4,
        color,
        age: 0,
        life: 0.45 + Math.random() * 0.2,
      });
    }
  }

  _updateEffects(dtSec) {
    for (const ft of this.floatingTexts) {
      ft.age += dtSec;
      ft.y -= 48 * dtSec;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.age < ft.life);

    for (const p of this.particles) {
      p.age += dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 220 * dtSec;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  _computeAccuracy() {
    const judged = this.stats.perfect + this.stats.good + this.stats.miss;
    if (judged === 0) return 100;
    return Math.round(((this.stats.perfect * 1.0 + this.stats.good * 0.6) / judged) * 100);
  }

  _emitHud(progressPct) {
    this.callbacks.onHudUpdate?.({
      score: this.stats.score,
      combo: this.stats.combo,
      multiplier: this.stats.multiplier,
      accuracy: this._computeAccuracy(),
      progressPct,
    });
  }

  _finishSong() {
    this.state = 'finished';
    this.audio.playCompleteFanfare();

    const accuracy = this._computeAccuracy();
    let grade = 'C';
    if (accuracy >= 95) grade = 'S';
    else if (accuracy >= 85) grade = 'A';
    else if (accuracy >= 70) grade = 'B';

    this.callbacks.onSongComplete?.({
      beatmapId: this.beatmap.id,
      score: this.stats.score,
      maxCombo: this.stats.maxCombo,
      accuracy,
      grade,
      perfect: this.stats.perfect,
      good: this.stats.good,
      miss: this.stats.miss,
    });
  }

  // ==========================================================================
  // Rendering Pipeline
  // ==========================================================================
  _render() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // 1. Mirrored Webcam Feed (or dark lacquer stage in keyboard mode)
    this._drawMirroredBackground(ctx, w, h);

    // 2. Instrument-specific Stage & Falling Notes
    const songTime =
      this.state === 'playing'
        ? this.audio.getCurrentTime() - this.songStartTime
        : this.state === 'paused'
          ? this.pauseStartedAudioTime - this.songStartTime
          : -1;

    if (this.beatmap.instrument === 'ranat') {
      this._drawRanatStage(ctx, w, h, songTime);
    } else {
      this._drawChingStage(ctx, w, h, songTime);
    }

    // 3. Hand Landmarks & Active Cursors
    if (this.useCamera && this.vision.hands.length > 0) {
      this._drawHands(ctx, w, h);
    }

    // 4. Hit Particles & Floating Judgement Popups
    this._drawEffects(ctx);
  }

  _drawMirroredBackground(ctx, w, h) {
    if (this.useCamera && this.videoEl && this.videoEl.readyState >= 2) {
      const vw = this.videoEl.videoWidth || 640;
      const vh = this.videoEl.videoHeight || 480;
      const scale = Math.max(w / vw, h / vh);
      const drawW = vw * scale;
      const drawH = vh * scale;
      const offsetX = (w - drawW) / 2;
      const offsetY = (h - drawH) / 2;

      // Mirror horizontally using ctx.scale(-1, 1)
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoEl, offsetX, offsetY, drawW, drawH);
      ctx.restore();

      // Subtle dark scrim for UDL high-contrast readability
      ctx.fillStyle = 'rgba(14, 11, 19, 0.56)';
      ctx.fillRect(0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#16121e');
      grad.addColorStop(1, '#0c0910');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // --------------------------------------------------------------------------
  // Ranat Ek Stage & Falling Notes
  // --------------------------------------------------------------------------
  _drawRanatStage(ctx, w, h, songTime) {
    const leftPx = this.ranatBounds.leftX * w;
    const rightPx = this.ranatBounds.rightX * w;
    const topPx = this.ranatBounds.topY * h;
    const bottomPx = this.ranatBounds.bottomY * h;
    const barH = bottomPx - topPx;
    const laneCount = this.keys.length;
    const laneW = (rightPx - leftPx) / laneCount;
    const gap = Math.max(6, laneW * 0.06);

    // Identify next upcoming note(s) for Level 1 Visual Aid
    const nextLanes = new Set();
    if (this.diffConfig.visualAid && songTime >= 0) {
      const nextNote = this.timeline.notes.find((n) => n.status === 'pending' && n.time >= songTime - 0.1);
      if (nextNote && nextNote.time - songTime < 1.8) {
        nextLanes.add(nextNote.lane);
      }
    }

    // Draw subtle vertical lane guides
    for (let i = 0; i < laneCount; i++) {
      const lx = leftPx + i * laneW;
      ctx.fillStyle = nextLanes.has(i) ? 'rgba(223, 178, 88, 0.09)' : 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(lx + gap / 2, 0, laneW - gap, topPx);
    }

    // Strike target line (glowing gold horizon)
    ctx.strokeStyle = 'rgba(223, 178, 88, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftPx, topPx);
    ctx.lineTo(rightPx, topPx);
    ctx.stroke();

    // Draw falling notes + chord connectors
    if (songTime >= 0) {
      const fallDur = this.diffConfig.fallDuration;
      const visibleNotes = this.timeline.notes.filter(
        (n) => n.status === 'pending' && n.time - songTime <= fallDur && n.time - songTime >= -0.3
      );

      // Draw golden connector bar between simultaneous two-hand chords (ตีคู่)
      const byBeat = new Map();
      for (const n of visibleNotes) {
        if (!n.chord) continue;
        if (!byBeat.has(n.beat)) byBeat.set(n.beat, []);
        byBeat.get(n.beat).push(n);
      }
      for (const chordGroup of byBeat.values()) {
        if (chordGroup.length >= 2) {
          const progress = 1 - (chordGroup[0].time - songTime) / fallDur;
          const ny = progress * topPx;
          const xs = chordGroup.map((n) => leftPx + (n.lane + 0.5) * laneW);
          ctx.strokeStyle = 'rgba(245, 212, 135, 0.85)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(Math.min(...xs), ny);
          ctx.lineTo(Math.max(...xs), ny);
          ctx.stroke();
        }
      }

      // Draw individual note blocks
      for (const note of visibleNotes) {
        const key = this.keys[note.lane];
        const progress = 1 - (note.time - songTime) / fallDur;
        const ny = progress * topPx;
        const nx = leftPx + note.lane * laneW + gap;
        const nw = laneW - gap * 2;
        const nh = Math.min(40, Math.max(26, h * 0.055));

        ctx.save();
        ctx.fillStyle = key.color;
        ctx.shadowColor = key.color;
        ctx.shadowBlur = note.chord ? 18 : 10;
        this._roundRect(ctx, nx, ny - nh / 2, nw, nh, 10);
        ctx.fill();

        // Crisp border & Thai solfege label inside falling note
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = note.chord ? 2.5 : 1.2;
        ctx.stroke();

        ctx.fillStyle = '#15100a';
        ctx.font = `800 ${Math.round(nh * 0.56)}px "Noto Sans Thai", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.lang === 'th' ? key.th : key.en, nx + nw / 2, ny + 1);
        ctx.restore();
      }
    }

    // Draw Virtual Wooden Ranat Ek Bars
    // Connecting binding cords (เชือกร้อยผืนระนาด)
    ctx.strokeStyle = 'rgba(223, 178, 88, 0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(leftPx + 12, topPx + barH * 0.25);
    ctx.lineTo(rightPx - 12, topPx + barH * 0.25);
    ctx.moveTo(leftPx + 12, topPx + barH * 0.75);
    ctx.lineTo(rightPx - 12, topPx + barH * 0.75);
    ctx.stroke();

    for (let i = 0; i < laneCount; i++) {
      const key = this.keys[i];
      const glow = this.laneGlow[i] || 0;
      const isAided = nextLanes.has(i);
      const bx = leftPx + i * laneW + gap / 2;
      const bw = laneW - gap;

      ctx.save();
      // Teakwood bar gradient
      const barGrad = ctx.createLinearGradient(bx, topPx, bx, bottomPx);
      if (glow > 0.05) {
        barGrad.addColorStop(0, key.color);
        barGrad.addColorStop(1, '#5d3e1e');
      } else {
        barGrad.addColorStop(0, '#5a3a22');
        barGrad.addColorStop(0.5, '#422918');
        barGrad.addColorStop(1, '#2b1a0f');
      }

      if (glow > 0.05 || isAided) {
        ctx.shadowColor = key.color;
        ctx.shadowBlur = glow > 0.05 ? 26 * glow : 16;
      }

      ctx.fillStyle = barGrad;
      this._roundRect(ctx, bx, topPx, bw, barH, 12);
      ctx.fill();

      // Colored accent border
      ctx.shadowBlur = 0;
      ctx.lineWidth = glow > 0.05 || isAided ? 3.5 : 2;
      ctx.strokeStyle = glow > 0.05 || isAided ? key.color : 'rgba(223, 178, 88, 0.35)';
      ctx.stroke();

      // Thai solfege note label (large & legible for all ages)
      ctx.fillStyle = glow > 0.3 ? '#140e07' : '#f7f2e8';
      ctx.font = `700 ${Math.min(34, Math.max(20, bw * 0.3))}px "Noto Sans Thai", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key.th, bx + bw / 2, topPx + barH * 0.44);

      // Secondary English solfege + keyboard hint
      ctx.fillStyle = glow > 0.3 ? '#241a0d' : 'rgba(247, 242, 232, 0.72)';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      const subLabel = this.useCamera ? key.en : `${key.en} [${key.keyHint}]`;
      ctx.fillText(subLabel, bx + bw / 2, topPx + barH * 0.76);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // Ching Stage (Central Rhythm Lane + Scale-Normalized Palm Meter)
  // --------------------------------------------------------------------------
  _drawChingStage(ctx, w, h, songTime) {
    const cx = w * 0.5;
    const targetY = h * 0.76;
    const ringRadius = Math.min(58, Math.max(40, h * 0.085));

    // Central rhythm guide track
    ctx.strokeStyle = 'rgba(223, 178, 88, 0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, targetY - ringRadius);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target strike ring
    ctx.save();
    if (this.chingRingGlow.intensity > 0.02) {
      ctx.shadowColor = this.chingRingGlow.color;
      ctx.shadowBlur = 32 * this.chingRingGlow.intensity;
    }
    ctx.beginPath();
    ctx.arc(cx, targetY, ringRadius, 0, Math.PI * 2);
    ctx.fillStyle =
      this.chingRingGlow.intensity > 0.05
        ? 'rgba(223, 178, 88, 0.24)'
        : 'rgba(20, 17, 26, 0.72)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle =
      this.chingRingGlow.intensity > 0.05 ? this.chingRingGlow.color : 'rgba(223, 178, 88, 0.7)';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(247, 242, 232, 0.75)';
    ctx.font = '600 14px "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.lang === 'th' ? 'จังหวะ' : 'STRIKE', cx, targetY);
    ctx.restore();

    // Falling Ching (Open) & Chab (Dampened) notes
    if (songTime >= 0) {
      const fallDur = this.diffConfig.fallDuration;
      const visibleNotes = this.timeline.notes.filter(
        (n) => n.status === 'pending' && n.time - songTime <= fallDur && n.time - songTime >= -0.35
      );

      for (const note of visibleNotes) {
        const progress = 1 - (note.time - songTime) / fallDur;
        const ny = progress * targetY;
        const isChing = note.type === 'ching';
        const r = ringRadius * 0.78;

        ctx.save();
        if (isChing) {
          // CHING (Open): Radiant Golden Hollow Ring
          ctx.shadowColor = '#dfb258';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(cx, ny, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(223, 178, 88, 0.18)';
          ctx.fill();
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#f5d487';
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f5d487';
          ctx.font = '800 20px "Noto Sans Thai", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.lang === 'th' ? 'ฉิ่ง' : 'CHING', cx, ny);
        } else {
          // CHAB (Dampened): Solid Lotus-Coral Filled Disc
          ctx.shadowColor = '#e87458';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(cx, ny, r, 0, Math.PI * 2);
          ctx.fillStyle = '#e87458';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff3ef';
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#1b0b07';
          ctx.font = '800 20px "Noto Sans Thai", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.lang === 'th' ? 'ฉับ' : 'CHAB', cx, ny);
        }
        ctx.restore();
      }
    }

    // Live Scale-Normalized Palm Connection & Hold-Progress Indicator
    if (this.useCamera && this.vision.hands.length >= 2) {
      const p1 = this.vision.hands[0].palmCenter;
      const p2 = this.vision.hands[1].palmCenter;
      const cs = this.vision.chingState;

      ctx.save();
      ctx.strokeStyle = cs.phase === 'OPEN' ? 'rgba(76, 194, 168, 0.55)' : '#f5d487';
      ctx.lineWidth = cs.phase === 'OPEN' ? 2.5 : 5;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();

      // Hold progress ring around palm midpoint when hands are closed (Ching -> Chab)
      if (cs.palmMidpoint && cs.holdProgress > 0) {
        const mx = cs.palmMidpoint.x * w;
        const my = cs.palmMidpoint.y * h;
        ctx.beginPath();
        ctx.arc(mx, my, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cs.holdProgress);
        ctx.strokeStyle = cs.holdProgress >= 1 ? '#e87458' : '#f5d487';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // Hand Skeleton & Active Pointer Rendering
  // --------------------------------------------------------------------------
  _drawHands(ctx, w, h) {
    for (const hand of this.vision.hands) {
      const pts = hand.landmarks;

      // Subtle translucent hand skeleton
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 212, 135, 0.38)';
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x * w, pts[a].y * h);
        ctx.lineTo(pts[b].x * w, pts[b].y * h);
        ctx.stroke();
      }

      // Highlight active tracking point (Ranat: Index 8 or Palm 9; Ching: Palm 9)
      const activePt =
        this.beatmap.instrument === 'ching'
          ? hand.palmCenter
          : this.landmarkIdx === 9
            ? hand.palmCenter
            : hand.indexTip;

      const px = activePt.x * w;
      const py = activePt.y * h;

      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 212, 135, 0.9)';
      ctx.shadowColor = '#f5d487';
      ctx.shadowBlur = 14;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#140f08';
      ctx.stroke();
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // Particles & Floating Judgement Text
  // --------------------------------------------------------------------------
  _drawEffects(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, 1 - ft.age / ft.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 26px "Noto Sans Thai", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(14, 11, 19, 0.85)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

