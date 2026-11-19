/**
 * ============================================================================
 * js/main.js — Application Controller, WCAG Focus Trap, Dual Latency Sync & PWA
 * ============================================================================
 * - Valid HTML5 phrasing content inside <button> radio cards
 * - Full TH/EN i18n for text, aria-label (data-i18n-aria), and slider aria-valuetext
 * - Focus trap + Escape close + focus restoration for all aria-modal dialogs
 * - Separate latency offsets for Camera (hand-clap) vs Keyboard/Touch (tap/Space)
 *   measured against `audioEngine.getOutputClockTime()` with median outlier filtering
 */

import { ThaiAudioEngine } from './audio.js';
import { HandVisionTracker } from './vision.js';
import { RhythmGameEngine } from './gameEngine.js';
import {
  DIFFICULTY_CONFIG,
  TAPHON_ZONES,
  KHLUI_NOTES,
  getBeatmap,
  getBeatmapsFor,
  getBeatmapById,
  thai7TetFreq,
} from './beatmaps.js';

const STORAGE_KEY = 'siam_rhythm_personal_bests_v1';
const LATENCY_STORAGE_KEY = 'siam_rhythm_latency_offsets_v2';

// ============================================================================
// Bilingual Dictionary (Thai / English)
// ============================================================================
const I18N = {
  th: {
    appTitle: 'สยามจังหวะ',
    appSubtitle: 'เกมดนตรีไทยจับจังหวะด้วยมือ',
    testSoundBtn: '🔊 ทดสอบเสียง',
    testSoundAria: 'ทดสอบเสียงเครื่องดนตรี',
    langGroupAria: 'สลับภาษา',
    heroEyebrow: 'UNIVERSAL DESIGN FOR LEARNING • เล่นได้ทุกวัย',
    heroTitle: 'สัมผัสจังหวะดนตรีไทยด้วยสองมือของคุณ',
    heroDesc: 'ฝึกจังหวะและการประสานสัมพันธ์ของมือผ่านกล้องเว็บแคม ปุ่มสัมผัส หรือคีย์บอร์ด เล่นได้ทุกวัยไม่ต้องติดตั้ง',
    quickStartCamBtn: 'เริ่มเล่นทันที (เปิดกล้อง)',
    quickStartTouchBtn: '⌨️ เล่นทันทีด้วยสัมผัส / คีย์บอร์ด',
    switchTouchNowBtn: '⌨️ สลับไปเล่นด้วยสัมผัส / คีย์บอร์ดทันที',
    oneHandModeLabel: 'โหมดมือเดียว (ไม่บังคับยกสองมือ เหมาะสำหรับผู้สูงอายุ/ผู้ถนัดมือเดียว)',
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
    selectDifficulty: 'เลือกระดับความยากและเพลง',
    selectSongLabel: 'เลือกเพลงในระดับนี้:',
    songsCountUnit: 'เพลง',
    latencySummaryTitle: 'ตั้งค่าขั้นสูง: ปรับชดเชยดีเลย์เสียง/ภาพ (ถ้าจังหวะไม่ตรง)',
    latencyTitle: 'ปรับชดเชยดีเลย์เสียง/ภาพ (แยกโหมดกล้องและคีย์บอร์ด)',
    latencyDesc: 'โหมดกล้องมีความหน่วงจากการประมวลผลภาพต่างจากคีย์บอร์ด สามารถวัดและเก็บค่าชดเชยแยกกันได้ (±200ms)',
    openLatencyBtn: '⏱️ วัดดีเลย์อัตโนมัติ (8 จังหวะ)',
    latencyModeLabel: 'โหมดที่กำลังปรับค่าชดเชย:',
    latencyModeCamera: '📷 โหมดกล้อง',
    latencyModeKeyboard: '⌨️ โหมดคีย์บอร์ด',
    latencyOffsetLabel: 'ค่าชดเชยปัจจุบัน:',
    resetLatencyBtn: 'รีเซ็ต',
    latencyModalEyebrow: 'AUDIO / INPUT SYNC',
    latencyModalTitle: 'วัดดีเลย์เสียงและจังหวะ (8 ครั้ง)',
    latencyModalDesc: 'เลือกวิธีวัด (แตะ/Spacebar หรือประกบมือหน้ากล้องจริง) แล้วทำตามเสียงเมโทรนอม 8 ครั้ง',
    calibByKey: '⌨️ แตะ / Spacebar',
    calibByCam: '📷 ประกบมือหน้ากล้อง',
    latencyTapIdle: 'กด "เริ่มวัดจังหวะ"',
    latencyTapReady: 'เตรียมฟังจังหวะนำ (2 ครั้ง)...',
    latencyTapNowKey: 'แตะตรงนี้ หรือกด Spacebar ตามจังหวะ!',
    latencyTapNowCam: 'ประกบมือทั้งสองข้างหน้ากล้องตามจังหวะ!',
    latencyStartBtn: 'เริ่มวัดจังหวะ',
    latencyApplyBtn: 'บันทึกค่าชดเชย',
    skipKeepLatencyBtn: 'ข้าม / ใช้ค่าเดิม',
    closeBtn: 'ปิด',
    privacyNotice: '<strong>ความเป็นส่วนตัวของกล้อง:</strong> ภาพจากเว็บแคมประมวลผลในเครื่อง 100% ไม่มีการบันทึกหรือส่งวิดีโอออกนอกเครื่อง (โหลดโมเดล AI จาก CDN ครั้งแรกแล้วแคชไว้เล่นออฟไลน์ในเบราว์เซอร์)',
    startCameraBtn: 'เริ่มเล่นและเปิดกล้อง',
    keyboardModeBtn: '⌨️ เล่นด้วยสัมผัส / คีย์บอร์ด',
    touchPadAria: 'แผงปุ่มสัมผัสเล่นดนตรี',
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
    loadingSlowTip: 'การโหลดโมเดลใช้เวลานานกว่าปกติ คุณสามารถสลับไปเล่นด้วยปุ่มสัมผัสหรือคีย์บอร์ดได้ทันที',
    calibEyebrow: 'ตรวจสอบความพร้อมของมือ',
    calibTitleTwo: 'ยกมือทั้งสองข้างให้อยู่ในกรอบกล้อง',
    calibTitleOne: 'ยกมืออย่างน้อย 1 ข้างให้อยู่ในกรอบกล้อง',
    calibHint: 'ค้างไว้ 3 วินาทีเพื่อเริ่มเพลงอัตโนมัติ หรือกดเริ่มทันที',
    handLeft: 'มือที่ 1',
    handRight: 'มือที่ 2',
    skipCalibBtn: '▶ เริ่มเล่นทันที',
    pausedTitle: 'หยุดพักชั่วคราว',
    resumeBtn: 'เล่นต่อ',
    backMenuBtn: 'กลับหน้าหลัก',
    changeSongBtn: 'เปลี่ยนเพลง / หน้าหลัก',
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
    testSoundAria: 'Test instrument sound',
    langGroupAria: 'Language switcher',
    heroEyebrow: 'UNIVERSAL DESIGN FOR LEARNING • ALL AGES',
    heroTitle: 'Play Thai Traditional Music With Your Hands',
    heroDesc: 'Practice rhythm and hand coordination via webcam, touch pads, or keyboard. Zero installation, accessible for every generation.',
    quickStartCamBtn: 'Quick Start (Camera)',
    quickStartTouchBtn: '⌨️ Quick Start (Touch / Keyboard)',
    switchTouchNowBtn: '⌨️ Switch to Touch / Keyboard Now',
    oneHandModeLabel: 'One-Hand Mode (no two-hand check — great for seniors or one-handed play)',
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
    selectDifficulty: 'Select Difficulty & Song',
    selectSongLabel: 'Select Song in This Level:',
    songsCountUnit: 'songs',
    latencySummaryTitle: 'Advanced: Audio / Visual Latency Calibration (Optional)',
    latencyTitle: 'Audio / Visual Latency Calibration (Camera vs Keyboard)',
    latencyDesc: 'Camera processing adds delay compared to keyboard input. Measure and store separate offsets (±200ms).',
    openLatencyBtn: '⏱️ Auto-Measure Delay (8 Beats)',
    latencyModeLabel: 'Offset Profile:',
    latencyModeCamera: '📷 Camera Mode',
    latencyModeKeyboard: '⌨️ Keyboard Mode',
    latencyOffsetLabel: 'Current Offset:',
    resetLatencyBtn: 'Reset',
    latencyModalEyebrow: 'AUDIO / INPUT SYNC',
    latencyModalTitle: 'Measure Rhythm Latency (8 Beats)',
    latencyModalDesc: 'Choose tap/Spacebar or real webcam hand-claps, then match the 8 metronome beats.',
    calibByKey: '⌨️ Tap / Spacebar',
    calibByCam: '📷 Webcam Hand-Clap',
    latencyTapIdle: 'Click "Start Measurement"',
    latencyTapReady: 'Listen to 2 lead-in beats...',
    latencyTapNowKey: 'Tap Here or Press Spacebar On The Beat!',
    latencyTapNowCam: 'Clap Both Palms In Front of Camera On The Beat!',
    latencyStartBtn: 'Start Measurement',
    latencyApplyBtn: 'Save Offset',
    skipKeepLatencyBtn: 'Skip / Keep Current',
    closeBtn: 'Close',
    privacyNotice: '<strong>Camera Privacy:</strong> Webcam video is processed 100% locally and never recorded or uploaded. The AI model is fetched once from CDN and cached offline in your browser.',
    startCameraBtn: 'Start & Enable Camera',
    keyboardModeBtn: '⌨️ Play with Touch / Keyboard',
    touchPadAria: 'On-screen musical touch pad',
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
    loadingSlowTip: 'Loading is taking longer than usual. You can switch to Touch or Keyboard mode immediately.',
    calibEyebrow: 'HAND READINESS CHECK',
    calibTitleTwo: 'Raise Both Hands Into Camera View',
    calibTitleOne: 'Raise At Least 1 Hand Into Camera View',
    calibHint: 'Hold steady for 3 seconds to begin, or press Start Now',
    handLeft: 'Hand 1',
    handRight: 'Hand 2',
    skipCalibBtn: '▶ Start Now',
    pausedTitle: 'Paused',
    resumeBtn: 'Resume',
    backMenuBtn: 'Back to Menu',
    changeSongBtn: 'Change Song / Menu',
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
// Dual Latency Storage (Separate Camera vs Keyboard Offsets)
// ============================================================================
function clampOffset(ms) {
  const num = Number(ms);
  return Number.isFinite(num) ? Math.max(-200, Math.min(200, Math.round(num))) : 0;
}

function loadLatencyOffsets() {
  try {
    const raw = JSON.parse(localStorage.getItem(LATENCY_STORAGE_KEY) || '{}');
    return {
      camera: clampOffset(raw.camera ?? 0),
      keyboard: clampOffset(raw.keyboard ?? 0),
    };
  } catch {
    return { camera: 0, keyboard: 0 };
  }
}

function saveLatencyOffsets(offsets) {
  const clean = {
    camera: clampOffset(offsets.camera),
    keyboard: clampOffset(offsets.keyboard),
  };
  try {
    localStorage.setItem(LATENCY_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota / private mode errors
  }
  return clean;
}

const appState = {
  lang: 'th',
  instrument: 'ranat',
  level: 1,
  beatmapId: 'ranat-lvl1-chang',
  oneHandMode: false,
  landmarkIdx: 8,
  useCamera: true,
  latencyProfile: 'camera', // Active profile shown in Setup slider ('camera' | 'keyboard')
  latencyOffsets: loadLatencyOffsets(),
};

const audioEngine = new ThaiAudioEngine();
const visionTracker = new HandVisionTracker();

// DOM References
const el = {
  srLiveFeedback: document.getElementById('sr-live-feedback'),
  screenSetup: document.getElementById('screen-setup'),
  screenGame: document.getElementById('screen-game'),
  screenSummary: document.getElementById('screen-summary'),

  btnQuickStartCam: document.getElementById('btn-quick-start-cam'),
  btnQuickStartTouch: document.getElementById('btn-quick-start-touch'),
  quickStartSummary: document.getElementById('quick-start-summary'),
  setupErrorBox: document.getElementById('setup-error-box'),
  btnErrorFallbackTouch: document.getElementById('btn-error-fallback-touch'),
  toggleOneHand: document.getElementById('toggle-one-hand'),

  langBtns: document.querySelectorAll('.lang-btn'),
  btnSoundTest: document.getElementById('btn-sound-test'),
  instrumentGroup: document.getElementById('instrument-group'),
  instrumentCards: document.querySelectorAll('[data-instrument]'),
  ranatOptions: document.getElementById('ranat-options'),
  landmarkGroup: document.getElementById('landmark-group'),
  landmarkBtns: document.querySelectorAll('[data-landmark]'),
  difficultyGrid: document.getElementById('difficulty-grid'),
  songList: document.getElementById('song-list'),

  latencySummaryBadge: document.getElementById('latency-summary-badge'),
  latencyModeGroup: document.getElementById('latency-mode-group'),
  latencyModeBtns: document.querySelectorAll('[data-latency-mode]'),
  latencySlider: document.getElementById('latency-slider'),
  latencyValue: document.getElementById('latency-value'),
  btnResetLatency: document.getElementById('btn-reset-latency'),
  btnOpenLatency: document.getElementById('btn-open-latency'),

  modalLatency: document.getElementById('modal-latency'),
  modalCalibModeGroup: document.getElementById('modal-calib-mode-group'),
  modalCalibModeBtns: document.querySelectorAll('[data-calib-input]'),
  latencyBeatDots: document.querySelectorAll('#latency-beat-dots .beat-dot'),
  btnLatencyTap: document.getElementById('btn-latency-tap'),
  latencyTapLabel: document.getElementById('latency-tap-label'),
  latencyResultText: document.getElementById('latency-result-text'),
  latencyExplainText: document.getElementById('latency-explain-text'),
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
  touchPadBar: document.getElementById('touch-pad-bar'),

  overlayLoading: document.getElementById('overlay-loading'),
  loadingDetail: document.getElementById('loading-detail'),
  loadingSlowTip: document.getElementById('loading-slow-tip'),
  btnLoadingFallbackTouch: document.getElementById('btn-loading-fallback-touch'),
  btnLoadingCancel: document.getElementById('btn-loading-cancel'),
  overlayCalibration: document.getElementById('overlay-calibration'),
  calibTitle: document.getElementById('calib-title'),
  statusHand1: document.getElementById('status-hand-1'),
  statusHand2: document.getElementById('status-hand-2'),
  calibRingProgress: document.getElementById('calib-ring-progress'),
  calibSeconds: document.getElementById('calib-seconds'),
  btnSkipCalib: document.getElementById('btn-skip-calib'),
  btnCalibSwitchTouch: document.getElementById('btn-calib-switch-touch'),

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
// WCAG Focus Trap & Modal Return-Focus Manager
// ============================================================================
const modalFocusState = {
  activeModal: null,
  previousFocus: null,
};

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]):not(.hidden), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((node) => node.offsetParent !== null);
}

function openModalDialog(modalEl, triggerEl = document.activeElement) {
  modalFocusState.previousFocus = triggerEl;
  modalFocusState.activeModal = modalEl;
  modalEl.classList.remove('hidden');

  const focusables = getFocusableElements(modalEl);
  if (focusables.length > 0) {
    focusables[0].focus();
  }
}

function closeModalDialog(modalEl) {
  modalEl.classList.add('hidden');
  if (modalFocusState.activeModal === modalEl) {
    modalFocusState.activeModal = null;
    if (modalFocusState.previousFocus && typeof modalFocusState.previousFocus.focus === 'function') {
      modalFocusState.previousFocus.focus();
    }
    modalFocusState.previousFocus = null;
  }
}

// Trap Tab / Shift+Tab inside any open aria-modal dialog
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !modalFocusState.activeModal) return;
  const focusables = getFocusableElements(modalFocusState.activeModal);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

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
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (currentIdx + 1) % radios.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (currentIdx - 1 + radios.length) % radios.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = radios.length - 1;

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

