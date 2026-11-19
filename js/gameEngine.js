/**
 * ============================================================================
 * js/gameEngine.js — Audio-Synced Rhythm Game Loop, Hit Detection & Renderer
 * ============================================================================
 * - All note positions, hit judgements, and metronome cues are strictly synced
 *   to `audioEngine.getCurrentTime()` (`audioCtx.currentTime`). Never uses `setInterval`.
 * - Applies user-calibrated `latencyOffsetMs` (±200ms) when judging Perfect/Good hits.
 * - Supports 4 Thai instruments: Ranat Ek, Ching, Taphon (Drum), and Khlui (Flute).
 */

import { DIFFICULTY_CONFIG, TAPHON_ZONES, KHLUI_NOTES, buildTimeline } from './beatmaps.js';
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
    this.landmarkIdx = 8; // 8 = Index Fingertip, 9 = Palm Center (Ranat UDL option)
    this.latencyOffsetMs = 0; // Compensates audio/camera/Bluetooth delay (±200ms)

    // Active song & difficulty config
    this.beatmap = null;
    this.diffConfig = null;
    this.timeline = null;
    this.lanes = []; // Active lane metadata (Ranat keys, Taphon zones, or Khlui notes)

    // Audio-clock timing state
    this.songStartTime = 0;
    this.pauseStartedAudioTime = 0;
    this.nextMetronomeBeat = 0;

    // Calibration readiness check state (3 seconds)
    this.calibHoldSec = 0;
    this.calibRequiredSec = 3.0;
    this.lastFramePerfMs = 0;

    // Scoring & progression stats
    this.stats = this._freshStats();

    // Visual feedback state
    this.laneGlow = [];
    this.chingRingGlow = { intensity: 0, color: '#dfb258' };
    this.activeFingerCount = 0;
    this.floatingTexts = [];
    this.particles = [];

    // Virtual instrument hitbox layout in normalized [0..1] canvas coords
    this.barBounds = {
      leftX: 0.05,
      rightX: 0.95,
      topY: 0.72,
      bottomY: 0.94,
    };

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

  setLatencyOffsetMs(ms) {
    const val = Number(ms);
    this.latencyOffsetMs = Number.isFinite(val) ? Math.max(-200, Math.min(200, val)) : 0;
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

  startSession(beatmap, { useCamera = true, landmarkIdx = 8, latencyOffsetMs = 0 } = {}) {
    this.stop();
    this.resize();

    this.beatmap = beatmap;
    this.diffConfig = DIFFICULTY_CONFIG[beatmap.level];
    this.timeline = buildTimeline(beatmap);
    this.useCamera = useCamera;
    this.landmarkIdx = landmarkIdx;
    this.setLatencyOffsetMs(latencyOffsetMs);

    if (beatmap.instrument === 'ranat') this.lanes = this.diffConfig.ranatKeys;
    else if (beatmap.instrument === 'taphon') this.lanes = TAPHON_ZONES;
    else if (beatmap.instrument === 'khlui') this.lanes = KHLUI_NOTES;
    else this.lanes = [];

    this.stats = this._freshStats();
    this.laneGlow = new Array(Math.max(1, this.lanes.length)).fill(0);
    this.chingRingGlow = { intensity: 0, color: '#dfb258' };
    this.activeFingerCount = 0;
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
   * Accessible Keyboard Play Mode input handler.
   */
  handleKeyInput(keyLower) {
    if (this.state !== 'playing') return;
    const nowAudio = this.audio.getCurrentTime();

    if (this.beatmap.instrument === 'ranat') {
      const laneIdx = this.lanes.findIndex((k) => k.keyHint.toLowerCase() === keyLower);
      if (laneIdx !== -1) this._processLaneStrike(laneIdx, nowAudio, 0.9);
    } else if (this.beatmap.instrument === 'taphon') {
      const laneIdx = this.lanes.findIndex((z) => z.keyHint.toLowerCase() === keyLower);
      if (laneIdx !== -1) this._processLaneStrike(laneIdx, nowAudio, 0.9);
    } else if (this.beatmap.instrument === 'khlui') {
      const laneIdx = this.lanes.findIndex((n) => n.keyHint.toLowerCase() === keyLower);
      if (laneIdx !== -1) {
        this.activeFingerCount = laneIdx + 1;
        this._processLaneStrike(laneIdx, nowAudio, 0.9);
      }
    } else if (this.beatmap.instrument === 'ching') {
      if (keyLower === 'c' || keyLower === ' ') {
        this._processChingAction('ching', nowAudio);
      } else if (keyLower === 'v' || keyLower === 'enter') {
        this._processChingAction('chab', nowAudio);
      }
    }
  }

  // ==========================================================================
  // Main Loop (requestAnimationFrame)
  // ==========================================================================
  _loop(nowMs) {
    const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - this.lastFramePerfMs) / 1000));
    this.lastFramePerfMs = nowMs;

    if (this.useCamera && this.vision.isReady) {
      this.vision.detect(nowMs);
    }

    if (this.state === 'calibrating') {
      this._updateCalibration(dtSec);
    } else if (this.state === 'playing') {
      this._updateGameplay(nowMs, dtSec);
    }

    this._render();

    if (this.state !== 'idle' && this.state !== 'finished') {
      this.rafId = requestAnimationFrame((t) => this._loop(t));
    }
  }

  // ==========================================================================
  // 3-Second Hand Readiness Check (1 hand for Khlui, 2 hands for others)
  // ==========================================================================
  _updateCalibration(dtSec) {
    const requiredHands = this.beatmap.instrument === 'khlui' ? 1 : 2;
    const handsCount = this.vision.hands.length;

    if (handsCount >= requiredHands) {
      this.calibHoldSec = Math.min(this.calibRequiredSec, this.calibHoldSec + dtSec);
    } else {
      this.calibHoldSec = Math.max(0, this.calibHoldSec - dtSec * 1.5);
    }

    const progress = this.calibHoldSec / this.calibRequiredSec;
    const secondsLeft = Math.max(1, Math.ceil(this.calibRequiredSec - this.calibHoldSec));

    this.callbacks.onCalibrationUpdate?.({
      handsCount,
      requiredHands,
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

    // 1. Schedule Web Audio metronome clicks (120ms lookahead)
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
      const inst = this.beatmap.instrument;
      if (inst === 'ranat') {
        const bounds = { ...this.barBounds, laneCount: this.lanes.length };
        const strikes = this.vision.evaluateRanatStrikes(nowMs, this.landmarkIdx, bounds);
        for (const s of strikes) {
          this._processLaneStrike(s.lane, audioNow, s.velocity);
        }
      } else if (inst === 'taphon') {
        const bounds = { ...this.barBounds, laneCount: this.lanes.length };
        const strikes = this.vision.evaluateTaphonStrikes(nowMs, bounds);
        for (const s of strikes) {
          this._processLaneStrike(s.lane, audioNow, s.velocity);
        }
      } else if (inst === 'khlui') {
        const { fingerCount, triggeredLane } = this.vision.evaluateKhluiFingers(nowMs);
        this.activeFingerCount = fingerCount;
        if (triggeredLane !== -1) {
          this._processLaneStrike(triggeredLane, audioNow, 0.9);
        } else if (fingerCount >= 1 && fingerCount <= 5) {
          // Allow holding the matching finger pose as a note reaches the Perfect window
          const lane = fingerCount - 1;
          const adjustedSongTime = songTime - this.latencyOffsetMs / 1000;
          const perfectWin = this.diffConfig.timingWindows.perfect;
          const readyNote = this.timeline.notes.find(
            (n) => n.status === 'pending' && n.lane === lane && Math.abs(adjustedSongTime - n.time) <= perfectWin * 0.75
          );
          if (readyNote) {
            this._processLaneStrike(lane, audioNow, 0.9);
          }
        }
      } else if (inst === 'ching') {
        const gesture = this.vision.evaluateChingGesture(nowMs, audioNow);
        if (gesture) {
          this._processChingAction(gesture.type, gesture.impactAudioTime);
        }
      }
    }

    // 3. Auto-miss notes past the Good timing window (compensated by latencyOffsetMs)
    const goodWin = this.diffConfig.timingWindows.good;
    const adjustedSongTime = songTime - this.latencyOffsetMs / 1000;
    for (const note of this.timeline.notes) {
      if (note.status === 'pending' && adjustedSongTime - note.time > goodWin) {
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

    // 5. Update HUD & check song end
    const progressPct = Math.min(100, Math.max(0, (songTime / this.timeline.totalDuration) * 100));
    this._emitHud(progressPct);

    if (songTime >= this.timeline.totalDuration) {
      this._finishSong();
    }
  }

  // ==========================================================================
  // Hit Judgement Math (Compensated by Latency Offset)
  // ==========================================================================
  _processLaneStrike(laneIdx, impactAudioTime, velocity = 0.9) {
    const laneMeta = this.lanes[laneIdx];
    if (!laneMeta) return;

    // Immediate synthesized instrument feedback
    const inst = this.beatmap.instrument;
    if (inst === 'ranat') {
      this.audio.playRanat(laneMeta.freq, laneMeta.id, velocity);
    } else if (inst === 'taphon') {
      this.audio.playTaphon(laneMeta.id, velocity);
    } else if (inst === 'khlui') {
      this.audio.playKhlui(laneMeta.freq, 0.45);
    }
    this.laneGlow[laneIdx] = 1.0;

    // Subtract user-calibrated latency offset (ms -> sec) before judging
    const adjustedSongTime = impactAudioTime - this.songStartTime - this.latencyOffsetMs / 1000;
    const { perfect, good } = this.diffConfig.timingWindows;

    let bestNote = null;
    let bestDelta = Infinity;

    for (const note of this.timeline.notes) {
      if (note.status !== 'pending' || note.lane !== laneIdx) continue;
      const delta = Math.abs(adjustedSongTime - note.time);
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
    if (actionType === 'ching') {
      this.audio.playChing();
      this.chingRingGlow = { intensity: 1.0, color: '#dfb258' };
    } else {
      this.audio.playChab();
      this.chingRingGlow = { intensity: 1.0, color: '#e87458' };
    }

    const adjustedSongTime = impactAudioTime - this.songStartTime - this.latencyOffsetMs / 1000;
    const { perfect, good } = this.diffConfig.timingWindows;

    let bestNote = null;
    let bestDelta = Infinity;

    for (const note of this.timeline.notes) {
      if (note.status !== 'pending') continue;
      const delta = Math.abs(adjustedSongTime - note.time);
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
        bestNote.status = 'miss';
        this._recordJudgement('miss', bestNote, true);
      }
    }
  }

  _recordJudgement(judgement, note, wrongGesture = false) {
    if (judgement === 'perfect' || judgement === 'good') {
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

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
    if (this.beatmap.instrument !== 'ching') {
      const leftPx = this.barBounds.leftX * this.viewW;
      const widthPx = (this.barBounds.rightX - this.barBounds.leftX) * this.viewW;
      const laneW = widthPx / this.lanes.length;
      return {
        x: leftPx + (note.lane + 0.5) * laneW,
        y: this.barBounds.topY * this.viewH,
      };
    }
    return { x: this.viewW * 0.5, y: this.viewH * 0.76 };
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
    this._drawMirroredBackground(ctx, w, h);

    const songTime =
      this.state === 'playing'
        ? this.audio.getCurrentTime() - this.songStartTime
        : this.state === 'paused'
          ? this.pauseStartedAudioTime - this.songStartTime
          : -1;

    if (this.beatmap.instrument === 'ching') {
      this._drawChingStage(ctx, w, h, songTime);
    } else {
      this._drawLaneInstrumentStage(ctx, w, h, songTime);
    }

    if (this.useCamera && this.vision.hands.length > 0) {
      this._drawHands(ctx, w, h);
    }

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

      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoEl, offsetX, offsetY, drawW, drawH);
      ctx.restore();

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
  // Unified Multi-Lane Stage for Ranat Ek, Taphon (Drum), and Khlui (Flute)
  // --------------------------------------------------------------------------
  _drawLaneInstrumentStage(ctx, w, h, songTime) {
    const inst = this.beatmap.instrument;
    const leftPx = this.barBounds.leftX * w;
    const rightPx = this.barBounds.rightX * w;
    const topPx = this.barBounds.topY * h;
    const bottomPx = this.barBounds.bottomY * h;
    const barH = bottomPx - topPx;
    const laneCount = this.lanes.length;
    const laneW = (rightPx - leftPx) / laneCount;
    const gap = Math.max(6, laneW * 0.06);

    // Level 1 visual aid highlight
    const nextLanes = new Set();
    if (this.diffConfig.visualAid && songTime >= 0) {
      const nextNote = this.timeline.notes.find((n) => n.status === 'pending' && n.time >= songTime - 0.1);
      if (nextNote && nextNote.time - songTime < 1.8) nextLanes.add(nextNote.lane);
    }

    // Vertical lane guides
    for (let i = 0; i < laneCount; i++) {
      const lx = leftPx + i * laneW;
      const isFingerActive = inst === 'khlui' && this.activeFingerCount === i + 1;
      ctx.fillStyle =
        isFingerActive
          ? 'rgba(76, 194, 168, 0.14)'
          : nextLanes.has(i)
            ? 'rgba(223, 178, 88, 0.09)'
            : 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(lx + gap / 2, 0, laneW - gap, topPx);
    }

    // Target strike horizon
    ctx.strokeStyle = 'rgba(223, 178, 88, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftPx, topPx);
    ctx.lineTo(rightPx, topPx);
    ctx.stroke();

    // Falling notes + simultaneous chord connectors
    if (songTime >= 0) {
      const fallDur = this.diffConfig.fallDuration;
      const visibleNotes = this.timeline.notes.filter(
        (n) => n.status === 'pending' && n.time - songTime <= fallDur && n.time - songTime >= -0.3
      );

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

      for (const note of visibleNotes) {
        const meta = this.lanes[note.lane];
        const progress = 1 - (note.time - songTime) / fallDur;
        const ny = progress * topPx;
        const nx = leftPx + note.lane * laneW + gap;
        const nw = laneW - gap * 2;
        const nh = Math.min(42, Math.max(26, h * 0.056));

        ctx.save();
        ctx.fillStyle = meta.color;
        ctx.shadowColor = meta.color;
        ctx.shadowBlur = note.chord ? 18 : 10;
        this._roundRect(ctx, nx, ny - nh / 2, nw, nh, inst === 'khlui' ? 20 : 10);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = note.chord ? 2.5 : 1.2;
        ctx.stroke();

        ctx.fillStyle = '#15100a';
        ctx.font = `800 ${Math.round(nh * 0.52)}px "Sarabun", "Noto Sans Thai", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const noteText =
          inst === 'khlui'
            ? `${meta.fingers} • ${this.lang === 'th' ? meta.th : meta.en}`
            : this.lang === 'th'
              ? meta.th
              : meta.en;
        ctx.fillText(noteText, nx + nw / 2, ny + 1);
        ctx.restore();
      }
    }

    // Instrument-specific lower pads (Ranat wood bars / Taphon drumhead / Khlui finger holes)
    if (inst === 'ranat') {
      ctx.strokeStyle = 'rgba(223, 178, 88, 0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(leftPx + 12, topPx + barH * 0.25);
      ctx.lineTo(rightPx - 12, topPx + barH * 0.25);
      ctx.moveTo(leftPx + 12, topPx + barH * 0.75);
      ctx.lineTo(rightPx - 12, topPx + barH * 0.75);
      ctx.stroke();
    }

    for (let i = 0; i < laneCount; i++) {
      const meta = this.lanes[i];
      const glow = this.laneGlow[i] || 0;
      const isAided = nextLanes.has(i);
      const isFingerHeld = inst === 'khlui' && this.activeFingerCount === i + 1;
      const bx = leftPx + i * laneW + gap / 2;
      const bw = laneW - gap;

      ctx.save();
      const padGrad = ctx.createLinearGradient(bx, topPx, bx, bottomPx);
      if (glow > 0.05 || isFingerHeld) {
        padGrad.addColorStop(0, meta.color);
        padGrad.addColorStop(1, '#3c2a18');
      } else if (inst === 'taphon') {
        padGrad.addColorStop(0, meta.zoneType === 'head' ? '#523424' : '#2a2b3a');
        padGrad.addColorStop(1, '#1d161b');
      } else if (inst === 'khlui') {
        padGrad.addColorStop(0, '#3e4228');
        padGrad.addColorStop(1, '#1f2316');
      } else {
        padGrad.addColorStop(0, '#5a3a22');
        padGrad.addColorStop(0.5, '#422918');
        padGrad.addColorStop(1, '#2b1a0f');
      }

      if (glow > 0.05 || isAided || isFingerHeld) {
        ctx.shadowColor = meta.color;
        ctx.shadowBlur = glow > 0.05 ? 26 * glow : 16;
      }

      ctx.fillStyle = padGrad;
      this._roundRect(ctx, bx, topPx, bw, barH, inst === 'taphon' ? 18 : 12);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = glow > 0.05 || isAided || isFingerHeld ? 3.5 : 2;
      ctx.strokeStyle = glow > 0.05 || isAided || isFingerHeld ? meta.color : 'rgba(223, 178, 88, 0.35)';
      ctx.stroke();

      ctx.fillStyle = glow > 0.3 || isFingerHeld ? '#140e07' : '#f7f2e8';
      ctx.font = `700 ${Math.min(32, Math.max(19, bw * 0.25))}px "Sarabun", "Noto Sans Thai", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.th, bx + bw / 2, topPx + barH * 0.42);

      ctx.fillStyle = glow > 0.3 || isFingerHeld ? '#241a0d' : 'rgba(247, 242, 232, 0.78)';
      ctx.font = '600 13px sans-serif';
      let subLabel = meta.en;
      if (inst === 'khlui') {
        const fLabel = this.lang === 'th' ? `${meta.fingers} นิ้ว` : `${meta.fingers}F`;
        subLabel = this.useCamera ? `${fLabel} (${meta.en})` : `${meta.en} [${meta.keyHint}]`;
      } else if (!this.useCamera) {
        subLabel = `${meta.en} [${meta.keyHint}]`;
      }
      ctx.fillText(subLabel, bx + bw / 2, topPx + barH * 0.75);
      ctx.restore();
    }

    // Live Khlui finger-count badge on stage
    if (inst === 'khlui' && this.useCamera) {
      ctx.save();
      const badgeW = 156;
      const badgeH = 42;
      const bx = w - badgeW - 18;
      const by = 56;
      ctx.fillStyle = 'rgba(17, 15, 21, 0.84)';
      this._roundRect(ctx, bx, by, badgeW, badgeH, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(76, 194, 168, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#4cc2a8';
      ctx.font = '700 15px "Sarabun", "Noto Sans Thai", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label =
        this.lang === 'th'
          ? `นิ้วที่ชู: ${this.activeFingerCount} นิ้ว`
          : `Fingers Up: ${this.activeFingerCount}`;
      ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2);
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

    ctx.strokeStyle = 'rgba(223, 178, 88, 0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, targetY - ringRadius);
    ctx.stroke();
    ctx.setLineDash([]);

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
    ctx.font = '600 14px "Sarabun", "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.lang === 'th' ? 'จังหวะ' : 'STRIKE', cx, targetY);
    ctx.restore();

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
          ctx.font = '800 20px "Sarabun", "Noto Sans Thai", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.lang === 'th' ? 'ฉิ่ง' : 'CHING', cx, ny);
        } else {
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
          ctx.font = '800 20px "Sarabun", "Noto Sans Thai", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.lang === 'th' ? 'ฉับ' : 'CHAB', cx, ny);
        }
        ctx.restore();
      }
    }

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

  _drawHands(ctx, w, h) {
    const inst = this.beatmap.instrument;
    for (const hand of this.vision.hands) {
      const pts = hand.landmarks;

      ctx.save();
      ctx.strokeStyle = 'rgba(245, 212, 135, 0.38)';
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x * w, pts[a].y * h);
        ctx.lineTo(pts[b].x * w, pts[b].y * h);
        ctx.stroke();
      }

      // Highlight the active tracking landmark per instrument
      let activePt = hand.indexTip;
      if (inst === 'ching' || inst === 'khlui') activePt = hand.palmCenter;
      else if (inst === 'taphon') activePt = hand.wrist;
      else if (this.landmarkIdx === 9) activePt = hand.palmCenter;

      const px = activePt.x * w;
      const py = activePt.y * h;

      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fillStyle = inst === 'taphon' ? '#4cc2a8' : 'rgba(245, 212, 135, 0.9)';
      ctx.shadowColor = inst === 'taphon' ? '#4cc2a8' : '#f5d487';
      ctx.shadowBlur = 14;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#140f08';
      ctx.stroke();
      ctx.restore();
    }
  }

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
      ctx.font = '800 26px "Sarabun", "Noto Sans Thai", sans-serif';
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
