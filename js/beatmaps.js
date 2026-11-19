/**
 * ============================================================================
 * js/beatmaps.js — Thai Traditional Music Beatmap Schema & Song Library
 * ============================================================================
 * Clean, extensible data schema so new Thai classical / folk songs can be
 * added effortlessly. All note timestamps are authored in musical beats and
 * converted to exact seconds relative to `audioCtx.currentTime` via `buildTimeline()`.
 */

export const RANAT_KEYS_5 = [
  { id: 'D', th: 'ด', en: 'Do', freq: 523.25, color: '#dfb258', keyHint: 'A' },
  { id: 'R', th: 'ร', en: 'Re', freq: 587.33, color: '#4cc2a8', keyHint: 'S' },
  { id: 'M', th: 'ม', en: 'Mi', freq: 659.25, color: '#6cb4ee', keyHint: 'D' },
  { id: 'S', th: 'ซ', en: 'Sol', freq: 783.99, color: '#e87458', keyHint: 'F' },
  { id: 'L', th: 'ล', en: 'La', freq: 880.00, color: '#c48df2', keyHint: 'G' },
];

export const RANAT_KEYS_7 = [
  { id: 'D', th: 'ด', en: 'Do', freq: 523.25, color: '#dfb258', keyHint: 'A' },
  { id: 'R', th: 'ร', en: 'Re', freq: 587.33, color: '#4cc2a8', keyHint: 'S' },
  { id: 'M', th: 'ม', en: 'Mi', freq: 659.25, color: '#6cb4ee', keyHint: 'D' },
  { id: 'F', th: 'ฟ', en: 'Fa', freq: 698.46, color: '#8ad47c', keyHint: 'F' },
  { id: 'S', th: 'ซ', en: 'Sol', freq: 783.99, color: '#e87458', keyHint: 'G' },
  { id: 'L', th: 'ล', en: 'La', freq: 880.00, color: '#c48df2', keyHint: 'H' },
  { id: 'T', th: 'ท', en: 'Ti', freq: 987.77, color: '#f28db2', keyHint: 'J' },
];

/**
 * Progressive Difficulty Definitions (Levels 1 - 3)
 * Timing windows are expressed in seconds for direct comparison with `audioCtx.currentTime`.
 */
export const DIFFICULTY_CONFIG = {
  1: {
    level: 1,
    name: { th: 'ระดับ 1: พื้นฐาน', en: 'Level 1: Beginner' },
    badge: { th: 'พื้นฐาน', en: 'Beginner' },
    bpm: 75,
    timingWindows: { perfect: 0.15, good: 0.30 }, // ±150ms / ±300ms
    fallDuration: 2.8, // Slower note fall speed for readability (UDL)
    visualAid: true,   // Highlighted target zones & helper guides
    comboMultiplier: false,
    ranatKeys: RANAT_KEYS_5,
    description: {
      th: '75 BPM • 5 ลูกกว้าง (ด ร ม ซ ล) • เล่นมือเดียวได้',
      en: '75 BPM • 5 Wide Keys (Do-La) • Single-hand friendly',
    },
    chingDescription: {
      th: '75 BPM • จังหวะสองชั้นช้าๆ • กรอบเวลา ±150ms',
      en: '75 BPM • Steady 2-Chan tempo • ±150ms Perfect window',
    },
  },
  2: {
    level: 2,
    name: { th: 'ระดับ 2: ปานกลาง', en: 'Level 2: Intermediate' },
    badge: { th: 'ปานกลาง', en: 'Intermediate' },
    bpm: 95,
    timingWindows: { perfect: 0.10, good: 0.22 }, // ±100ms / ±220ms
    fallDuration: 2.1,
    visualAid: false,
    comboMultiplier: false,
    ranatKeys: RANAT_KEYS_7,
    description: {
      th: '95 BPM • ครบ 7 เสียงไทย (ด-ท) • สลับสองมือ',
      en: '95 BPM • Full 7-Tone Scale • Alternating hands',
    },
    chingDescription: {
      th: '95 BPM • จังหวะรำวงสลับ • กรอบเวลา ±100ms',
      en: '95 BPM • Lively Ramwong pattern • ±100ms Perfect window',
    },
  },
  3: {
    level: 3,
    name: { th: 'ระดับ 3: ท้าทาย', en: 'Level 3: Master' },
    badge: { th: 'ท้าทาย', en: 'Master' },
    bpm: 120,
    timingWindows: { perfect: 0.07, good: 0.15 }, // ±70ms / ±150ms
    fallDuration: 1.55,
    visualAid: false,
    comboMultiplier: true, // Enables x2 (10+ streak) and x4 (25+ streak)
    ranatKeys: RANAT_KEYS_7,
    description: {
      th: '120 BPM • 7 เสียง • ตีคู่/กรอสองมือ + ตัวคูณ x2/x4',
      en: '120 BPM • 7 Keys • Rapid & Two-Hand Chords + x2/x4',
    },
    chingDescription: {
      th: '120 BPM • จังหวะชั้นเดียวเร็ว • ตัวคูณ x2/x4',
      en: '120 BPM • Rapid 1-Chan tempo • x2/x4 Combo Multiplier',
    },
  },
};