function announceSR(message) {
  if (!el.srLiveFeedback || !message) return;
  if (el.srLiveFeedback.textContent === message) {
    el.srLiveFeedback.textContent = '';
    requestAnimationFrame(() => {
      el.srLiveFeedback.textContent = message;
    });
  } else {
    el.srLiveFeedback.textContent = message;
  }
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
      if (newState === 'playing' || newState === 'calibrating') {
        acquireWakeLock();
      } else {
        releaseWakeLock();
      }
      if (newState === 'playing') {
        announceSR(appState.lang === 'th' ? 'เริ่มเพลงแล้ว' : 'Song started');
      } else if (newState === 'paused') {
        openModalDialog(el.overlayPause, el.btnPauseGame);
        announceSR(appState.lang === 'th' ? 'หยุดพักเกม' : 'Game paused');
      } else if (!el.overlayPause.classList.contains('hidden')) {
        closeModalDialog(el.overlayPause);
      }
    },
    onComboMilestone(combo) {
      announceSR(appState.lang === 'th' ? `คอมโบ ${combo} ครั้งต่อเนื่อง` : `${combo} combo streak`);
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
// Dual Latency Calibration (Keyboard Tap/Space OR Real Webcam Hand-Clap)
// ============================================================================
const latencyCalib = {
  active: false,
  inputMode: 'keyboard', // 'keyboard' | 'camera'
  beatTimes: [],
  deltasMs: [],
  measuredOffsetMs: 0,
  rafId: null,
  leadInBeats: 2,
  totalBeats: 8,
  bpm: 90,
  prevHandsClosed: false,
  lastClapPerfMs: 0,
};

function formatLatencyAriaValueText(ms) {
  if (appState.lang === 'th') {
    if (ms === 0) return '0 มิลลิวินาที (ไม่ชดเชย)';
    return ms > 0 ? `ช้ากว่า ${ms} มิลลิวินาที` : `เร็วกว่า ${Math.abs(ms)} มิลลิวินาที`;
  }
  if (ms === 0) return '0 milliseconds (no offset)';
  return ms > 0 ? `${ms} milliseconds late` : `${Math.abs(ms)} milliseconds early`;
}

function updateLatencyUI(ms, profile = appState.latencyProfile) {
  appState.latencyOffsets[profile] = clampOffset(ms);
  appState.latencyOffsets = saveLatencyOffsets(appState.latencyOffsets);

  const shownMs = appState.latencyOffsets[appState.latencyProfile];
  el.latencySlider.value = String(shownMs);
  el.latencySlider.setAttribute('aria-valuetext', formatLatencyAriaValueText(shownMs));

  const sign = shownMs > 0 ? '+' : '';
  el.latencyValue.textContent = `${sign}${shownMs} ms`;

  if (el.latencySummaryBadge) {
    const cSign = appState.latencyOffsets.camera > 0 ? '+' : '';
    const kSign = appState.latencyOffsets.keyboard > 0 ? '+' : '';
    el.latencySummaryBadge.textContent = `📷 ${cSign}${appState.latencyOffsets.camera} ms • ⌨️ ${kSign}${appState.latencyOffsets.keyboard} ms`;
  }

  // Keep engine synced to whichever mode is currently active
  const activeOffset = appState.useCamera
    ? appState.latencyOffsets.camera
    : appState.latencyOffsets.keyboard;
  gameEngine.setLatencyOffsetMs(activeOffset);
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
  await audioEngine.init();
  stopLatencyCalibration();

  const dict = I18N[appState.lang];

  // If measuring real webcam hand-clap latency, initialize camera & MediaPipe first
  if (latencyCalib.inputMode === 'camera') {
    el.latencyTapLabel.textContent = dict.loadingModel;
    try {
      await visionTracker.init(el.video);
    } catch {
      el.latencyResultText.textContent = dict.cameraError;
      return;
    }
  }

  const secPerBeat = 60 / latencyCalib.bpm;
  // Anchor scheduled beats to speaker-output-aligned clock
  const startAudio = audioEngine.getOutputClockTime() + 0.3;

  latencyCalib.active = true;
  latencyCalib.deltasMs = [];
  latencyCalib.beatTimes = [];
  latencyCalib.prevHandsClosed = false;
  latencyCalib.lastClapPerfMs = 0;

  el.latencyBeatDots.forEach((d) => d.classList.remove('active', 'recorded'));
  el.latencyResultText.textContent = '';
  if (el.latencyExplainText) el.latencyExplainText.textContent = '';
  el.btnLatencyApply.classList.add('hidden');
  el.btnLatencyStart.disabled = true;
  el.btnLatencyTap.disabled = latencyCalib.inputMode === 'camera';
  el.latencyTapLabel.textContent = dict.latencyTapReady;

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

  function tick(nowMs) {
    if (!latencyCalib.active) return;
    const nowAudio = audioEngine.getOutputClockTime();

    if (nowAudio >= latencyCalib.beatTimes[0] - 0.15) {
      el.latencyTapLabel.textContent =
        latencyCalib.inputMode === 'camera' ? dict.latencyTapNowCam : dict.latencyTapNowKey;
    }

    // In webcam calibration mode, detect real palm-clap contact via MediaPipe
    if (latencyCalib.inputMode === 'camera' && visionTracker.isReady) {
      visionTracker.detect(nowMs);
      if (visionTracker.hands.length >= 2) {
        const h1 = visionTracker.hands[0];
        const h2 = visionTracker.hands[1];
        const palmDist = Math.hypot(h1.palmCenter.x - h2.palmCenter.x, h1.palmCenter.y - h2.palmCenter.y);
        const normDist = palmDist / ((h1.handSize + h2.handSize) / 2);
        const closed = normDist < visionTracker.CHING_CLOSE_THRESH;

        if (closed && !latencyCalib.prevHandsClosed && nowMs - latencyCalib.lastClapPerfMs > 220) {
          latencyCalib.lastClapPerfMs = nowMs;
          recordLatencySample(nowAudio);
        }
        latencyCalib.prevHandsClosed = closed;
      }
    }

    latencyCalib.beatTimes.forEach((bt, idx) => {
      const isCurrent = Math.abs(nowAudio - bt) < 0.12;
      el.latencyBeatDots[idx]?.classList.toggle('active', isCurrent);
    });

    if (nowAudio >= endTime) {
      finishLatencyCalibration();
      return;
    }
    latencyCalib.rafId = requestAnimationFrame(tick);
  }

  latencyCalib.rafId = requestAnimationFrame(tick);
}

function recordLatencySample(sampleAudioTime = audioEngine.getOutputClockTime()) {
  if (!latencyCalib.active) return;

  el.btnLatencyTap.classList.add('tapped');
  setTimeout(() => el.btnLatencyTap.classList.remove('tapped'), 90);

  let bestIdx = -1;
  let bestDeltaSec = Infinity;
  latencyCalib.beatTimes.forEach((bt, idx) => {
    const diff = sampleAudioTime - bt;
    if (Math.abs(diff) < Math.abs(bestDeltaSec) && Math.abs(diff) <= 0.32) {
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
        ? 'ได้ข้อมูลน้อยเกินไป กรุณาลองทำตามจังหวะใหม่อีกครั้ง'
        : 'Too few inputs detected. Please try again on the beat.';
    return;
  }

  const medianMs = computeMedian(latencyCalib.deltasMs);
  const rounded = Math.max(-200, Math.min(200, Math.round(medianMs / 5) * 5));
  latencyCalib.measuredOffsetMs = rounded;

  const sign = rounded > 0 ? '+' : '';
  const modeLabel =
    latencyCalib.inputMode === 'camera'
      ? I18N[appState.lang].latencyModeCamera
      : I18N[appState.lang].latencyModeKeyboard;

  el.latencyResultText.textContent =
    appState.lang === 'th'
      ? `${modeLabel} — ค่ามัธยฐาน: ${sign}${rounded} ms (จาก ${latencyCalib.deltasMs.length} ครั้ง)`
      : `${modeLabel} — Median Offset: ${sign}${rounded} ms (${latencyCalib.deltasMs.length} samples)`;

  if (el.latencyExplainText) {
    if (rounded === 0) {
      el.latencyExplainText.textContent =
        appState.lang === 'th'
          ? 'จังหวะภาพและเสียงตรงกันพอดี ไม่ต้องเลื่อนชดเชย'
          : 'Audio and input are already perfectly aligned.';
    } else if (rounded > 0) {
      el.latencyExplainText.textContent =
        appState.lang === 'th'
          ? `ระบบจะเลื่อนการรับจังหวะช้าลง ${rounded} ms เพื่อให้ตรงกับเสียงที่คุณได้ยิน`
          : `Hit detection shifts ${rounded} ms later to match the audio you hear.`;
    } else {
      el.latencyExplainText.textContent =
        appState.lang === 'th'
          ? `ระบบจะเลื่อนการรับจังหวะเร็วขึ้น ${Math.abs(rounded)} ms เพื่อให้ตรงกับเสียงที่คุณได้ยิน`
          : `Hit detection shifts ${Math.abs(rounded)} ms earlier to match the audio you hear.`;
    }
  }
  el.btnLatencyApply.classList.remove('hidden');
}

// ============================================================================
// UI Rendering & Full Bilingual i18n (Text + ARIA Labels)
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

  // Dynamically translate ALL aria-label attributes (no hardcoded Thai left behind in EN)
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    const key = node.dataset.i18nAria;
    if (dict[key] !== undefined) {
      node.setAttribute('aria-label', dict[key]);
    }
  });

  updateLatencyUI(appState.latencyOffsets[appState.latencyProfile], appState.latencyProfile);
  renderDifficultyCards();
  updateGestureHint();
  renderTouchPad();
}

