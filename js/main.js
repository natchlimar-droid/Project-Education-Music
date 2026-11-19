/**
 * ============================================================================
 * js/main.js — Application Controller, Bilingual i18n & Progression Storage
 * ============================================================================
 * Coordinates UI screens, language toggle (TH/EN), localStorage personal bests,
 * Web Audio Autoplay unlock, webcam initialization, and the RhythmGameEngine.
 */

import { ThaiAudioEngine } from './audio.js';
import { HandVisionTracker } from './vision.js';
import { RhythmGameEngine } from './gameEngine.js';
import { DIFFICULTY_CONFIG, getBeatmap } from './beatmaps.js';

const STORAGE_KEY = 'siam_rhythm_personal_bests_v1';

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
    trackingPointLabel: 'จุดตรวจจับมือ (ระนาดเอก):',
    landmarkFinger: 'ปลายนิ้วชี้ (แม่นยำ)',
    landmarkPalm: 'กลางฝ่ามือ (สบายมือ)',
    selectDifficulty: 'เลือกระดับความยาก',
    privacyNotice: '<strong>ความเป็นส่วนตัว 100%:</strong> ภาพจากกล้องประมวลผลภายในเครื่องของคุณเท่านั้น ไม่มีการบันทึกหรืออัปโหลดวิดีโอใดๆ',
    startCameraBtn: 'เริ่มเล่นและเปิดกล้อง',
    keyboardModeBtn: '⌨️ โหมดทดสอบคีย์บอร์ด (ไม่ใช้กล้อง)',
    hudScore: 'คะแนน',
    hudCombo: 'คอมโบ',
    hudAccuracy: 'ความแม่นยำ',
    pauseBtn: 'พัก',
    restartBtn: 'เริ่มใหม่',
    loadingTitle: 'กำลังเตรียมระบบตรวจจับมือ...',
    loadingModel: 'กำลังโหลดโมเดล AI (MediaPipe HandLandmarker)...',
    loadingCamera: 'กำลังขออนุญาตเปิดกล้องเว็บแคม (640x480)...',
    calibEyebrow: 'เตรียมพร้อมก่อนเริ่มเพลง',
    calibTitle: 'ยกมือทั้งสองข้างให้อยู่ในกรอบกล้อง',
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
    gradeFeedback: {
      S: 'ยอดเยี่ยมไร้ที่ติ! คุณควบคุมจังหวะได้อย่างเป็นธรรมชาติ',
      A: 'เก่งมาก! จังหวะและการประสานมือแม่นยำชัดเจน',
      B: 'ทำได้ดีมาก! ลองฝึกอีกนิดเพื่อก้าวสู่ระดับ A และ S',
      C: 'เริ่มต้นได้ดี! ลองเล่นช้าลงหรือปรับตำแหน่งมือให้สบายขึ้น',
    },
    cameraError: 'ไม่สามารถเปิดกล้องเว็บแคมได้ กรุณาอนุญาตสิทธิ์กล้อง หรือลองใช้ "โหมดทดสอบคีย์บอร์ด"',
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
    trackingPointLabel: 'Ranat Tracking Point:',
    landmarkFinger: 'Index Fingertip (Precise)',
    landmarkPalm: 'Palm Center (Relaxed)',
    selectDifficulty: 'Select Difficulty',
    privacyNotice: '<strong>100% Privacy-First:</strong> All camera processing runs locally on your device. No video or images are ever recorded or uploaded.',
    startCameraBtn: 'Start & Enable Camera',
    keyboardModeBtn: '⌨️ Keyboard Practice Mode (No Camera)',
    hudScore: 'Score',
    hudCombo: 'Combo',
    hudAccuracy: 'Accuracy',
    pauseBtn: 'Pause',
    restartBtn: 'Restart',
    loadingTitle: 'Preparing Hand Tracking...',
    loadingModel: 'Loading MediaPipe HandLandmarker AI model...',
    loadingCamera: 'Requesting webcam access (640x480)...',
    calibEyebrow: 'GET READY',
    calibTitle: 'Raise Both Hands Into Camera View',
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
    gradeFeedback: {
      S: 'Masterful! Effortless Thai rhythmic flow and precision.',
      A: 'Excellent performance! Crisp timing and coordination.',
      B: 'Great job! A little more practice will unlock A or S rank.',
      C: 'Nice start! Try taking a relaxed posture or Beginner tempo.',
    },
    cameraError: 'Could not access webcam. Please allow camera permission or try "Keyboard Practice Mode".',
  },
};

