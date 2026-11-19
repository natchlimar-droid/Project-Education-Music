/**
 * ============================================================================
 * js/main.js — Application Controller, WCAG/ARIA Radio Groups, Latency Sync & PWA
 * ============================================================================
 * Coordinates:
 *  - Bilingual TH/EN i18n
 *  - Full ARIA radiogroup compliance (aria-checked, roving tabindex, arrow keys)
 *  - Audio/Input Latency Calibration (8-beat median offset ±200ms in localStorage)
 *  - Autoplay-safe Web Audio unlock across all entry points
 *  - 4 Thai instruments (Ranat Ek, Ching, Taphon, Khlui) & Classroom PWA SW
 */

import { ThaiAudioEngine } from './audio.js';
import { HandVisionTracker } from './vision.js';
import { RhythmGameEngine } from './gameEngine.js';
import { DIFFICULTY_CONFIG, getBeatmap } from './beatmaps.js';

const STORAGE_KEY = 'siam_rhythm_personal_bests_v1';
const LATENCY_STORAGE_KEY = 'siam_rhythm_latency_offset_v1';

// ============================================================================
// Bilingual Dictionary (Thai / English)
// ============================================================================
const I18N = {
  th: {
    appTitle: 'สยามจังหวะ',
    appSubtitle: 'เกมดนตรีไทยจับจังหวะด้วยมือ',
    testSoundBtn: '🔊 ทดสอบเสียง',
    heroEyebrow: 'UNIVERSAL DESIGN FOR LEARNING • เล่นได้ทุกวัย',
    heroTitle: 'สัมผัสจังหวะดนตรีไทยด้วยสองมือของคุณ',
    heroDesc: 'ฝึกจังหวะและการประสานสัมพันธ์ของมือผ่านกล้องเว็บแคมแบบเรียลไทม์ ไม่ต้องติดตั้งโปรแกรม',
    selectInstrument: 'เลือกเครื่องดนตรี',
    ranatTitle: 'ระนาดเอก (Ranat Ek)',
    ranatDesc: 'ฝึกทำนองและการประสานมือ ตีลูกระนาดเสมือนตามโน้ตที่ตกลงมา',
    ranatTag: 'ทำนอง & ประสานสัมพันธ์',
    chingTitle: 'ฉิ่ง (Ching)',
    chingDesc: 'ฝึกจังหวะและสมาธิ ประกบฝ่ามือแล้วเปิดออก (ฉิ่ง) หรือประกบค้างสั้นๆ (ฉับ)',
    chingTag: 'จังหวะ & ความแม่นยำ',
    taphonTitle: 'ตะโพน / กลองไทย (Taphon)',
    taphonDesc: 'ตีด้วยความเร็วข้อมือ แยกโซนหน้ากลอง (ทุ่ม/ป๊ะ) และขอบกลอง (ติง/จ๊ะ)',
    taphonTag: 'จังหวะหน้าทับ & แรงตี',
    khluiTitle: 'ขลุ่ยเพียงออ (Khlui)',
    khluiDesc: 'กำหนดระดับเสียงไทย 5 เสียง (ด ร ม ซ ล) ด้วยจำนวนนิ้วที่ชู 1–5 นิ้ว',
    khluiTag: 'ทำนอง & ทักษะนิ้วมือ',
    trackingPointLabel: 'จุดตรวจจับมือ (ระนาดเอก):',
    landmarkFinger: 'ปลายนิ้วชี้ (แม่นยำ)',
    landmarkPalm: 'กลางฝ่ามือ (สบายมือ)',
    selectDifficulty: 'เลือกระดับความยาก',
    latencyTitle: 'ปรับชดเชยดีเลย์เสียง/ภาพ (Latency Offset)',
    latencyDesc: 'หากใช้ลำโพงบลูทูธหรือกล้องที่มีความหน่วง สามารถวัดอัตโนมัติหรือปรับละเอียดได้ ±200ms',
    openLatencyBtn: '⏱️ วัดดีเลย์อัตโนมัติ (8 จังหวะ)',
    latencyOffsetLabel: 'ค่าชดเชยปัจจุบัน:',
    resetLatencyBtn: 'รีเซ็ต',
    latencyModalEyebrow: 'AUDIO / INPUT SYNC',
    latencyModalTitle: 'วัดดีเลย์เสียงและจังหวะ (8 ครั้ง)',
    latencyModalDesc: 'ฟังเสียงเมโทรนอม แล้วแตะปุ่มด้านล่างหรือกด Spacebar ให้ตรงจังหวะ ระบบจะคำนวณค่ามัธยฐานเพื่อตัดค่าผิดปกติ',
    latencyTapIdle: 'กด "เริ่มวัดจังหวะ"',
    latencyTapReady: 'เตรียมฟังจังหวะนำ (2 ครั้ง)...',
    latencyTapNow: 'แตะตรงนี้ หรือกด Spacebar ตามจังหวะ!',
    latencyStartBtn: 'เริ่มวัดจังหวะ',
    latencyApplyBtn: 'บันทึกค่าชดเชย',
    closeBtn: 'ปิด',
    privacyNotice: '<strong>ความเป็นส่วนตัว 100%:</strong> ประมวลผลภาพและเสียงภายในเครื่องทั้งหมด ไม่มีฟอนต์ภายนอก ไม่มีการบันทึกหรืออัปโหลดวิดีโอ',
    startCameraBtn: 'เริ่มเล่นและเปิดกล้อง',
    keyboardModeBtn: '⌨️ เล่นด้วยคีย์บอร์ด',
    hudScore: 'คะแนน',
    hudCombo: 'คอมโบ',
    hudAccuracy: 'ความแม่นยำ',
    progressLabel: 'ความคืบหน้าของเพลง',
    canvasLabel: 'กระดานเกมดนตรีไทยจับจังหวะ แสดงโน้ตที่ตกลงมาและตำแหน่งมือแบบเรียลไทม์',
    pauseBtn: 'พัก',
    restartBtn: 'เริ่มใหม่',
    loadingTitle: 'กำลังเตรียมระบบตรวจจับมือ...',
    loadingModel: 'กำลังโหลดโมเดล AI (MediaPipe HandLandmarker)...',
    loadingCamera: 'กำลังขออนุญาตเปิดกล้องเว็บแคม (640x480)...',
    calibEyebrow: 'ตรวจสอบความพร้อมของมือ',
    calibTitleTwo: 'ยกมือทั้งสองข้างให้อยู่ในกรอบกล้อง',
    calibTitleOne: 'ยกมืออย่างน้อย 1 ข้างให้อยู่ในกรอบกล้อง (สำหรับขลุ่ย)',
    calibHint: 'ค้างไว้ 3 วินาทีเพื่อเริ่มเพลงอัตโนมัติ',
    handLeft: 'มือที่ 1',
    handRight: 'มือที่ 2',
    skipCalibBtn: 'ข้ามการตรวจสอบและเริ่มทันที',
    pausedTitle: 'หยุดพักชั่วคราว',
    resumeBtn: 'เล่นต่อ',
    backMenuBtn: 'กลับหน้าหลัก',
    summaryTitle: 'สรุปผลการเล่น',
    newBestBadge: '★ สถิติสูงสุดใหม่!',
    finalScore: 'คะแนนรวม',
    maxCombo: 'คอมโบสูงสุด',
    accuracyLabel: 'ความแม่นยำ',
    personalBestLabel: 'สถิติสูงสุด',
    judgePerfect: 'ยอดเยี่ยม',
    judgeGood: 'ดี',
    judgeMiss: 'พลาด',
    playAgainBtn: 'เล่นอีกครั้ง',
    nextLevelBtn: 'ระดับถัดไป',
    noBestYet: 'ยังไม่มีสถิติ',
    bestPrefix: 'สถิติสูงสุด',
    hintRanatCam: 'ตีมือลงด้านล่างเข้าหาลูกระนาดตามจังหวะโน้ต (วางมือเฉยๆ จะไม่ลั่น)',
    hintRanatKey: 'โหมดคีย์บอร์ด: กดปุ่ม A S D F G (และ H J สำหรับ 7 เสียง)',
    hintChingCam: 'ฉิ่ง (วงสีทอง): ประกบมือแล้วรีบเปิดออก • ฉับ (วงสีส้ม): ประกบค้างไว้ครู่หนึ่ง',
    hintChingKey: 'โหมดคีย์บอร์ด: กด C หรือ Space = ฉิ่ง (เปิด) • กด V หรือ Enter = ฉับ (ปิด)',
    hintTaphonCam: 'สะบัดข้อมือลงเข้าหาหน้ากลอง (ทุ่ม/ป๊ะ) หรือขอบกลอง (ติง/จ๊ะ) ตามจังหวะ',
    hintTaphonKey: 'โหมดคีย์บอร์ด: กด A (ติง) • S (ทุ่ม) • D (ป๊ะ) • F (จ๊ะ)',
    hintKhluiCam: 'ชูนิ้ว 1–5 นิ้วแทนระดับเสียง ด ร ม ซ ล ให้ตรงกับโน้ตที่ตกลงมา',
    hintKhluiKey: 'โหมดคีย์บอร์ด: กดเลข 1 (ด) • 2 (ร) • 3 (ม) • 4 (ซ) • 5 (ล)',
    gradeFeedback: {
      S: 'ยอดเยี่ยมไร้ที่ติ! คุณควบคุมจังหวะได้อย่างเป็นธรรมชาติ',
      A: 'เก่งมาก! จังหวะและการประสานมือแม่นยำชัดเจน',
      B: 'ทำได้ดีมาก! ลองฝึกอีกนิดเพื่อก้าวสู่ระดับ A และ S',
      C: 'เริ่มต้นได้ดี! ลองเล่นช้าลงหรือปรับตำแหน่งมือให้สบายขึ้น',
    },
    cameraError: 'ไม่สามารถเปิดกล้องเว็บแคมได้ กรุณาอนุญาตสิทธิ์กล้อง หรือเลือก "เล่นด้วยคีย์บอร์ด"',
  },
  en: {
    appTitle: 'Siam Rhythm',
    appSubtitle: 'Thai Traditional Music Rhythm',
    testSoundBtn: '🔊 Test Sound',
    heroEyebrow: 'UNIVERSAL DESIGN FOR LEARNING • ALL AGES',
    heroTitle: 'Play Thai Traditional Music With Your Hands',
    heroDesc: 'Practice rhythm and hand coordination via real-time webcam tracking. Zero installation, accessible for every generation.',
    selectInstrument: 'Select Instrument',
    ranatTitle: 'Ranat Ek (Thai Xylophone)',
    ranatDesc: 'Build melody & coordination by striking virtual wooden bars as notes fall.',
    ranatTag: 'Melody & Coordination',
    chingTitle: 'Ching (Thai Hand Cymbals)',
    chingDesc: 'Master tempo: bring palms together & open quickly (Ching), or hold briefly (Chab).',
    chingTag: 'Rhythm & Tempo',
    taphonTitle: 'Taphon (Thai Drum)',
    taphonDesc: 'Strike downward with wrist velocity across center heads (Thum/Pa) & rims (Ting/Ja).',
    taphonTag: 'Percussion & Zones',
    khluiTitle: 'Khlui (Thai Bamboo Flute)',
    khluiDesc: 'Play 5 Thai pentatonic tones (Do–La) by holding up 1 to 5 fingers.',
    khluiTag: 'Melody & Finger Control',
    trackingPointLabel: 'Ranat Tracking Point:',
    landmarkFinger: 'Index Fingertip (Precise)',
    landmarkPalm: 'Palm Center (Relaxed)',
    selectDifficulty: 'Select Difficulty',
    latencyTitle: 'Audio / Visual Latency Calibration',
    latencyDesc: 'Compensate for Bluetooth audio or webcam delay automatically or fine-tune ±200ms.',
    openLatencyBtn: '⏱️ Auto-Measure Delay (8 Beats)',
    latencyOffsetLabel: 'Current Offset:',
    resetLatencyBtn: 'Reset',
    latencyModalEyebrow: 'AUDIO / INPUT SYNC',
    latencyModalTitle: 'Measure Rhythm Latency (8 Beats)',
    latencyModalDesc: 'Listen to the metronome and tap the button below or press Spacebar on each beat. Outliers are filtered using the median.',
    latencyTapIdle: 'Click "Start Measurement"',
    latencyTapReady: 'Listen to 2 lead-in beats...',
    latencyTapNow: 'Tap Here or Press Spacebar On The Beat!',
    latencyStartBtn: 'Start Measurement',
    latencyApplyBtn: 'Save Offset',
    closeBtn: 'Close',
    privacyNotice: '<strong>100% Privacy-First:</strong> All processing runs locally on your device. No external fonts, no video recorded or uploaded.',
    startCameraBtn: 'Start & Enable Camera',
    keyboardModeBtn: '⌨️ Play with Keyboard',
    hudScore: 'Score',
    hudCombo: 'Combo',
    hudAccuracy: 'Accuracy',
    progressLabel: 'Song progress',
    canvasLabel: 'Thai traditional rhythm game stage showing falling notes and live hand tracking',
    pauseBtn: 'Pause',
    restartBtn: 'Restart',
    loadingTitle: 'Preparing Hand Tracking...',
    loadingModel: 'Loading MediaPipe HandLandmarker AI model...',
    loadingCamera: 'Requesting webcam access (640x480)...',
    calibEyebrow: 'HAND READINESS CHECK',
    calibTitleTwo: 'Raise Both Hands Into Camera View',
    calibTitleOne: 'Raise At Least 1 Hand Into Camera View (Khlui)',
    calibHint: 'Hold steady for 3 seconds to begin automatically',
    handLeft: 'Hand 1',
    handRight: 'Hand 2',
    skipCalibBtn: 'Skip Check & Start Now',
    pausedTitle: 'Paused',
    resumeBtn: 'Resume',
    backMenuBtn: 'Back to Menu',
    summaryTitle: 'Performance Summary',
    newBestBadge: '★ New Personal Best!',
    finalScore: 'Final Score',
    maxCombo: 'Max Combo',
    accuracyLabel: 'Accuracy',
    personalBestLabel: 'Personal Best',
    judgePerfect: 'Perfect',
    judgeGood: 'Good',
    judgeMiss: 'Miss',
    playAgainBtn: 'Play Again',
    nextLevelBtn: 'Next Level',
    noBestYet: 'No record yet',
    bestPrefix: 'Best',
    hintRanatCam: 'Strike downward onto the wooden bars as notes arrive (resting hands will not trigger)',
    hintRanatKey: 'Keyboard Mode: Press A S D F G (plus H J for 7-key levels)',
    hintChingCam: 'CHING (Gold Ring): Clap & open quickly • CHAB (Coral Disc): Clap & hold briefly',
    hintChingKey: 'Keyboard Mode: Press C / Space = Ching (Open) • V / Enter = Chab (Dampened)',
    hintTaphonCam: 'Strike downward with your wrists onto center heads (Thum/Pa) or rims (Ting/Ja)',
    hintTaphonKey: 'Keyboard Mode: Press A (Ting) • S (Thum) • D (Pa) • F (Ja)',
    hintKhluiCam: 'Hold up 1–5 fingers to play Do, Re, Mi, Sol, La as notes arrive',
    hintKhluiKey: 'Keyboard Mode: Press 1 (Do) • 2 (Re) • 3 (Mi) • 4 (Sol) • 5 (La)',
    gradeFeedback: {
      S: 'Masterful! Effortless Thai rhythmic flow and precision.',
      A: 'Excellent performance! Crisp timing and coordination.',
      B: 'Great job! A little more practice will unlock A or S rank.',
      C: 'Nice start! Try taking a relaxed posture or Beginner tempo.',
    },
    cameraError: 'Could not access webcam. Please allow camera permission or select "Play with Keyboard".',
  },
};