function getActiveBeatmap() {
  const candidates = getBeatmapsFor(appState.instrument, appState.level);
  const found = candidates.find((b) => b.id === appState.beatmapId);
  if (found) return found;
  const fallback = candidates[0] || getBeatmap(appState.instrument, appState.level);
  appState.beatmapId = fallback.id;
  return fallback;
}

function renderDifficultyCards() {
  const dict = I18N[appState.lang];
  const bests = loadPersonalBests();
  el.difficultyGrid.innerHTML = '';

  for (const levelNum of [1, 2, 3]) {
    const cfg = DIFFICULTY_CONFIG[levelNum];
    const songsInLevel = getBeatmapsFor(appState.instrument, levelNum);
    const primarySong = songsInLevel[0] || getBeatmap(appState.instrument, levelNum);
    const isActive = appState.level === levelNum;

    // Show best score across songs in this level
    let bestInLevel = null;
    for (const s of songsInLevel) {
      const rec = bests[s.id];
      if (rec && (!bestInLevel || rec.score > bestInLevel.score)) bestInLevel = rec;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `select-card diff-card${isActive ? ' active' : ''}`;
    btn.dataset.level = String(levelNum);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(isActive));
    btn.setAttribute('tabindex', isActive ? '0' : '-1');

    const descText = cfg.descriptions[appState.instrument]?.[appState.lang] || '';
    const countLabel =
      songsInLevel.length > 1
        ? `${primarySong.title[appState.lang]} (+${songsInLevel.length - 1})`
        : primarySong.title[appState.lang];
    const bestText = bestInLevel
      ? `<span>${dict.bestPrefix}: <strong>${bestInLevel.score.toLocaleString()}</strong></span><span>Grade ${bestInLevel.grade}</span>`
      : `<span>${dict.noBestYet}</span><span>${songsInLevel.length} ${dict.songsCountUnit}</span>`;

    // Valid HTML5 phrasing content (<span> only inside <button>)
    btn.innerHTML = `
      <span class="diff-top">
        <span class="diff-badge lvl-${levelNum}">${cfg.badge[appState.lang]}</span>
        <span style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">${cfg.bpm} BPM</span>
      </span>
      <span class="diff-song">${countLabel}</span>
      <span class="diff-meta">${descText}</span>
      <span class="diff-best">${bestText}</span>
    `;

    btn.addEventListener('click', () => {
      appState.level = levelNum;
      syncRadioGroupUI(el.difficultyGrid, btn);
      renderSongList();
    });

    el.difficultyGrid.appendChild(btn);
  }

  renderSongList();
}