/**
 * Sample Beatmaps Library
 *
 * Ranat note format:
 *   { beat: number, lane: number (0-indexed into keys), chord?: boolean }
 *   (Multiple notes sharing the same `beat` form a simultaneous two-hand chord / ตีคู่)
 *
 * Ching note format:
 *   { beat: number, type: 'ching' | 'chab' }
 */
export const BEATMAPS = [
  // ==========================================================================
  // RANAT EK — LEVEL 1: ช้าง (Chang — The Elephant) | 75 BPM | 5 Wide Keys
  // Keys: 0:ด, 1:ร, 2:ม, 3:ซ, 4:ล
  // ==========================================================================
  {
    id: 'ranat-lvl1-chang',
    instrument: 'ranat',
    level: 1,
    bpm: 75,
    leadInBeats: 4,
    title: { th: 'เพลงช้าง (พื้นฐาน)', en: 'Chang — The Elephant' },
    subtitle: { th: 'ทำนอง 5 เสียง ช้าและกว้าง เหมาะสำหรับเริ่มต้น', en: 'Gentle 5-tone Thai folk melody' },
    notes: [
      // Phrase 1: ช้าง ช้าง ช้าง ช้าง ช้าง
      { beat: 0, lane: 3 }, { beat: 2, lane: 3 }, { beat: 4, lane: 3 },
      { beat: 6, lane: 2 }, { beat: 8, lane: 3 },
      // Phrase 2: น้องเคยเห็นช้างหรือเปล่า
      { beat: 10, lane: 4 }, { beat: 12, lane: 3 }, { beat: 14, lane: 2 },
      { beat: 16, lane: 1 }, { beat: 18, lane: 0 },
      // Phrase 3: ช้างมันตัวโตไม่เบา
      { beat: 20, lane: 2 }, { beat: 22, lane: 3 }, { beat: 24, lane: 4 },
      { beat: 26, lane: 3 }, { beat: 28, lane: 2 },
      // Phrase 4: จมูกยาวยาวเรียกว่างวง
      { beat: 30, lane: 1 }, { beat: 32, lane: 2 }, { beat: 34, lane: 3 },
      { beat: 36, lane: 2 }, { beat: 38, lane: 1 }, { beat: 40, lane: 0 },
      // Phrase 5: มีเขี้ยวใต้งวงเรียกว่างา
      { beat: 43, lane: 3 }, { beat: 45, lane: 4 }, { beat: 47, lane: 3 },
      { beat: 49, lane: 2 }, { beat: 51, lane: 1 }, { beat: 53, lane: 0 },
    ],
  },

  // ==========================================================================
  // RANAT EK — LEVEL 2: ลอยกระทง (Loy Krathong) | 95 BPM | 7 Keys
  // Keys: 0:ด, 1:ร, 2:ม, 3:ฟ, 4:ซ, 5:ล, 6:ท
  // ==========================================================================
  {
    id: 'ranat-lvl2-loykrathong',
    instrument: 'ranat',
    level: 2,
    bpm: 95,
    leadInBeats: 4,
    title: { th: 'เพลงลอยกระทง', en: 'Loy Krathong Festival' },
    subtitle: { th: 'ทำนองรำวง 7 เสียง ฝึกสลับซ้ายขวาอย่างลื่นไหล', en: 'Classic 7-tone festive melody with alternating hands' },
    notes: [
      // วันเพ็ญเดือนสิบสอง น้ำก็เจิ่งนองเต็มตลิ่ง
      { beat: 0, lane: 4 }, { beat: 1, lane: 4 }, { beat: 2, lane: 5 }, { beat: 3, lane: 4 },
      { beat: 4, lane: 2 }, { beat: 5.5, lane: 4 }, { beat: 7, lane: 5 },
      { beat: 8, lane: 6 }, { beat: 9, lane: 5 }, { beat: 10, lane: 4 }, { beat: 11, lane: 2 },
      { beat: 12, lane: 1 }, { beat: 13.5, lane: 2 }, { beat: 15, lane: 4 },

      // เราทั้งหลายชายหญิง สนุกกันจริงวันลอยกระทง
      { beat: 16, lane: 2 }, { beat: 17, lane: 3 }, { beat: 18, lane: 4 }, { beat: 19, lane: 5 },
      { beat: 20, lane: 4 }, { beat: 21.5, lane: 2 }, { beat: 23, lane: 1 },
      { beat: 24, lane: 0 }, { beat: 25, lane: 1 }, { beat: 26, lane: 2 }, { beat: 27, lane: 4 },
      { beat: 28, lane: 2 }, { beat: 29.5, lane: 1 }, { beat: 31, lane: 0 },

      // ลอย ลอย กระทง (Refrain)
      { beat: 33, lane: 4 }, { beat: 34.5, lane: 4 }, { beat: 36, lane: 5 }, { beat: 37, lane: 4 },
      { beat: 38.5, lane: 2 }, { beat: 40, lane: 1 }, { beat: 41.5, lane: 2 },
      { beat: 43, lane: 4 }, { beat: 44, lane: 5 }, { beat: 45, lane: 6 }, { beat: 46, lane: 5 },
      { beat: 47.5, lane: 4 }, { beat: 49, lane: 2 }, { beat: 50.5, lane: 0 },
    ],
  },

  // ==========================================================================
  // RANAT EK — LEVEL 3: ลาวดวงเดือน (Lao Duang Duean — Allegro Motif) | 120 BPM
  // Features rapid alternating passages + simultaneous two-hand chords (ตีคู่/กรอ)
  // Keys: 0:ด, 1:ร, 2:ม, 3:ฟ, 4:ซ, 5:ล, 6:ท
  // ==========================================================================
  {
    id: 'ranat-lvl3-laoduangduean',
    instrument: 'ranat',
    level: 3,
    bpm: 120,
    leadInBeats: 4,
    title: { th: 'ลาวดวงเดือน (ประยุกต์เร็ว)', en: 'Lao Duang Duean — Allegro' },
    subtitle: { th: 'ท่วงทำนองเร็ว สลับมือและตีคู่สองมือ (x2/x4)', en: 'Rapid alternating runs & two-hand chords (x2/x4)' },
    notes: [
      // Opening chord (ตีคู่ ด-ซ)
      { beat: 0, lane: 0, chord: true }, { beat: 0, lane: 4, chord: true },
      // Ascending rapid motif
      { beat: 1.5, lane: 1 }, { beat: 2.25, lane: 2 }, { beat: 3, lane: 4 },
      { beat: 4, lane: 5 }, { beat: 4.75, lane: 4 }, { beat: 5.5, lane: 2 }, { beat: 6.25, lane: 1 },
      // Chord accent (ร-ล)
      { beat: 7.5, lane: 1, chord: true }, { beat: 7.5, lane: 5, chord: true },

      // Graceful descending cascade
      { beat: 9, lane: 6 }, { beat: 9.75, lane: 5 }, { beat: 10.5, lane: 4 }, { beat: 11.25, lane: 3 },
      { beat: 12, lane: 2 }, { beat: 12.75, lane: 1 }, { beat: 13.5, lane: 0 },
      // Two-hand octave-like chord (ด-ม & ร-ซ)
      { beat: 15, lane: 0, chord: true }, { beat: 15, lane: 2, chord: true },
      { beat: 16.5, lane: 1, chord: true }, { beat: 16.5, lane: 4, chord: true },

      // Rapid alternating Kror-style (กรอ) passage
      { beat: 18, lane: 2 }, { beat: 18.75, lane: 4 }, { beat: 19.5, lane: 2 }, { beat: 20.25, lane: 4 },
      { beat: 21, lane: 5 }, { beat: 21.75, lane: 4 }, { beat: 22.5, lane: 5 }, { beat: 23.25, lane: 6 },
      // Chord hit (ม-ท)
      { beat: 24.5, lane: 2, chord: true }, { beat: 24.5, lane: 6, chord: true },

      // Expressive melody run
      { beat: 26, lane: 5 }, { beat: 26.75, lane: 4 }, { beat: 27.5, lane: 2 }, { beat: 28.25, lane: 4 },
      { beat: 29, lane: 5 }, { beat: 29.75, lane: 4 }, { beat: 30.5, lane: 2 }, { beat: 31.25, lane: 1 },
      { beat: 32, lane: 0 }, { beat: 32.75, lane: 2 }, { beat: 33.5, lane: 4 }, { beat: 34.25, lane: 5 },
      // Climax alternating chords
      { beat: 35.5, lane: 1, chord: true }, { beat: 35.5, lane: 5, chord: true },
      { beat: 37, lane: 2, chord: true }, { beat: 37, lane: 6, chord: true },
      { beat: 38.5, lane: 4 }, { beat: 39.25, lane: 2 }, { beat: 40, lane: 1 },
      // Grand finale chord (ด-ซ)
      { beat: 41.5, lane: 0, chord: true }, { beat: 41.5, lane: 4, chord: true },
    ],
  },

  // ==========================================================================
  // CHING — LEVEL 1: จังหวะฉิ่งสองชั้นพื้นฐาน (Ching Basic 2-Chan) | 75 BPM
  // Steady ฉิ่ง (open) — ฉับ (dampened)
  // ==========================================================================
  {
    id: 'ching-lvl1-2chan',
    instrument: 'ching',
    level: 1,
    bpm: 75,
    leadInBeats: 4,
    title: { th: 'จังหวะฉิ่งสองชั้นพื้นฐาน', en: 'Ching Basic 2-Chan' },
    subtitle: { th: 'จังหวะช้าสม่ำเสมอ ฉิ่ง — ฉับ ฝึกแยกเสียงเปิดและปิด', en: 'Steady traditional Ching — Chab alternation' },
    notes: [
      { beat: 0, type: 'ching' },  { beat: 3, type: 'chab' },
      { beat: 6, type: 'ching' },  { beat: 9, type: 'chab' },
      { beat: 12, type: 'ching' }, { beat: 15, type: 'chab' },
      { beat: 18, type: 'ching' }, { beat: 21, type: 'chab' },
      { beat: 24, type: 'ching' }, { beat: 27, type: 'chab' },
      { beat: 30, type: 'ching' }, { beat: 33, type: 'chab' },
      { beat: 36, type: 'ching' }, { beat: 39, type: 'chab' },
      { beat: 42, type: 'ching' }, { beat: 45, type: 'chab' },
    ],
  },

  // ==========================================================================
  // CHING — LEVEL 2: จังหวะรำวงลอยกระทง (Ramwong Loy Krathong) | 95 BPM
  // ==========================================================================
  {
    id: 'ching-lvl2-ramwong',
    instrument: 'ching',
    level: 2,
    bpm: 95,
    leadInBeats: 4,
    title: { th: 'จังหวะรำวงลอยกระทง', en: 'Ramwong Loy Krathong Rhythm' },
    subtitle: { th: 'จังหวะรำวงสนุกสนาน สลับฉิ่ง-ฉับและจังหวะยก', en: 'Lively Ramwong pulse with syncopated accents' },
    notes: [
      { beat: 0, type: 'ching' },  { beat: 2, type: 'chab' },
      { beat: 4, type: 'ching' },  { beat: 6, type: 'chab' },
      { beat: 8, type: 'ching' },  { beat: 10, type: 'ching' }, { beat: 12, type: 'chab' },
      { beat: 14, type: 'ching' }, { beat: 16, type: 'chab' },
      { beat: 18, type: 'ching' }, { beat: 20, type: 'chab' },
      { beat: 22, type: 'ching' }, { beat: 24, type: 'ching' }, { beat: 26, type: 'chab' },
      { beat: 28, type: 'ching' }, { beat: 30, type: 'chab' },
      { beat: 32, type: 'ching' }, { beat: 34, type: 'chab' },
      { beat: 36, type: 'ching' }, { beat: 38, type: 'chab' },
      { beat: 40, type: 'ching' }, { beat: 42, type: 'chab' },
    ],
  },

  // ==========================================================================
  // CHING — LEVEL 3: จังหวะโหมโรงชั้นเดียว (Hom Rong 1-Chan Rapid) | 120 BPM
  // ==========================================================================
  {
    id: 'ching-lvl3-1chan',
    instrument: 'ching',
    level: 3,
    bpm: 120,
    leadInBeats: 4,
    title: { th: 'จังหวะโหมโรงชั้นเดียว (เร็ว)', en: 'Hom Rong 1-Chan Rapid' },
    subtitle: { th: 'จังหวะชั้นเดียวกระชับ ฉิ่ง-ฉับเร็ว ต่อเนื่อง + ตัวคูณ x2/x4', en: 'Crisp rapid 1-Chan patterns with x2/x4 combo multiplier' },
    notes: [
      { beat: 0, type: 'ching' },  { beat: 1.5, type: 'chab' },
      { beat: 3, type: 'ching' },  { beat: 4.5, type: 'chab' },
      { beat: 6, type: 'ching' },  { beat: 7.5, type: 'chab' },
      { beat: 9, type: 'ching' },  { beat: 10.5, type: 'ching' }, { beat: 12, type: 'chab' },
      { beat: 13.5, type: 'ching' }, { beat: 15, type: 'chab' },
      { beat: 16.5, type: 'ching' }, { beat: 18, type: 'chab' },
      { beat: 19.5, type: 'ching' }, { beat: 21, type: 'chab' },
      { beat: 22.5, type: 'ching' }, { beat: 24, type: 'ching' }, { beat: 25.5, type: 'chab' },
      { beat: 27, type: 'ching' }, { beat: 28.5, type: 'chab' },
      { beat: 30, type: 'ching' }, { beat: 31.5, type: 'chab' },
      { beat: 33, type: 'ching' }, { beat: 34.5, type: 'chab' },
      { beat: 36, type: 'ching' }, { beat: 37.5, type: 'chab' },
      { beat: 39, type: 'ching' }, { beat: 40.5, type: 'chab' },
      { beat: 42, type: 'ching' }, { beat: 43.5, type: 'chab' },
      { beat: 45, type: 'ching' }, { beat: 46.5, type: 'chab' },
    ],
  },
];