// ============================================================================
// Application State
// ============================================================================
const appState = {
  lang: 'th',
  instrument: 'ranat', // 'ranat' | 'ching'
  level: 1,            // 1 | 2 | 3
  landmarkIdx: 8,      // 8 = Index Fingertip, 9 = Palm Center
  useCamera: true,
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
  instrumentCards: document.querySelectorAll('[data-instrument]'),
  ranatOptions: document.getElementById('ranat-options'),
  landmarkBtns: document.querySelectorAll('[data-landmark]'),
  difficultyGrid: document.getElementById('difficulty-grid'),
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
  hudProgressFill: document.getElementById('hud-progress-fill'),
  gestureHintBar: document.getElementById('gesture-hint-bar'),

  overlayLoading: document.getElementById('overlay-loading'),
  loadingDetail: document.getElementById('loading-detail'),
  overlayCalibration: document.getElementById('overlay-calibration'),
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
// Personal Best Storage (localStorage)
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
      // Ignore storage quota errors in private browsing
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
    onCalibrationUpdate({ handsCount, progress, secondsLeft }) {
      el.statusHand1.classList.toggle('detected', handsCount >= 1);
      el.statusHand2.classList.toggle('detected', handsCount >= 2);
      const circumference = 264;
      el.calibRingProgress.style.strokeDashoffset = String(circumference * (1 - progress));
      el.calibSeconds.textContent = String(secondsLeft);
    },
    onHudUpdate({ score, combo, multiplier, accuracy, progressPct }) {
      el.hudScore.textContent = score.toLocaleString();
      el.hudCombo.textContent = String(combo);
      el.hudAccuracy.textContent = `${accuracy}%`;
      el.hudProgressFill.style.width = `${progressPct}%`;

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
      if (key === 'privacyNotice') {
        node.innerHTML = dict[key];
      } else {
        node.textContent = dict[key];
      }
    }
  });

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
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(isActive));

    const descText =
      appState.instrument === 'ranat' ? cfg.description[appState.lang] : cfg.chingDescription[appState.lang];

    const bestText = best
      ? `<span>${dict.bestPrefix}: <strong>${best.score.toLocaleString()}</strong></span><span>Grade ${best.grade}</span>`
      : `<span>${dict.noBestYet}</span><span>—</span>`;

    btn.innerHTML = `
      <div class="diff-top">
        <span class="diff-badge lvl-${levelNum}">${cfg.badge[appState.lang]}</span>
        <span style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">${cfg.bpm} BPM</span>
      </div>
      <div class="diff-song">${beatmap.title[appState.lang]}</div>
      <ul class="diff-meta">
        <li>${descText}</li>
      </ul>
      <div class="diff-best">${bestText}</div>
    `;

    btn.addEventListener('click', () => {
      appState.level = levelNum;
      renderDifficultyCards();
    });

    el.difficultyGrid.appendChild(btn);
  }
}

function updateGestureHint() {
  const dict = I18N[appState.lang];
  if (appState.instrument === 'ranat') {
    el.gestureHintBar.textContent = appState.useCamera ? dict.hintRanatCam : dict.hintRanatKey;
  } else {
    el.gestureHintBar.textContent = appState.useCamera ? dict.hintChingCam : dict.hintChingKey;
  }
}

// ============================================================================
// Start, Restart, Exit & Summary Flows
// ============================================================================
async function launchGame({ useCamera }) {
  el.setupError.classList.add('hidden');
  appState.useCamera = useCamera;

  // Unlock Web Audio API directly inside user click gesture (Autoplay Policy)
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

  // Hide "Next Level" button when already on Level 3
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
    el.langBtns.forEach((b) => b.classList.toggle('active', b === btn));
    applyTranslations();
  });
});

el.instrumentCards.forEach((card) => {
  card.addEventListener('click', () => {
    appState.instrument = card.dataset.instrument;
    el.instrumentCards.forEach((c) => {
      const active = c === card;
      c.classList.toggle('active', active);
      c.setAttribute('aria-checked', String(active));
    });
    el.ranatOptions.classList.toggle('hidden', appState.instrument !== 'ranat');
    renderDifficultyCards();
  });
});

el.landmarkBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    appState.landmarkIdx = Number(btn.dataset.landmark);
    el.landmarkBtns.forEach((b) => b.classList.toggle('active', b === btn));
    gameEngine.setLandmarkIndex(appState.landmarkIdx);
  });
});

// Sound Test button (lets users hear built-in Web Audio synthesis before playing)
el.btnSoundTest.addEventListener('click', async () => {
  await audioEngine.init();
  if (appState.instrument === 'ranat') {
    const demoFreqs = [523.25, 587.33, 659.25, 783.99, 880.0];
    demoFreqs.forEach((f, i) => {
      setTimeout(() => audioEngine.playRanat(f, '', 0.85), i * 130);
    });
  } else {
    audioEngine.playChing();
    setTimeout(() => audioEngine.playChab(), 520);
  }
});

el.btnStartCamera.addEventListener('click', () => launchGame({ useCamera: true }));
el.btnStartKeyboard.addEventListener('click', () => launchGame({ useCamera: false }));

el.btnSkipCalib.addEventListener('click', () => gameEngine.beginSongPlayback());
el.btnExitGame.addEventListener('click', exitToMenu);
el.btnPauseGame.addEventListener('click', () => gameEngine.pause());
el.btnResumeGame.addEventListener('click', () => gameEngine.resume());
el.btnRestartGame.addEventListener('click', () => {
  const beatmap = getBeatmap(appState.instrument, appState.level);
  gameEngine.startSession(beatmap, {
    useCamera: appState.useCamera,
    landmarkIdx: appState.landmarkIdx,
  });
});
el.btnPauseRestart.addEventListener('click', () => {
  const beatmap = getBeatmap(appState.instrument, appState.level);
  gameEngine.startSession(beatmap, {
    useCamera: appState.useCamera,
    landmarkIdx: appState.landmarkIdx,
  });
});
el.btnPauseMenu.addEventListener('click', exitToMenu);

el.btnPlayAgain.addEventListener('click', () => launchGame({ useCamera: appState.useCamera }));
el.btnNextLevel.addEventListener('click', () => {
  appState.level = Math.min(3, appState.level + 1);
  launchGame({ useCamera: appState.useCamera });
});
el.btnSummaryMenu.addEventListener('click', exitToMenu);

// Keyboard accessibility & practice mode controls
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();

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

// Initial render
applyTranslations();