function renderSongList() {
  if (!el.songList) return;
  const dict = I18N[appState.lang];
  const bests = loadPersonalBests();
  const songs = getBeatmapsFor(appState.instrument, appState.level);
  const activeSong = getActiveBeatmap();

  el.songList.innerHTML = '';
  for (const song of songs) {
    const isSelected = song.id === activeSong.id;
    const best = bests[song.id];

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `song-pill-card${isSelected ? ' active' : ''}`;
    btn.dataset.beatmapId = song.id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(isSelected));
    btn.setAttribute('tabindex', isSelected ? '0' : '-1');

    const bestMeta = best
      ? `${dict.bestPrefix}: ${best.score.toLocaleString()} • Grade ${best.grade}`
      : `${song.bpm} BPM • ${song.notes.length} notes`;

    btn.innerHTML = `
      <span>
        <span class="song-pill-title">${song.title[appState.lang]}</span>
        <span class="song-pill-meta">${bestMeta}</span>
      </span>
      <span style="font-size:0.82rem;color:var(--gold);font-weight:700;">${isSelected ? '✓' : ''}</span>
    `;

    btn.addEventListener('click', () => {
      appState.beatmapId = song.id;
      renderSongList();
    });

    el.songList.appendChild(btn);
  }

  updateQuickStartSummary();
}