/**
 * Retrieve the beatmap for a given instrument ('ranat' | 'ching') and level (1 | 2 | 3).
 */
export function getBeatmap(instrument, level) {
  return BEATMAPS.find((b) => b.instrument === instrument && b.level === Number(level)) || BEATMAPS[0];
}

/**
 * Converts a beatmap's musical beats into a deterministic timeline in seconds.
 * All times are relative to `songStartTime` (anchored to `audioCtx.currentTime`).
 */
export function buildTimeline(beatmap) {
  const secPerBeat = 60 / beatmap.bpm;
  const leadInSec = (beatmap.leadInBeats || 4) * secPerBeat;

  const notes = beatmap.notes.map((n, index) => ({
    id: index,
    beat: n.beat,
    time: leadInSec + n.beat * secPerBeat,
    lane: n.lane ?? 0,
    type: n.type ?? 'ranat', // 'ranat' | 'ching' | 'chab'
    chord: Boolean(n.chord),
    status: 'pending', // 'pending' | 'perfect' | 'good' | 'miss'
  }));

  const lastNoteTime = notes.length ? notes[notes.length - 1].time : leadInSec;
  const totalDuration = lastNoteTime + 2.4; // Tail buffer after final note

  return {
    secPerBeat,
    leadInSec,
    totalDuration,
    notes,
  };
}

