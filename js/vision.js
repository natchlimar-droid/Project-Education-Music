/**
 * ============================================================================
 * js/vision.js — Client-Side MediaPipe HandLandmarker & Anti-Bug Gesture Logic
 * ============================================================================
 * - 100% client-side processing (no frames leave the browser).
 * - Captures webcam at 640x480 for high FPS on low-spec devices.
 * - Implements:
 *   1. Downward velocity check (deltaY > threshold) for Ranat Ek strikes.
 *   2. 165ms per-hand / per-key cooldown state lock to prevent double-triggers.
 *   3. Scale-normalized palm distance for Ching ("Ching" open vs "Chab" dampened)
 *      so players can sit at any comfortable distance from the camera.
 */

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Hand skeleton bone pairs for lightweight visual feedback
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Palm arch
];

export class HandVisionTracker {
  constructor() {
    this.handLandmarker = null;
    this.videoEl = null;
    this.stream = null;
    this.isReady = false;
    this.lastVideoTime = -1;

    // Latest detected hands in mirrored normalized coordinates [0..1]
    this.hands = [];

    // ------------------------------------------------------------------------
    // Anti-Bug Parameters
    // ------------------------------------------------------------------------
    this.COOLDOWN_MS = 165;          // 150ms-180ms cooldown lock per hand/key
    this.STRIKE_DELTA_Y = 0.011;     // Minimum downward deltaY per frame (normalized)
    this.STRIKE_MIN_VY = 0.36;       // Minimum downward velocity (screen-heights / sec)

    // Scale-normalized Ching thresholds (multiples of average hand size)
    this.CHING_CLOSE_THRESH = 0.98;  // Palms together when normDist < 0.98
    this.CHING_OPEN_THRESH = 1.28;   // Palms separated when normDist > 1.28 (hysteresis)
    this.CHAB_HOLD_MS = 185;         // Hold >= 185ms => "Chab" (dampened); faster => "Ching" (open)

    // Per-hand velocity & cooldown tracking state
    this.handHistory = new Map();    // handKey -> { prevY, prevTimeMs, lastTriggerMs }
    this.keyCooldowns = new Map();   // laneIndex -> lastTriggerMs

    // Ching gesture state machine
    this.chingState = {
      phase: 'OPEN',          // 'OPEN' | 'CLOSED' | 'LOCKED'
      contactPerfMs: 0,
      contactAudioTime: 0,
      lastEmitMs: 0,
      normDist: 2.5,
      holdProgress: 0,        // 0..1 visual fill while holding for Chab
      palmMidpoint: null,     // { x, y } in mirrored normalized coords
    };
  }