function updateQuickStartSummary() {
  if (!el.quickStartSummary) return;
  const dict = I18N[appState.lang];
  const song = getActiveBeatmap();
  const diffCfg = DIFFICULTY_CONFIG[appState.level];
  const instNames = {
    ranat: appState.lang === 'th' ? 'ระนาดเอก' : 'Ranat Ek',
    ching: appState.lang === 'th' ? 'ฉิ่ง' : 'Ching',
    taphon: appState.lang === 'th' ? 'ตะโพน' : 'Taphon',
    khlui: appState.lang === 'th' ? 'ขลุ่ยเพียงออ' : 'Khlui',
  };
  const handTag =
    appState.oneHandMode || appState.instrument === 'khlui' || (appState.level === 1 && appState.instrument !== 'ching')
      ? (appState.lang === 'th' ? ' • รองรับมือเดียว' : ' • 1-Hand Ready')
      : '';
  const prefix = appState.lang === 'th' ? 'พร้อมเล่น:' : 'Ready:';
  el.quickStartSummary.textContent = `${prefix} ${instNames[appState.instrument]} • ${diffCfg.badge[appState.lang]} • ${song.title[appState.lang]}${handTag}`;
}

function updateGestureHint() {
  const dict = I18N[appState.lang];
  const map = {
    ranat: appState.useCamera ? dict.hintRanatCam : dict.hintRanatKey,
    ching: appState.useCamera ? dict.hintChingCam : dict.hintChingKey,
    taphon: appState.useCamera ? dict.hintTaphonCam : dict.hintTaphonKey,
    khlui: appState.useCamera ? dict.hintKhluiCam : dict.hintKhluiKey,
  };
  const nextText = map[appState.instrument] || '';
  // Guard aria-live updates so screen readers only speak when text actually changes
  if (el.gestureHintBar.textContent !== nextText) {
    el.gestureHintBar.textContent = nextText;
  }
}