// ============================================================================
// Application State & Storage Helpers
// ============================================================================
function loadLatencyOffset() {
  try {
    const raw = localStorage.getItem(LATENCY_STORAGE_KEY);
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(-200, Math.min(200, Math.round(num))) : 0;
  } catch {
    return 0;
  }
}

function saveLatencyOffset(ms) {
  const clamped = Math.max(-200, Math.min(200, Math.round(ms)));
  try {
    localStorage.setItem(LATENCY_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
  return clamped;
}

const appState = {
  lang: 'th',
  instrument: 'ranat', // 'ranat' | 'ching' | 'taphon' | 'khlui'
  level: 1,
  landmarkIdx: 8,
  useCamera: true,
  latencyOffsetMs: loadLatencyOffset(),
};

const audioEngine = new ThaiAudioEngine();
const visionTracker = new HandVisionTracker();

// DOM References
const el = {
  screenSetup: document.getElementById('screen-setup'),
  screenGame: document.getElementById('screen-game'),
  screenSummary: document.getElementById('screen-summary'),

  langBtns: document.querySelectorAll('.lang-btn'),
  btnSoundTest: document.getElementById('btn-sound-test'),
  instrumentGroup: document.getElementById('instrument-group'),
  instrumentCards: document.querySelectorAll('[data-instrument]'),
  ranatOptions: document.getElementById('ranat-options'),
  landmarkGroup: document.getElementById('landmark-group'),
  landmarkBtns: document.querySelectorAll('[data-landmark]'),
  difficultyGrid: document.getElementById('difficulty-grid'),

  latencySlider: document.getElementById('latency-slider'),
  latencyValue: document.getElementById('latency-value'),
  btnResetLatency: document.getElementById('btn-reset-latency'),
  btnOpenLatency: document.getElementById('btn-open-latency'),

  modalLatency: document.getElementById('modal-latency'),
  latencyBeatDots: document.querySelectorAll('#latency-beat-dots .beat-dot'),
  btnLatencyTap: document.getElementById('btn-latency-tap'),
  latencyTapLabel: document.getElementById('latency-tap-label'),
  latencyResultText: document.getElementById('latency-result-text'),
  btnLatencyStart: document.getElementById('btn-latency-start'),
  btnLatencyApply: document.getElementById('btn-latency-apply'),
  btnLatencyClose: document.getElementById('btn-latency-close'),

  btnStartCamera: document.getElementById('btn-start-camera'),
  btnStartKeyboard: document.getElementById('btn-start-keyboard'),
  setupError: document.getElementById('setup-error'),

  video: document.getElementById('webcam-video'),
  canvas: document.getElementById('game-canvas'),
  hudSongTitle: document.getElementById('hud-song-title'),
  hudLevelBadge: document.getElementById('hud-level-badge'),
  hudScore: document.getElementById('hud-score'),
  hudCombo: document.getElementById('hud-combo'),
  hudMultiplier: document.getElementById('hud-multiplier'),
  hudAccuracy: document.getElementById('hud-accuracy'),
  hudProgressTrack: document.getElementById('hud-progress-track'),
  hudProgressFill: document.getElementById('hud-progress-fill'),
  gestureHintBar: document.getElementById('gesture-hint-bar'),

  overlayLoading: document.getElementById('overlay-loading'),
  loadingDetail: document.getElementById('loading-detail'),
  overlayCalibration: document.getElementById('overlay-calibration'),
  calibTitle: document.getElementById('calib-title'),
  statusHand1: document.getElementById('status-hand-1'),
  statusHand2: document.getElementById('status-hand-2'),
  calibRingProgress: document.getElementById('calib-ring-progress'),
  calibSeconds: document.getElementById('calib-seconds'),
  btnSkipCalib: document.getElementById('btn-skip-calib'),

  overlayPause: document.getElementById('overlay-pause'),
  btnExitGame: document.getElementById('btn-exit-game'),
  btnPauseGame: document.getElementById('btn-pause-game'),
  btnRestartGame: document.getElementById('btn-restart-game'),
  btnResumeGame: document.getElementById('btn-resume-game'),
  btnPauseRestart: document.getElementById('btn-pause-restart'),
  btnPauseMenu: document.getElementById('btn-pause-menu'),

  summarySongName: document.getElementById('summary-song-name'),
  summaryNewBest: document.getElementById('summary-new-best'),
  summaryGrade: document.getElementById('summary-grade'),
  summaryFeedback: document.getElementById('summary-feedback'),
  summaryScore: document.getElementById('summary-score'),
  summaryCombo: document.getElementById('summary-combo'),
  summaryAccuracy: document.getElementById('summary-accuracy'),
  summaryBest: document.getElementById('summary-best'),
  summaryPerfect: document.getElementById('summary-perfect'),
  summaryGood: document.getElementById('summary-good'),
  summaryMiss: document.getElementById('summary-miss'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  btnNextLevel: document.getElementById('btn-next-level'),
  btnSummaryMenu: document.getElementById('btn-summary-menu'),
};

// ============================================================================
// WCAG / ARIA Radiogroup Helper (Roving Tabindex + Arrow Keys)
// ============================================================================
function syncRadioGroupUI(container, activeNode) {
  const radios = Array.from(container.querySelectorAll('[role="radio"]'));
  radios.forEach((node) => {
    const isSelected = node === activeNode;
    node.classList.toggle('active', isSelected);
    node.setAttribute('aria-checked', String(isSelected));
    node.setAttribute('tabindex', isSelected ? '0' : '-1');
  });
}

function attachRadioArrowNavigation(container, onSelect) {
  container.addEventListener('keydown', (e) => {
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    if (radios.length === 0) return;

    const currentIdx = radios.indexOf(document.activeElement);
    if (currentIdx === -1) return;

    let nextIdx = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = (currentIdx + 1) % radios.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = (currentIdx - 1 + radios.length) % radios.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = radios.length - 1;
    }

    if (nextIdx !== -1) {
      e.preventDefault();
      const target = radios[nextIdx];
      syncRadioGroupUI(container, target);
      target.focus();
      onSelect(target);
    }
  });
}

// ============================================================================
// Personal Best Storage
// ============================================================================
function loadPersonalBests() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePersonalBest(beatmapId, result) {
  const store = loadPersonalBests();
  const prev = store[beatmapId];
  const isNewBest = !prev || result.score > prev.score;

  if (isNewBest) {
    store[beatmapId] = {
      score: result.score,
      accuracy: result.accuracy,
      grade: result.grade,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore private browsing storage errors
    }
  }
  return { isNewBest, bestScore: Math.max(result.score, prev?.score || 0) };
}

// ============================================================================
// Game Engine Instance
// ============================================================================
const gameEngine = new RhythmGameEngine({
  canvas: el.canvas,
  videoEl: el.video,
  audioEngine,
  visionTracker,
  callbacks: {
    onStateChange(newState) {
      el.overlayCalibration.classList.toggle('hidden', newState !== 'calibrating');
      el.overlayPause.classList.toggle('hidden', newState !== 'paused');
    },
    onCalibrationUpdate({ handsCount, requiredHands, progress, secondsLeft }) {
      el.statusHand1.classList.toggle('detected', handsCount >= 1);
      el.statusHand2.classList.toggle('hidden', requiredHands < 2);
      el.statusHand2.classList.toggle('detected', handsCount >= 2);
      el.calibTitle.textContent =
        requiredHands < 2 ? I18N[appState.lang].calibTitleOne : I18N[appState.lang].calibTitleTwo;

      const circumference = 264;
      el.calibRingProgress.style.strokeDashoffset = String(circumference * (1 - progress));
      el.calibSeconds.textContent = String(secondsLeft);
    },
    onHudUpdate({ score, combo, multiplier, accuracy, progressPct }) {
      const pctInt = Math.round(progressPct);
      el.hudScore.textContent = score.toLocaleString();
      el.hudCombo.textContent = String(combo);
      el.hudAccuracy.textContent = `${accuracy}%`;
      el.hudProgressFill.style.width = `${progressPct}%`;
      el.hudProgressTrack.setAttribute('aria-valuenow', String(pctInt));

      if (multiplier > 1) {
        el.hudMultiplier.textContent = `x${multiplier}`;
        el.hudMultiplier.classList.remove('hidden');
      } else {
        el.hudMultiplier.classList.add('hidden');
      }
    },
    onSongComplete(result) {
      showSummaryScreen(result);
    },
  },
});

// ============================================================================
// Audio / Visual Latency Calibration Modal (8-Beat Median Measurement)
// ============================================================================
const latencyCalib = {
  active: false,
  beatTimes: [],
  deltasMs: [],
  measuredOffsetMs: 0,
  rafId: null,
  leadInBeats: 2,
  totalBeats: 8,
  bpm: 90,
};

function updateLatencyUI(ms) {
  appState.latencyOffsetMs = saveLatencyOffset(ms);
  el.latencySlider.value = String(appState.latencyOffsetMs);
  const sign = appState.latencyOffsetMs > 0 ? '+' : '';
  el.latencyValue.textContent = `${sign}${appState.latencyOffsetMs} ms`;
  gameEngine.setLatencyOffsetMs(appState.latencyOffsetMs);
}

function computeMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stopLatencyCalibration() {
  latencyCalib.active = false;
  if (latencyCalib.rafId) {
    cancelAnimationFrame(latencyCalib.rafId);
    latencyCalib.rafId = null;
  }
  el.btnLatencyTap.disabled = true;
}

async function startLatencyCalibration() {
  // Explicitly unlock/resume AudioContext on user gesture
  await audioEngine.init();
  stopLatencyCalibration();

  const dict = I18N[appState.lang];
  const secPerBeat = 60 / latencyCalib.bpm;
  const startAudio = audioEngine.getCurrentTime() + 0.25;

  latencyCalib.active = true;
  latencyCalib.deltasMs = [];
  latencyCalib.beatTimes = [];

  el.latencyBeatDots.forEach((d) => d.classList.remove('active', 'recorded'));
  el.latencyResultText.textContent = '';
  el.btnLatencyApply.classList.add('hidden');
  el.btnLatencyStart.disabled = true;
  el.btnLatencyTap.disabled = false;
  el.latencyTapLabel.textContent = dict.latencyTapReady;

  // Schedule 2 lead-in beats + 8 measurement beats strictly on Web Audio clock
  const totalScheduled = latencyCalib.leadInBeats + latencyCalib.totalBeats;
  for (let i = 0; i < totalScheduled; i++) {
    const t = startAudio + i * secPerBeat;
    const isAccent = i >= latencyCalib.leadInBeats && (i - latencyCalib.leadInBeats) % 4 === 0;
    audioEngine.playMetronomeTick(t, isAccent);
    if (i >= latencyCalib.leadInBeats) {
      latencyCalib.beatTimes.push(t);
    }
  }

  const endTime = startAudio + totalScheduled * secPerBeat + 0.35;

  function tick() {
    if (!latencyCalib.active) return;
    const now = audioEngine.getCurrentTime();

    if (now >= latencyCalib.beatTimes[0] - 0.15) {
      el.latencyTapLabel.textContent = dict.latencyTapNow;
    }

    // Highlight current beat dot visually
    latencyCalib.beatTimes.forEach((bt, idx) => {
      const isCurrent = Math.abs(now - bt) < 0.12;
      el.latencyBeatDots[idx]?.classList.toggle('active', isCurrent);
    });

    if (now >= endTime) {
      finishLatencyCalibration();
      return;
    }
    latencyCalib.rafId = requestAnimationFrame(tick);
  }

  latencyCalib.rafId = requestAnimationFrame(tick);
}

function recordLatencyTap() {
  if (!latencyCalib.active) return;
  const tapTime = audioEngine.getCurrentTime();

  // Visual tap pulse
  el.btnLatencyTap.classList.add('tapped');
  setTimeout(() => el.btnLatencyTap.classList.remove('tapped'), 90);

  // Match tap to nearest scheduled measurement beat within ±300ms
  let bestIdx = -1;
  let bestDeltaSec = Infinity;
  latencyCalib.beatTimes.forEach((bt, idx) => {
    const diff = tapTime - bt;
    if (Math.abs(diff) < Math.abs(bestDeltaSec) && Math.abs(diff) <= 0.3) {
      bestDeltaSec = diff;
      bestIdx = idx;
    }
  });

  if (bestIdx !== -1) {
    latencyCalib.deltasMs.push(bestDeltaSec * 1000);
    el.latencyBeatDots[bestIdx]?.classList.add('recorded');
  }
}

function finishLatencyCalibration() {
  stopLatencyCalibration();
  el.btnLatencyStart.disabled = false;

  if (latencyCalib.deltasMs.length < 3) {
    el.latencyResultText.textContent =
      appState.lang === 'th'
        ? 'ได้ข้อมูลน้อยเกินไป กรุณาลองกดตามจังหวะใหม่อีกครั้ง'
        : 'Too few taps detected. Please try again on the beat.';
    return;
  }

  // Median filters out stray early/late outlier taps
  const medianMs = computeMedian(latencyCalib.deltasMs);
  const rounded = Math.max(-200, Math.min(200, Math.round(medianMs / 5) * 5));
  latencyCalib.measuredOffsetMs = rounded;

  const sign = rounded > 0 ? '+' : '';
  el.latencyResultText.textContent =
    appState.lang === 'th'
      ? `วัดได้ค่าชดเชย (มัธยฐาน): ${sign}${rounded} ms (จาก ${latencyCalib.deltasMs.length} ครั้ง)`
      : `Measured Offset (Median): ${sign}${rounded} ms (${latencyCalib.deltasMs.length} taps)`;
  el.btnLatencyApply.classList.remove('hidden');
}

// ============================================================================
// UI Rendering & i18n
// ============================================================================
function showScreen(name) {
  el.screenSetup.classList.toggle('active', name === 'setup');
  el.screenGame.classList.toggle('active', name === 'game');
  el.screenSummary.classList.toggle('active', name === 'summary');
}

function applyTranslations() {
  const dict = I18N[appState.lang];
  document.documentElement.lang = appState.lang;
  gameEngine.setLanguage(appState.lang);

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (dict[key] !== undefined) {
      if (key === 'privacyNotice') node.innerHTML = dict[key];
      else node.textContent = dict[key];
    }
  });

  el.hudProgressTrack.setAttribute('aria-label', dict.progressLabel);
  el.canvas.setAttribute('aria-label', dict.canvasLabel);

  renderDifficultyCards();
  updateGestureHint();
}