  /**
   * Initializes MediaPipe HandLandmarker via CDN and starts the 640x480 webcam stream.
   */
  async init(videoElement, onStatus = () => {}) {
    this.videoEl = videoElement;

    if (!this.handLandmarker) {
      onStatus('loadingModel');
      const visionModule = await import(`${VISION_CDN}/vision_bundle.mjs`);
      const { FilesetResolver, HandLandmarker } = visionModule;

      const filesetResolver = await FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`);
      this.handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });
    }

    if (!this.stream) {
      onStatus('startingCamera');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.videoEl.srcObject = this.stream;
      await new Promise((resolve) => {
        if (this.videoEl.readyState >= 2) {
          resolve();
        } else {
          this.videoEl.onloadeddata = () => resolve();
        }
      });
      await this.videoEl.play();
    }

    this.isReady = true;
    this.resetGestureState();
  }

  /**
   * Stops the webcam stream cleanly when exiting or switching modes.
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.isReady = false;
    this.hands = [];
  }

  /**
   * Resets all velocity histories, cooldowns, and Ching gesture state.
   */
  resetGestureState() {
    this.handHistory.clear();
    this.keyCooldowns.clear();
    this.chingState = {
      phase: 'OPEN',
      contactPerfMs: 0,
      contactAudioTime: 0,
      lastEmitMs: 0,
      normDist: 2.5,
      holdProgress: 0,
      palmMidpoint: null,
    };
  }

  /**
   * Runs HandLandmarker inference on the current webcam video frame.
   * Mirrors X coordinates (`1 - lm.x`) so they align directly with the mirrored canvas.
   */
  detect(nowMs) {
    if (!this.isReady || !this.handLandmarker || !this.videoEl || this.videoEl.readyState < 2) {
      return this.hands;
    }

    // Only run MediaPipe when a new video frame arrives (saves CPU/GPU)
    if (this.videoEl.currentTime === this.lastVideoTime) {
      return this.hands;
    }
    this.lastVideoTime = this.videoEl.currentTime;

    const result = this.handLandmarker.detectForVideo(this.videoEl, nowMs);
    const detected = [];

    if (result && result.landmarks) {
      for (let i = 0; i < result.landmarks.length; i++) {
        const rawLandmarks = result.landmarks[i];
        const handedness = result.handednesses?.[i]?.[0]?.categoryName || `Hand${i}`;

        // Mirror X coordinate so it matches ctx.scale(-1, 1) webcam rendering
        const landmarks = rawLandmarks.map((pt) => ({
          x: 1 - pt.x,
          y: pt.y,
          z: pt.z,
        }));

        // Hand scale reference: Euclidean distance from Wrist (0) to Middle MCP (9)
        const wrist = landmarks[0];
        const palm = landmarks[9];
        const handSize = Math.max(0.04, Math.hypot(palm.x - wrist.x, palm.y - wrist.y));

        detected.push({
          id: `${handedness}-${i}`,
          label: handedness,
          landmarks,
          indexTip: landmarks[8],  // Landmark 8: Index fingertip
          palmCenter: landmarks[9], // Landmark 9: Palm center (Middle MCP)
          handSize,
        });
      }
    }

    this.hands = detected;
    return this.hands;
  }

  /**
   * Evaluates Ranat Ek downward strike gestures with Anti-Bug Velocity Check + Cooldown.
   *
   * @param {number} nowMs         Current performance.now() timestamp
   * @param {number} landmarkIdx   8 (Index Fingertip) or 9 (Palm Center)
   * @param {object} barBounds     { topY, bottomY, leftX, rightX, laneCount } in normalized [0..1] coords
   * @returns {Array<{ lane: number, handId: string, velocity: number, x: number, y: number }>}
   */
  evaluateRanatStrikes(nowMs, landmarkIdx, barBounds) {
    const strikes = [];
    const activeIds = new Set();

    for (const hand of this.hands) {
      const pt = landmarkIdx === 9 ? hand.palmCenter : hand.indexTip;
      const handKey = hand.label || hand.id;
      activeIds.add(handKey);

      const hist = this.handHistory.get(handKey) || {
        prevY: pt.y,
        prevTimeMs: nowMs,
        lastTriggerMs: 0,
      };

      const dtMs = Math.max(1, nowMs - hist.prevTimeMs);
      const deltaY = pt.y - hist.prevY; // Positive = moving downward toward Ranat bars
      const vy = deltaY / (dtMs / 1000);

      // Update history for next frame
      hist.prevY = pt.y;
      hist.prevTimeMs = nowMs;

      // Check if pointer is inside the virtual xylophone bar hitbox
      const inHorizontal = pt.x >= barBounds.leftX && pt.x <= barBounds.rightX;
      const inVertical = pt.y >= barBounds.topY && pt.y <= barBounds.bottomY;

      if (inHorizontal && inVertical) {
        const relX = (pt.x - barBounds.leftX) / (barBounds.rightX - barBounds.leftX);
        const lane = Math.min(barBounds.laneCount - 1, Math.max(0, Math.floor(relX * barBounds.laneCount)));

        // Anti-Bug 1: Downward velocity check (prevents resting hands from triggering)
        const isDownwardStrike = deltaY > this.STRIKE_DELTA_Y && vy > this.STRIKE_MIN_VY;

        // Anti-Bug 2: Per-hand & per-key cooldown lock (165ms)
        const handReady = nowMs - hist.lastTriggerMs >= this.COOLDOWN_MS;
        const keyReady = nowMs - (this.keyCooldowns.get(lane) || 0) >= this.COOLDOWN_MS;

        if (isDownwardStrike && handReady && keyReady) {
          hist.lastTriggerMs = nowMs;
          this.keyCooldowns.set(lane, nowMs);

          // Normalize velocity into [0.5 .. 1.0] for dynamic acoustic loudness
          const normVel = Math.min(1.0, Math.max(0.55, vy / 2.2));
          strikes.push({
            lane,
            handId: handKey,
            velocity: normVel,
            x: pt.x,
            y: pt.y,
          });
        }
      }

      this.handHistory.set(handKey, hist);
    }

    // Prune disappeared hands so re-entry starts clean without stale deltaY spikes
    for (const key of this.handHistory.keys()) {
      if (!activeIds.has(key)) {
        this.handHistory.delete(key);
      }
    }

    return strikes;
  }

  /**
   * Evaluates scale-normalized Ching ("Ching" open vs "Chab" dampened) gestures.
   *
   * Math:
   *   palmDist    = hypot(palm1.x - palm2.x, palm1.y - palm2.y)
   *   avgHandSize = (hand1.handSize + hand2.handSize) / 2
   *   normDist    = palmDist / avgHandSize
   *
   * State Machine:
   *   - OPEN -> CLOSED when `normDist < CHING_CLOSE_THRESH` (records exact `audioTime` of impact)
   *   - CLOSED -> emits `'chab'` if held >= `CHAB_HOLD_MS` (dampened sound), then LOCKED
   *   - CLOSED -> emits `'ching'` if separated (`normDist > CHING_OPEN_THRESH`) before `CHAB_HOLD_MS`
   *   - LOCKED -> returns to OPEN once palms separate (`normDist > CHING_OPEN_THRESH`)
   *
   * @param {number} nowMs       performance.now()
   * @param {number} audioTime   audioCtx.currentTime at this frame
   * @returns {{ type: 'ching' | 'chab', impactAudioTime: number } | null}
   */
  evaluateChingGesture(nowMs, audioTime) {
    const state = this.chingState;

    if (this.hands.length < 2) {
      // Reset smoothly if fewer than 2 hands are visible
      state.holdProgress = 0;
      state.palmMidpoint = null;
      if (state.phase === 'CLOSED') {
        state.phase = 'OPEN';
      }
      return null;
    }

    const h1 = this.hands[0];
    const h2 = this.hands[1];

    const palmDist = Math.hypot(
      h1.palmCenter.x - h2.palmCenter.x,
      h1.palmCenter.y - h2.palmCenter.y
    );
    const avgHandSize = (h1.handSize + h2.handSize) / 2;
    const normDist = palmDist / avgHandSize;

    state.normDist = normDist;
    state.palmMidpoint = {
      x: (h1.palmCenter.x + h2.palmCenter.x) / 2,
      y: (h1.palmCenter.y + h2.palmCenter.y) / 2,
    };

    const cooldownPassed = nowMs - state.lastEmitMs >= this.COOLDOWN_MS;

    if (state.phase === 'OPEN') {
      state.holdProgress = 0;
      if (normDist < this.CHING_CLOSE_THRESH && cooldownPassed) {
        state.phase = 'CLOSED';
        state.contactPerfMs = nowMs;
        // Anchor timing judgement to exact moment palms meet (zero latency penalty!)
        state.contactAudioTime = audioTime;
      }
    } else if (state.phase === 'CLOSED') {
      const heldMs = nowMs - state.contactPerfMs;
      state.holdProgress = Math.min(1, heldMs / this.CHAB_HOLD_MS);

      if (heldMs >= this.CHAB_HOLD_MS) {
        // Palms stayed together long enough -> Dampened "Chab"
        state.phase = 'LOCKED';
        state.lastEmitMs = nowMs;
        state.holdProgress = 1;
        return { type: 'chab', impactAudioTime: state.contactAudioTime };
      }

      if (normDist > this.CHING_OPEN_THRESH) {
        // Palms touched and separated briskly -> Open ringing "Ching"
        state.phase = 'OPEN';
        state.lastEmitMs = nowMs;
        state.holdProgress = 0;
        return { type: 'ching', impactAudioTime: state.contactAudioTime };
      }
    } else if (state.phase === 'LOCKED') {
      // Wait for palms to separate before allowing next contact
      if (normDist > this.CHING_OPEN_THRESH) {
        state.phase = 'OPEN';
        state.holdProgress = 0;
      }
    }

    return null;
  }
}