// ============================================================================
// Mobile Wake Lock & On-Screen Multi-Touch Pad (Synced to Exact Instrument Keys)
// ============================================================================
let wakeLockSentinel = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || wakeLockSentinel) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch {
    // Non-fatal if battery saver or browser blocks Wake Lock
  }
}

async function releaseWakeLock() {
  if (!wakeLockSentinel) return;
  try {
    await wakeLockSentinel.release();
  } catch {
    // Ignore already released sentinel
  }
  wakeLockSentinel = null;
}

/**
 * Renders tactile on-screen touch pads matching the exact keys of the selected
 * instrument and level (Ranat 5/7, Ching 2, Taphon 4, Khlui 5).
 */
function renderTouchPad() {
  if (!el.touchPadBar) return;
  const shouldShow = !appState.useCamera && el.screenGame.classList.contains('active');
  el.touchPadBar.classList.toggle('hidden', !shouldShow);
  if (!shouldShow) return;

  const inst = appState.instrument;
  const diffCfg = DIFFICULTY_CONFIG[appState.level];
  let pads = [];

  if (inst === 'ranat') {
    pads = diffCfg.ranatKeys.map((k) => ({
      key: k.keyHint.toLowerCase(),
      main: k.th,
      sub: `${k.en} [${k.keyHint}]`,
      color: k.color,
    }));
  } else if (inst === 'ching') {
    pads = [
      { key: 'c', main: appState.lang === 'th' ? 'ฉิ่ง' : 'CHING', sub: appState.lang === 'th' ? 'เปิด [C]' : 'Open [C]', color: '#dfb258' },
      { key: 'v', main: appState.lang === 'th' ? 'ฉับ' : 'CHAB', sub: appState.lang === 'th' ? 'ปิด [V]' : 'Damp [V]', color: '#e87458' },
    ];
  } else if (inst === 'taphon') {
    pads = TAPHON_ZONES.map((z) => ({
      key: z.keyHint.toLowerCase(),
      main: z.th,
      sub: `${z.en.split(' ')[0]} [${z.keyHint}]`,
      color: z.color,
    }));
  } else if (inst === 'khlui') {
    pads = KHLUI_NOTES.map((n) => ({
      key: n.keyHint.toLowerCase(),
      main: n.th,
      sub: `${n.fingers} • ${n.en}`,
      color: n.color,
    }));
  }

  el.touchPadBar.innerHTML = '';
  for (const pad of pads) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'touch-pad-btn';
    btn.style.setProperty('--pad-color', pad.color);
    btn.innerHTML = `<span class="pad-main">${pad.main}</span><span class="pad-sub">${pad.sub}</span>`;

    // Multi-touch friendly pointerdown (supports two-finger chords on Level 3)
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
      gameEngine.handleKeyInput(pad.key);
    });

    const releaseVisual = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerup', releaseVisual);
    btn.addEventListener('pointercancel', releaseVisual);
    btn.addEventListener('pointerleave', releaseVisual);

    el.touchPadBar.appendChild(btn);
  }
}

// ============================================================================
// Start, Restart, Exit & Summary Flows (With Slow-Load & Camera Error Recovery)
// ============================================================================
let activeLaunchToken = 0;
let slowLoadTimer = null;

function clearSlowLoadTimer() {
  if (slowLoadTimer) {
    clearTimeout(slowLoadTimer);
    slowLoadTimer = null;
  }
  el.loadingSlowTip?.classList.add('hidden');
}

function describeCameraError(err) {
  const name = err?.name || '';
  if (appState.lang === 'th') {
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'สิทธิ์กล้องถูกปฏิเสธ กรุณาอนุญาตกล้องที่แถบที่อยู่เบราว์เซอร์ หรือกดปุ่มด้านล่างเพื่อเล่นด้วยสัมผัส/คีย์บอร์ดทันที';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'กล้องกำลังถูกใช้งานโดยแอปอื่น (เช่น Zoom/Meet) กรุณาปิดแอปอื่น หรือสลับไปเล่นด้วยสัมผัส/คีย์บอร์ดทันที';
    }
    if (name === 'NotFoundError') {
      return 'ไม่พบกล้องเว็บแคมในอุปกรณ์นี้ คุณสามารถเล่นด้วยปุ่มสัมผัสหรือคีย์บอร์ดได้ทันที';
    }
    return I18N.th.cameraError;
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access in your browser address bar, or switch to Touch / Keyboard mode below.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your camera is busy in another app (e.g., Zoom/Meet). Close that app or switch to Touch / Keyboard mode below.';
  }
  if (name === 'NotFoundError') {
    return 'No webcam was detected on this device. You can play right away with Touch or Keyboard mode.';
  }
  return I18N.en.cameraError;
}

async function launchGame({ useCamera }) {
  const myToken = ++activeLaunchToken;
  clearSlowLoadTimer();
  el.setupErrorBox?.classList.add('hidden');
  appState.useCamera = useCamera;

  await audioEngine.init();

  const beatmap = getActiveBeatmap();
  const diffCfg = DIFFICULTY_CONFIG[appState.level];

  el.hudSongTitle.textContent = beatmap.title[appState.lang];
  el.hudLevelBadge.textContent = `${diffCfg.name[appState.lang]} • ${beatmap.bpm} BPM`;
  updateGestureHint();

  showScreen('game');
  renderTouchPad();
  gameEngine.resize();

  if (useCamera) {
    el.overlayLoading.classList.remove('hidden');
    // Show helpful slow-network tip after 5.5s so users are never stuck waiting
    slowLoadTimer = setTimeout(() => {
      if (myToken === activeLaunchToken) {
        el.loadingSlowTip?.classList.remove('hidden');
      }
    }, 5500);

    try {
      await visionTracker.init(el.video, (status) => {
        if (myToken !== activeLaunchToken) return;
        const dict = I18N[appState.lang];
        el.loadingDetail.textContent =
          status === 'loadingModel' ? dict.loadingModel : dict.loadingCamera;
      });
    } catch (err) {
      clearSlowLoadTimer();
      if (myToken !== activeLaunchToken) return;
      console.error('Camera / MediaPipe initialization failed:', err);
      el.overlayLoading.classList.add('hidden');
      showScreen('setup');
      el.setupError.textContent = describeCameraError(err);
      el.setupErrorBox?.classList.remove('hidden');
      return;
    }

    clearSlowLoadTimer();
    // If user already switched to Touch/Keyboard or exited while loading, abort cleanly
    if (myToken !== activeLaunchToken) {
      visionTracker.stopCamera();
      return;
    }
    el.overlayLoading.classList.add('hidden');
  } else {
    el.overlayLoading.classList.add('hidden');
    visionTracker.stopCamera();
  }

  const modeOffset = useCamera ? appState.latencyOffsets.camera : appState.latencyOffsets.keyboard;
  gameEngine.startSession(beatmap, {
    useCamera,
    landmarkIdx: appState.landmarkIdx,
    latencyOffsetMs: modeOffset,
    oneHandMode: appState.oneHandMode,
  });
}