function renderDifficultyCards() {
  const dict = I18N[appState.lang];
  const bests = loadPersonalBests();
  el.difficultyGrid.innerHTML = '';

  for (const levelNum of [1, 2, 3]) {
    const cfg = DIFFICULTY_CONFIG[levelNum];
    const beatmap = getBeatmap(appState.instrument, levelNum);
    const best = bests[beatmap.id];
    const isActive = appState.level === levelNum;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `select-card diff-card${isActive ? ' active' : ''}`;
    btn.dataset.level = String(levelNum);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(isActive));
    btn.setAttribute('tabindex', isActive ? '0' : '-1');

    const descText = cfg.descriptions[appState.instrument]?.[appState.lang] || '';
    const bestText = best
      ? `<span>${dict.bestPrefix}: <strong>${best.score.toLocaleString()}</strong></span><span>Grade ${best.grade}</span>`
      : `<span>${dict.noBestYet}</span><span>—</span>`;

    btn.innerHTML = `
      <div class="diff-top">
        <span class="diff-badge lvl-${levelNum}">${cfg.badge[appState.lang]}</span>
        <span style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">${cfg.bpm} BPM</span>
      </div>
      <div class="diff-song">${beatmap.title[appState.lang]}</div>
      <ul class="diff-meta"><li>${descText}</li></ul>
      <div class="diff-best">${bestText}</div>
    `;

    btn.addEventListener('click', () => {
      appState.level = levelNum;
      syncRadioGroupUI(el.difficultyGrid, btn);
    });

    el.difficultyGrid.appendChild(btn);
  }
}