function showSummaryScreen(result) {
  const dict = I18N[appState.lang];
  const beatmap = getBeatmapById(result.beatmapId);
  const { isNewBest, bestScore } = savePersonalBest(result.beatmapId, result);

  el.summarySongName.textContent = `${beatmap.title[appState.lang]} • ${DIFFICULTY_CONFIG[appState.level].name[appState.lang]}`;
  el.summaryNewBest.classList.toggle('hidden', !isNewBest);

  el.summaryGrade.textContent = result.grade;
  el.summaryGrade.className = `grade-medal grade-${result.grade}`;
  el.summaryGrade.setAttribute('aria-label', appState.lang === 'th' ? `เกรด ${result.grade}` : `Grade ${result.grade}`);
  el.summaryFeedback.textContent = dict.gradeFeedback[result.grade];

  el.summaryScore.textContent = result.score.toLocaleString();
  el.summaryCombo.textContent = String(result.maxCombo);
  el.summaryAccuracy.textContent = `${result.accuracy}%`;
  el.summaryBest.textContent = bestScore.toLocaleString();

  el.summaryPerfect.textContent = String(result.perfect);
  el.summaryGood.textContent = String(result.good);
  el.summaryMiss.textContent = String(result.miss);

  el.btnNextLevel.classList.toggle('hidden', appState.level >= 3);
  releaseWakeLock();
  el.touchPadBar?.classList.add('hidden');

  showScreen('summary');
  renderDifficultyCards();

  // Concise full spoken summary for screen-reader users
  const summaryVoice =
    appState.lang === 'th'
      ? `จบเพลง ${beatmap.title.th} เกรด ${result.grade} คะแนน ${result.score} ความแม่นยำ ${result.accuracy} เปอร์เซ็นต์ ยอดเยี่ยม ${result.perfect} ดี ${result.good} พลาด ${result.miss}`
      : `Finished ${beatmap.title.en}. Grade ${result.grade}, score ${result.score}, accuracy ${result.accuracy} percent. ${result.perfect} perfect, ${result.good} good, ${result.miss} miss.`;
  announceSR(summaryVoice);
}

function exitToMenu() {
  activeLaunchToken++;
  clearSlowLoadTimer();
  gameEngine.stop();
  visionTracker.stopCamera();
  releaseWakeLock();
  el.touchPadBar?.classList.add('hidden');
  el.overlayLoading.classList.add('hidden');
  el.overlayCalibration.classList.add('hidden');
  if (!el.overlayPause.classList.contains('hidden')) {
    closeModalDialog(el.overlayPause);
  }
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

// Instrument ARIA radiogroup
function selectInstrumentNode(card) {
  appState.instrument = card.dataset.instrument;
  syncRadioGroupUI(el.instrumentGroup, card);
  el.ranatOptions.classList.toggle('hidden', appState.instrument !== 'ranat');
  renderDifficultyCards();
}
el.instrumentCards.forEach((card) => card.addEventListener('click', () => selectInstrumentNode(card)));
attachRadioArrowNavigation(el.instrumentGroup, selectInstrumentNode);

// Landmark ARIA radiogroup
function selectLandmarkNode(btn) {
  appState.landmarkIdx = Number(btn.dataset.landmark);
  syncRadioGroupUI(el.landmarkGroup, btn);
  gameEngine.setLandmarkIndex(appState.landmarkIdx);
}
el.landmarkBtns.forEach((btn) => btn.addEventListener('click', () => selectLandmarkNode(btn)));
attachRadioArrowNavigation(el.landmarkGroup, selectLandmarkNode);

// Difficulty ARIA radiogroup
attachRadioArrowNavigation(el.difficultyGrid, (card) => {
  appState.level = Number(card.dataset.level);
  renderSongList();
});

// Song Selector ARIA radiogroup
if (el.songList) {
  attachRadioArrowNavigation(el.songList, (card) => {
    appState.beatmapId = card.dataset.beatmapId;
    renderSongList();
  });
}

// Latency Profile Radiogroup (Camera vs Keyboard in Setup)
function selectLatencyProfileNode(btn) {
  appState.latencyProfile = btn.dataset.latencyMode;
  syncRadioGroupUI(el.latencyModeGroup, btn);
  updateLatencyUI(appState.latencyOffsets[appState.latencyProfile], appState.latencyProfile);
}
el.latencyModeBtns.forEach((btn) => btn.addEventListener('click', () => selectLatencyProfileNode(btn)));
attachRadioArrowNavigation(el.latencyModeGroup, selectLatencyProfileNode);

// Modal Input Mode Radiogroup (Tap/Space vs Webcam Hand-Clap)
function selectModalCalibModeNode(btn) {
  latencyCalib.inputMode = btn.dataset.calibInput;
  syncRadioGroupUI(el.modalCalibModeGroup, btn);
}
el.modalCalibModeBtns.forEach((btn) => btn.addEventListener('click', () => selectModalCalibModeNode(btn)));
attachRadioArrowNavigation(el.modalCalibModeGroup, selectModalCalibModeNode);

// Latency Slider & Modal Controls
el.latencySlider.addEventListener('input', (e) => updateLatencyUI(e.target.value, appState.latencyProfile));
el.btnResetLatency.addEventListener('click', () => updateLatencyUI(0, appState.latencyProfile));

el.btnOpenLatency.addEventListener('click', () => {
  // Sync modal input mode to currently selected Setup latency profile
  const matchingBtn = Array.from(el.modalCalibModeBtns).find(
    (b) => b.dataset.calibInput === appState.latencyProfile
  );
  if (matchingBtn) selectModalCalibModeNode(matchingBtn);

  el.latencyResultText.textContent = '';
  if (el.latencyExplainText) el.latencyExplainText.textContent = '';
  el.btnLatencyApply.classList.add('hidden');
  el.latencyTapLabel.textContent = I18N[appState.lang].latencyTapIdle;
  openModalDialog(el.modalLatency, el.btnOpenLatency);
});

el.btnLatencyStart.addEventListener('click', startLatencyCalibration);

// Listen ONLY to pointerdown (not click) so focused Spacebar never double-triggers!
el.btnLatencyTap.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (latencyCalib.inputMode === 'keyboard') {
    recordLatencySample();
  }
});

el.btnLatencyApply.addEventListener('click', () => {
  appState.latencyProfile = latencyCalib.inputMode;
  const setupModeBtn = Array.from(el.latencyModeBtns).find(
    (b) => b.dataset.latencyMode === appState.latencyProfile
  );
  if (setupModeBtn) syncRadioGroupUI(el.latencyModeGroup, setupModeBtn);

  updateLatencyUI(latencyCalib.measuredOffsetMs, latencyCalib.inputMode);
  stopLatencyCalibration();
  closeModalDialog(el.modalLatency);
});

el.btnLatencyClose.addEventListener('click', () => {
  stopLatencyCalibration();
  closeModalDialog(el.modalLatency);
});

// Sound Test Button (Thai 7-TET tuning demo)
el.btnSoundTest.addEventListener('click', async () => {
  await audioEngine.init();
  if (appState.instrument === 'ranat') {
    [0, 1, 2, 4, 5].forEach((step, i) => {
      setTimeout(() => audioEngine.playRanat(thai7TetFreq(step), '', 0.85), i * 125);
    });
  } else if (appState.instrument === 'ching') {
    audioEngine.playChing();
    setTimeout(() => audioEngine.playChab(), 520);
  } else if (appState.instrument === 'taphon') {
    ['ting', 'thum', 'pa', 'ja'].forEach((zone, i) => {
      setTimeout(() => audioEngine.playTaphon(zone, 0.9), i * 180);
    });
  } else if (appState.instrument === 'khlui') {
    [0, 2, 4, 5].forEach((step, i) => {
      setTimeout(() => audioEngine.playKhlui(thai7TetFreq(step), 0.35), i * 260);
    });
  }
});

el.btnQuickStartCam?.addEventListener('click', () => launchGame({ useCamera: true }));
el.btnQuickStartTouch?.addEventListener('click', () => launchGame({ useCamera: false }));
el.btnErrorFallbackTouch?.addEventListener('click', () => launchGame({ useCamera: false }));
el.btnLoadingFallbackTouch?.addEventListener('click', () => launchGame({ useCamera: false }));
el.btnLoadingCancel?.addEventListener('click', exitToMenu);
el.btnCalibSwitchTouch?.addEventListener('click', () => launchGame({ useCamera: false }));

el.toggleOneHand?.addEventListener('change', (e) => {
  appState.oneHandMode = Boolean(e.target.checked);
  updateQuickStartSummary();
});

el.btnStartCamera.addEventListener('click', () => launchGame({ useCamera: true }));
el.btnStartKeyboard.addEventListener('click', () => launchGame({ useCamera: false }));

el.btnSkipCalib.addEventListener('click', () => gameEngine.beginSongPlayback());
el.btnExitGame.addEventListener('click', exitToMenu);
el.btnPauseGame.addEventListener('click', () => gameEngine.pause());
el.btnResumeGame.addEventListener('click', () => gameEngine.resume());

function restartCurrentSong() {
  const beatmap = getActiveBeatmap();
  const modeOffset = appState.useCamera
    ? appState.latencyOffsets.camera
    : appState.latencyOffsets.keyboard;
  gameEngine.startSession(beatmap, {
    useCamera: appState.useCamera,
    landmarkIdx: appState.landmarkIdx,
    latencyOffsetMs: modeOffset,
    oneHandMode: appState.oneHandMode,
  });
}
el.btnRestartGame.addEventListener('click', restartCurrentSong);
el.btnPauseRestart.addEventListener('click', restartCurrentSong);
el.btnPauseMenu.addEventListener('click', exitToMenu);

el.btnPlayAgain.addEventListener('click', () => launchGame({ useCamera: appState.useCamera }));
el.btnNextLevel.addEventListener('click', () => {
  appState.level = Math.min(3, appState.level + 1);
  appState.beatmapId = getBeatmapsFor(appState.instrument, appState.level)[0]?.id || null;
  launchGame({ useCamera: appState.useCamera });
});
el.btnSummaryMenu.addEventListener('click', exitToMenu);

// Global Keyboard Handler (Spacebar Deduplicated + Escape Modal Close)
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();

  if (!el.modalLatency.classList.contains('hidden')) {
    if (key === ' ' && latencyCalib.active && latencyCalib.inputMode === 'keyboard') {
      // Prevent default stops Spacebar from also triggering click on focused buttons
      e.preventDefault();
      recordLatencySample();
    } else if (key === 'escape') {
      stopLatencyCalibration();
      closeModalDialog(el.modalLatency);
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

// Auto-pause on app switch / phone call / screen lock & manage Wake Lock
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (gameEngine.state === 'playing') {
      gameEngine.pause();
    }
    releaseWakeLock();
  } else if (gameEngine.state === 'playing' || gameEngine.state === 'calibrating') {
    acquireWakeLock();
  }
});

window.addEventListener('pagehide', () => {
  if (gameEngine.state === 'playing') gameEngine.pause();
  releaseWakeLock();
});

// iOS Safari requirement: unlock/resume AudioContext on very first touch/tap
const unlockAudioOnFirstGesture = () => {
  audioEngine.init().catch(() => {});
  window.removeEventListener('pointerdown', unlockAudioOnFirstGesture);
  window.removeEventListener('touchstart', unlockAudioOnFirstGesture);
};
window.addEventListener('pointerdown', unlockAudioOnFirstGesture, { passive: true });
window.addEventListener('touchstart', unlockAudioOnFirstGesture, { passive: true });

// Register PWA Service Worker (http/https only)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Non-fatal in sandboxed/preview frames
    });
  });
}

// Initial Setup Render
applyTranslations();