function updateGestureHint() {
  const dict = I18N[appState.lang];
  const map = {
    ranat: appState.useCamera ? dict.hintRanatCam : dict.hintRanatKey,
    ching: appState.useCamera ? dict.hintChingCam : dict.hintChingKey,
    taphon: appState.useCamera ? dict.hintTaphonCam : dict.hintTaphonKey,
    khlui: appState.useCamera ? dict.hintKhluiCam : dict.hintKhluiKey,
  };
  el.gestureHintBar.textContent = map[appState.instrument] || '';
}

// ============================================================================
// Start, Restart, Exit & Summary Flows
// ============================================================================
async function launchGame({ useCamera }) {
  el.setupError.classList.add('hidden');
  appState.useCamera = useCamera;

  // Always unlock/resume AudioContext directly inside the Start button click gesture
  await audioEngine.init();

  const beatmap = getBeatmap(appState.instrument, appState.level);
  const diffCfg = DIFFICULTY_CONFIG[appState.level];

  el.hudSongTitle.textContent = beatmap.title[appState.lang];
  el.hudLevelBadge.textContent = `${diffCfg.name[appState.lang]} • ${beatmap.bpm} BPM`;
  updateGestureHint();

  showScreen('game');
  gameEngine.resize();

  if (useCamera) {
    el.overlayLoading.classList.remove('hidden');
    try {
      await visionTracker.init(el.video, (status) => {
        const dict = I18N[appState.lang];
        el.loadingDetail.textContent =
          status === 'loadingModel' ? dict.loadingModel : dict.loadingCamera;
      });
    } catch (err) {
      console.error('Camera / MediaPipe initialization failed:', err);
      el.overlayLoading.classList.add('hidden');
      showScreen('setup');
      el.setupError.textContent = I18N[appState.lang].cameraError;
      el.setupError.classList.remove('hidden');
      return;
    }
    el.overlayLoading.classList.add('hidden');
  }

  gameEngine.startSession(beatmap, {
    useCamera,
    landmarkIdx: appState.landmarkIdx,
    latencyOffsetMs: appState.latencyOffsetMs,
  });
}

function showSummaryScreen(result) {
  const dict = I18N[appState.lang];
  const beatmap = getBeatmap(appState.instrument, appState.level);
  const { isNewBest, bestScore } = savePersonalBest(result.beatmapId, result);

  el.summarySongName.textContent = `${beatmap.title[appState.lang]} • ${DIFFICULTY_CONFIG[appState.level].name[appState.lang]}`;
  el.summaryNewBest.classList.toggle('hidden', !isNewBest);

  el.summaryGrade.textContent = result.grade;
  el.summaryGrade.className = `grade-medal grade-${result.grade}`;
  el.summaryFeedback.textContent = dict.gradeFeedback[result.grade];

  el.summaryScore.textContent = result.score.toLocaleString();
  el.summaryCombo.textContent = String(result.maxCombo);
  el.summaryAccuracy.textContent = `${result.accuracy}%`;
  el.summaryBest.textContent = bestScore.toLocaleString();

  el.summaryPerfect.textContent = String(result.perfect);
  el.summaryGood.textContent = String(result.good);
  el.summaryMiss.textContent = String(result.miss);

  el.btnNextLevel.classList.toggle('hidden', appState.level >= 3);

  showScreen('summary');
  renderDifficultyCards();
}

function exitToMenu() {
  gameEngine.stop();
  visionTracker.stopCamera();
  el.overlayLoading.classList.add('hidden');
  el.overlayCalibration.classList.add('hidden');
  el.overlayPause.classList.add('hidden');
  showScreen('setup');
  renderDifficultyCards();
}

// ============================================================================
// Event Listeners
// ============================================================================
el.langBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    appState.lang = btn.dataset.lang;
    el.langBtns.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    applyTranslations();
  });
});

// Instrument ARIA radiogroup (click + arrow keys)
function selectInstrumentNode(card) {
  appState.instrument = card.dataset.instrument;
  syncRadioGroupUI(el.instrumentGroup, card);
  el.ranatOptions.classList.toggle('hidden', appState.instrument !== 'ranat');
  renderDifficultyCards();
}
el.instrumentCards.forEach((card) => {
  card.addEventListener('click', () => selectInstrumentNode(card));
});
attachRadioArrowNavigation(el.instrumentGroup, selectInstrumentNode);

// Landmark ARIA radiogroup (click + arrow keys)
function selectLandmarkNode(btn) {
  appState.landmarkIdx = Number(btn.dataset.landmark);
  syncRadioGroupUI(el.landmarkGroup, btn);
  gameEngine.setLandmarkIndex(appState.landmarkIdx);
}
el.landmarkBtns.forEach((btn) => {
  btn.addEventListener('click', () => selectLandmarkNode(btn));
});
attachRadioArrowNavigation(el.landmarkGroup, selectLandmarkNode);

// Difficulty ARIA radiogroup arrow keys
attachRadioArrowNavigation(el.difficultyGrid, (card) => {
  appState.level = Number(card.dataset.level);
});

// Latency Slider & Modal Listeners
el.latencySlider.addEventListener('input', (e) => updateLatencyUI(e.target.value));
el.btnResetLatency.addEventListener('click', () => updateLatencyUI(0));
el.btnOpenLatency.addEventListener('click', () => {
  el.modalLatency.classList.remove('hidden');
  el.latencyResultText.textContent = '';
  el.btnLatencyApply.classList.add('hidden');
  el.latencyTapLabel.textContent = I18N[appState.lang].latencyTapIdle;
});
el.btnLatencyStart.addEventListener('click', startLatencyCalibration);
el.btnLatencyTap.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  recordLatencyTap();
});
el.btnLatencyApply.addEventListener('click', () => {
  updateLatencyUI(latencyCalib.measuredOffsetMs);
  stopLatencyCalibration();
  el.modalLatency.classList.add('hidden');
});
el.btnLatencyClose.addEventListener('click', () => {
  stopLatencyCalibration();
  el.modalLatency.classList.add('hidden');
});

// Sound Test Button (Unlocks AudioContext + Demos selected Thai instrument)
el.btnSoundTest.addEventListener('click', async () => {
  await audioEngine.init();
  if (appState.instrument === 'ranat') {
    [523.25, 587.33, 659.25, 783.99, 880.0].forEach((f, i) => {
      setTimeout(() => audioEngine.playRanat(f, '', 0.85), i * 125);
    });
  } else if (appState.instrument === 'ching') {
    audioEngine.playChing();
    setTimeout(() => audioEngine.playChab(), 520);
  } else if (appState.instrument === 'taphon') {
    ['ting', 'thum', 'pa', 'ja'].forEach((zone, i) => {
      setTimeout(() => audioEngine.playTaphon(zone, 0.9), i * 180);
    });
  } else if (appState.instrument === 'khlui') {
    [523.25, 659.25, 783.99, 880.0].forEach((f, i) => {
      setTimeout(() => audioEngine.playKhlui(f, 0.35), i * 260);
    });
  }
});

el.btnStartCamera.addEventListener('click', () => launchGame({ useCamera: true }));
el.btnStartKeyboard.addEventListener('click', () => launchGame({ useCamera: false }));

el.btnSkipCalib.addEventListener('click', () => gameEngine.beginSongPlayback());
el.btnExitGame.addEventListener('click', exitToMenu);
el.btnPauseGame.addEventListener('click', () => gameEngine.pause());
el.btnResumeGame.addEventListener('click', () => gameEngine.resume());

function restartCurrentSong() {
  const beatmap = getBeatmap(appState.instrument, appState.level);
  gameEngine.startSession(beatmap, {
    useCamera: appState.useCamera,
    landmarkIdx: appState.landmarkIdx,
    latencyOffsetMs: appState.latencyOffsetMs,
  });
}
el.btnRestartGame.addEventListener('click', restartCurrentSong);
el.btnPauseRestart.addEventListener('click', restartCurrentSong);
el.btnPauseMenu.addEventListener('click', exitToMenu);

el.btnPlayAgain.addEventListener('click', () => launchGame({ useCamera: appState.useCamera }));
el.btnNextLevel.addEventListener('click', () => {
  appState.level = Math.min(3, appState.level + 1);
  launchGame({ useCamera: appState.useCamera });
});
el.btnSummaryMenu.addEventListener('click', exitToMenu);

// Global Keyboard Handler (Latency Modal Spacebar + Pause + Accessible Play Mode)
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();

  // Handle Spacebar inside Latency Calibration Modal
  if (!el.modalLatency.classList.contains('hidden')) {
    if (key === ' ' && latencyCalib.active) {
      e.preventDefault();
      recordLatencyTap();
    } else if (key === 'escape') {
      stopLatencyCalibration();
      el.modalLatency.classList.add('hidden');
    }
    return;
  }

  if (key === 'escape') {
    if (gameEngine.state === 'playing') gameEngine.pause();
    else if (gameEngine.state === 'paused') gameEngine.resume();
    return;
  }

  if (gameEngine.state === 'playing') {
    if (key === ' ') e.preventDefault();
    gameEngine.handleKeyInput(key);
  }
});

// Register Classroom Offline PWA Service Worker (http/https only)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Non-fatal if SW registration is blocked in embedded previews
    });
  });
}

// Initial Setup Render
updateLatencyUI(appState.latencyOffsetMs);
applyTranslations();
