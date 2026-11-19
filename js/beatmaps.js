/**
 * ============================================================================
 * js/beatmaps.js — Thai Traditional Music Beatmap Schema & Song Library
 * ============================================================================
 * Supports 4 Thai instruments across 3 progressive difficulty levels (12 songs):
 *  - ranat  : Ranat Ek (ระนาดเอก) — 5 or 7 hardwood xylophone bars
 *  - ching  : Ching (ฉิ่ง) — Open "Ching" vs Dampened "Chab" cymbals
 *  - taphon : Taphon (ตะโพน/กลองไทย) — 4 drumhead/rim zones via wrist velocity
 *  - khlui  : Khlui (ขลุ่ยเพียงออ) — 5 pentatonic tones via extended finger count (1-5)
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

export const TAPHON_ZONES = [
  { id: 'ting', th: 'ติง', en: 'Ting (Rim)', zoneType: 'rim', color: '#6cb4ee', keyHint: 'A' },
  { id: 'thum', th: 'ทุ่ม', en: 'Thum (Bass)', zoneType: 'head', color: '#dfb258', keyHint: 'S' },
  { id: 'pa',   th: 'ป๊ะ', en: 'Pa (Slap)',  zoneType: 'head', color: '#e87458', keyHint: 'D' },
  { id: 'ja',   th: 'จ๊ะ', en: 'Ja (Rim)',   zoneType: 'rim', color: '#4cc2a8', keyHint: 'F' },
];

export const KHLUI_NOTES = [
  { id: 'D', fingers: 1, th: 'ด', en: 'Do',  freq: 523.25, color: '#dfb258', keyHint: '1' },
  { id: 'R', fingers: 2, th: 'ร', en: 'Re',  freq: 587.33, color: '#4cc2a8', keyHint: '2' },
  { id: 'M', fingers: 3, th: 'ม', en: 'Mi',  freq: 659.25, color: '#6cb4ee', keyHint: '3' },
  { id: 'S', fingers: 4, th: 'ซ', en: 'Sol', freq: 783.99, color: '#e87458', keyHint: '4' },
  { id: 'L', fingers: 5, th: 'ล', en: 'La',  freq: 880.00, color: '#c48df2', keyHint: '5' },
];

/**
 * Progressive Difficulty Definitions (Levels 1 - 3)
 * Timing windows are in seconds for direct comparison with `audioCtx.currentTime`.
 */
export const DIFFICULTY_CONFIG = {
  1: {
    level: 1,
    name: { th: 'ระดับ 1: พื้นฐาน', en: 'Level 1: Beginner' },
    badge: { th: 'พื้นฐาน', en: 'Beginner' },
    bpm: 75,
    timingWindows: { perfect: 0.15, good: 0.30 },
    fallDuration: 2.8,
    visualAid: true,
    comboMultiplier: false,
    ranatKeys: RANAT_KEYS_5,
    descriptions: {
      ranat: {
        th: '75 BPM • 5 ลูกกว้าง (ด ร ม ซ ล) • เล่นมือเดียวได้',
        en: '75 BPM • 5 Wide Keys (Do-La) • Single-hand friendly',
      },
      ching: {
        th: '75 BPM • จังหวะสองชั้นช้าๆ • กรอบเวลา ±150ms',
        en: '75 BPM • Steady 2-Chan tempo • ±150ms Perfect window',
      },
      taphon: {
        th: '75 BPM • หน้าทับพื้นฐาน 4 โซน • กรอบเวลา ±150ms',
        en: '75 BPM • Basic 4-zone drum pattern • ±150ms window',
      },
      khlui: {
        th: '75 BPM • ชูนิ้ว 1–5 แทน 5 เสียงไทย • ช้าและชัดเจน',
        en: '75 BPM • 1–5 fingers for 5 Thai tones • Gentle pace',
      },
    },
  },
  2: {
    level: 2,
    name: { th: 'ระดับ 2: ปานกลาง', en: 'Level 2: Intermediate' },
    badge: { th: 'ปานกลาง', en: 'Intermediate' },
    bpm: 95,
    timingWindows: { perfect: 0.10, good: 0.22 },
    fallDuration: 2.1,
    visualAid: false,
    comboMultiplier: false,
    ranatKeys: RANAT_KEYS_7,
    descriptions: {
      ranat: {
        th: '95 BPM • ครบ 7 เสียงไทย (ด-ท) • สลับสองมือ',
        en: '95 BPM • Full 7-Tone Scale • Alternating hands',
      },
      ching: {
        th: '95 BPM • จังหวะรำวงสลับ • กรอบเวลา ±100ms',
        en: '95 BPM • Lively Ramwong pattern • ±100ms Perfect window',
      },
      taphon: {
        th: '95 BPM • หน้าทับสองไม้ สลับหน้ากลอง/ขอบกลอง',
        en: '95 BPM • Song Mai alternating head & rim strikes',
      },
      khlui: {
        th: '95 BPM • ทำนองขลุ่ยสลับนิ้วต่อเนื่อง • ±100ms',
        en: '95 BPM • Flowing finger transitions • ±100ms window',
      },
    },
  },
  3: {
    level: 3,
    name: { th: 'ระดับ 3: ท้าทาย', en: 'Level 3: Master' },
    badge: { th: 'ท้าทาย', en: 'Master' },
    bpm: 120,
    timingWindows: { perfect: 0.07, good: 0.15 },
    fallDuration: 1.55,
    visualAid: false,
    comboMultiplier: true,
    ranatKeys: RANAT_KEYS_7,
    descriptions: {
      ranat: {
        th: '120 BPM • 7 เสียง • ตีคู่/กรอสองมือ + ตัวคูณ x2/x4',
        en: '120 BPM • 7 Keys • Rapid & Two-Hand Chords + x2/x4',
      },
      ching: {
        th: '120 BPM • จังหวะชั้นเดียวเร็ว • ตัวคูณ x2/x4',
        en: '120 BPM • Rapid 1-Chan tempo • x2/x4 Combo Multiplier',
      },
      taphon: {
        th: '120 BPM • หน้าทับโหมโรงเร็ว + ตีคู่สองมือ x2/x4',
        en: '120 BPM • Rapid Hom Rong & double hits + x2/x4',
      },
      khlui: {
        th: '120 BPM • ทำนองขลุ่ยพริ้วเร็ว + ตัวคูณ x2/x4',
        en: '120 BPM • Expressive rapid flute runs + x2/x4',
      },
    },
  },
};

export const BEATMAPS = [
  // ==========================================================================
  // RANAT EK (Levels 1 - 3)
  // ==========================================================================
  {
    id: 'ranat-lvl1-chang',
    instrument: 'ranat',
    level: 1,
    bpm: 75,
    leadInBeats: 4,
    title: { th: 'เพลงช้าง (พื้นฐาน)', en: 'Chang — The Elephant' },
    notes: [
      { beat: 0, lane: 3 }, { beat: 2, lane: 3 }, { beat: 4, lane: 3 },
      { beat: 6, lane: 2 }, { beat: 8, lane: 3 },
      { beat: 10, lane: 4 }, { beat: 12, lane: 3 }, { beat: 14, lane: 2 },
      { beat: 16, lane: 1 }, { beat: 18, lane: 0 },
      { beat: 20, lane: 2 }, { beat: 22, lane: 3 }, { beat: 24, lane: 4 },
      { beat: 26, lane: 3 }, { beat: 28, lane: 2 },
      { beat: 30, lane: 1 }, { beat: 32, lane: 2 }, { beat: 34, lane: 3 },
      { beat: 36, lane: 2 }, { beat: 38, lane: 1 }, { beat: 40, lane: 0 },
      { beat: 43, lane: 3 }, { beat: 45, lane: 4 }, { beat: 47, lane: 3 },
      { beat: 49, lane: 2 }, { beat: 51, lane: 1 }, { beat: 53, lane: 0 },
    ],
  },
  {
    id: 'ranat-lvl2-loykrathong',
    instrument: 'ranat',
    level: 2,
    bpm: 95,
    leadInBeats: 4,
    title: { th: 'เพลงลอยกระทง', en: 'Loy Krathong Festival' },
    notes: [
      { beat: 0, lane: 4 }, { beat: 1, lane: 4 }, { beat: 2, lane: 5 }, { beat: 3, lane: 4 },
      { beat: 4, lane: 2 }, { beat: 5.5, lane: 4 }, { beat: 7, lane: 5 },
      { beat: 8, lane: 6 }, { beat: 9, lane: 5 }, { beat: 10, lane: 4 }, { beat: 11, lane: 2 },
      { beat: 12, lane: 1 }, { beat: 13.5, lane: 2 }, { beat: 15, lane: 4 },
      { beat: 16, lane: 2 }, { beat: 17, lane: 3 }, { beat: 18, lane: 4 }, { beat: 19, lane: 5 },
      { beat: 20, lane: 4 }, { beat: 21.5, lane: 2 }, { beat: 23, lane: 1 },
      { beat: 24, lane: 0 }, { beat: 25, lane: 1 }, { beat: 26, lane: 2 }, { beat: 27, lane: 4 },
      { beat: 28, lane: 2 }, { beat: 29.5, lane: 1 }, { beat: 31, lane: 0 },
      { beat: 33, lane: 4 }, { beat: 34.5, lane: 4 }, { beat: 36, lane: 5 }, { beat: 37, lane: 4 },
      { beat: 38.5, lane: 2 }, { beat: 40, lane: 1 }, { beat: 41.5, lane: 2 },
      { beat: 43, lane: 4 }, { beat: 44, lane: 5 }, { beat: 45, lane: 6 }, { beat: 46, lane: 5 },
      { beat: 47.5, lane: 4 }, { beat: 49, lane: 2 }, { beat: 50.5, lane: 0 },
    ],
  },
  {
    id: 'ranat-lvl3-laoduangduean',
    instrument: 'ranat',
    level: 3,
    bpm: 120,
    leadInBeats: 4,
    title: { th: 'ลาวดวงเดือน (ประยุกต์เร็ว)', en: 'Lao Duang Duean — Allegro' },
    notes: [
      { beat: 0, lane: 0, chord: true }, { beat: 0, lane: 4, chord: true },
      { beat: 1.5, lane: 1 }, { beat: 2.25, lane: 2 }, { beat: 3, lane: 4 },
      { beat: 4, lane: 5 }, { beat: 4.75, lane: 4 }, { beat: 5.5, lane: 2 }, { beat: 6.25, lane: 1 },
      { beat: 7.5, lane: 1, chord: true }, { beat: 7.5, lane: 5, chord: true },
      { beat: 9, lane: 6 }, { beat: 9.75, lane: 5 }, { beat: 10.5, lane: 4 }, { beat: 11.25, lane: 3 },
      { beat: 12, lane: 2 }, { beat: 12.75, lane: 1 }, { beat: 13.5, lane: 0 },
      { beat: 15, lane: 0, chord: true }, { beat: 15, lane: 2, chord: true },
      { beat: 16.5, lane: 1, chord: true }, { beat: 16.5, lane: 4, chord: true },
      { beat: 18, lane: 2 }, { beat: 18.75, lane: 4 }, { beat: 19.5, lane: 2 }, { beat: 20.25, lane: 4 },
      { beat: 21, lane: 5 }, { beat: 21.75, lane: 4 }, { beat: 22.5, lane: 5 }, { beat: 23.25, lane: 6 },
      { beat: 24.5, lane: 2, chord: true }, { beat: 24.5, lane: 6, chord: true },
      { beat: 26, lane: 5 }, { beat: 26.75, lane: 4 }, { beat: 27.5, lane: 2 }, { beat: 28.25, lane: 4 },
      { beat: 29, lane: 5 }, { beat: 29.75, lane: 4 }, { beat: 30.5, lane: 2 }, { beat: 31.25, lane: 1 },
      { beat: 32, lane: 0 }, { beat: 32.75, lane: 2 }, { beat: 33.5, lane: 4 }, { beat: 34.25, lane: 5 },
      { beat: 35.5, lane: 1, chord: true }, { beat: 35.5, lane: 5, chord: true },
      { beat: 37, lane: 2, chord: true }, { beat: 37, lane: 6, chord: true },
      { beat: 38.5, lane: 4 }, { beat: 39.25, lane: 2 }, { beat: 40, lane: 1 },
      { beat: 41.5, lane: 0, chord: true }, { beat: 41.5, lane: 4, chord: true },
    ],
  },

  // ==========================================================================
  // CHING (Levels 1 - 3)
  // ==========================================================================
  {
    id: 'ching-lvl1-2chan',
    instrument: 'ching',
    level: 1,
    bpm: 75,
    leadInBeats: 4,
    title: { th: 'จังหวะฉิ่งสองชั้นพื้นฐาน', en: 'Ching Basic 2-Chan' },
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
  {
    id: 'ching-lvl2-ramwong',
    instrument: 'ching',
    level: 2,
    bpm: 95,
    leadInBeats: 4,
    title: { th: 'จังหวะรำวงลอยกระทง', en: 'Ramwong Loy Krathong Rhythm' },
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
  {
    id: 'ching-lvl3-1chan',
    instrument: 'ching',
    level: 3,
    bpm: 120,
    leadInBeats: 4,
    title: { th: 'จังหวะโหมโรงชั้นเดียว (เร็ว)', en: 'Hom Rong 1-Chan Rapid' },
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

  // ==========================================================================
  // TAPHON / THAI DRUM (Levels 1 - 3) — Zones: 0:ติง, 1:ทุ่ม, 2:ป๊ะ, 3:จ๊ะ
  // ==========================================================================
  {
    id: 'taphon-lvl1-propkai',
    instrument: 'taphon',
    level: 1,
    bpm: 75,
    leadInBeats: 4,
    title: { th: 'หน้าทับปรบไก่พื้นฐาน', en: 'Basic Prop Kai Drum' },
    notes: [
      { beat: 0, lane: 1 }, { beat: 2, lane: 2 }, { beat: 4, lane: 1 }, { beat: 6, lane: 0 },
      { beat: 8, lane: 1 }, { beat: 10, lane: 2 }, { beat: 12, lane: 3 }, { beat: 14, lane: 1 },
      { beat: 16, lane: 1 }, { beat: 18, lane: 2 }, { beat: 20, lane: 0 }, { beat: 22, lane: 3 },
      { beat: 24, lane: 1 }, { beat: 26, lane: 2 }, { beat: 28, lane: 1 }, { beat: 30, lane: 2 },
      { beat: 32, lane: 0 }, { beat: 34, lane: 1 }, { beat: 36, lane: 2 }, { beat: 38, lane: 3 },
      { beat: 40, lane: 1 }, { beat: 42, lane: 2 }, { beat: 44, lane: 1 },
    ],
  },
  {
    id: 'taphon-lvl2-songmai',
    instrument: 'taphon',
    level: 2,
    bpm: 95,
    leadInBeats: 4,
    title: { th: 'หน้าทับสองไม้ (Song Mai)', en: 'Song Mai Drum Pattern' },
    notes: [
      { beat: 0, lane: 1 }, { beat: 1.5, lane: 2 }, { beat: 3, lane: 0 }, { beat: 4, lane: 1 },
      { beat: 5.5, lane: 2 }, { beat: 7, lane: 3 }, { beat: 8, lane: 1 }, { beat: 9.5, lane: 0 },
      { beat: 11, lane: 2 }, { beat: 12, lane: 3 }, { beat: 13.5, lane: 1 }, { beat: 15, lane: 2 },
      { beat: 16, lane: 0 }, { beat: 17, lane: 1 }, { beat: 18.5, lane: 2 }, { beat: 20, lane: 3 },
      { beat: 21.5, lane: 1 }, { beat: 23, lane: 2 }, { beat: 24, lane: 1 }, { beat: 25.5, lane: 0 },
      { beat: 27, lane: 2 }, { beat: 28.5, lane: 3 }, { beat: 30, lane: 1 }, { beat: 31.5, lane: 2 },
      { beat: 33, lane: 0 }, { beat: 34.5, lane: 3 }, { beat: 36, lane: 1 }, { beat: 37.5, lane: 2 },
      { beat: 39, lane: 1 },
    ],
  },
  {
    id: 'taphon-lvl3-homrong',
    instrument: 'taphon',
    level: 3,
    bpm: 120,
    leadInBeats: 4,
    title: { th: 'หน้าทับโหมโรงประยุกต์', en: 'Hom Rong Rapid Taphon' },
    notes: [
      { beat: 0, lane: 1, chord: true }, { beat: 0, lane: 2, chord: true },
      { beat: 1.5, lane: 0 }, { beat: 2.25, lane: 1 }, { beat: 3, lane: 2 }, { beat: 3.75, lane: 3 },
      { beat: 5, lane: 1 }, { beat: 5.75, lane: 2 }, { beat: 6.5, lane: 1 }, { beat: 7.25, lane: 0 },
      { beat: 8.5, lane: 0, chord: true }, { beat: 8.5, lane: 3, chord: true },
      { beat: 10, lane: 1 }, { beat: 10.75, lane: 2 }, { beat: 11.5, lane: 3 }, { beat: 12.25, lane: 2 },
      { beat: 13, lane: 1 }, { beat: 13.75, lane: 0 }, { beat: 14.5, lane: 1 }, { beat: 15.25, lane: 2 },
      { beat: 16.5, lane: 1, chord: true }, { beat: 16.5, lane: 2, chord: true },
      { beat: 18, lane: 0 }, { beat: 18.75, lane: 3 }, { beat: 19.5, lane: 0 }, { beat: 20.25, lane: 3 },
      { beat: 21, lane: 1 }, { beat: 21.75, lane: 2 }, { beat: 22.5, lane: 1 }, { beat: 23.25, lane: 2 },
      { beat: 24.5, lane: 1, chord: true }, { beat: 24.5, lane: 3, chord: true },
      { beat: 26, lane: 0 }, { beat: 26.75, lane: 1 }, { beat: 27.5, lane: 2 }, { beat: 28.25, lane: 3 },
      { beat: 29, lane: 2 }, { beat: 29.75, lane: 1 }, { beat: 30.5, lane: 0 },
      { beat: 32, lane: 1, chord: true }, { beat: 32, lane: 2, chord: true },
    ],
  },

  // ==========================================================================
  // KHLUI / BAMBOO FLUTE (Levels 1 - 3) — Lanes 0..4 => 1..5 Extended Fingers
  // ==========================================================================
  {
    id: 'khlui-lvl1-laokhamhom',
    instrument: 'khlui',
    level: 1,
    bpm: 75,
    leadInBeats: 4,
    title: { th: 'ลาวคำหอม (พื้นฐาน)', en: 'Lao Kham Hom — Gentle Flute' },
    notes: [
      { beat: 0, lane: 0 }, { beat: 2.5, lane: 1 }, { beat: 5, lane: 2 }, { beat: 7.5, lane: 3 },
      { beat: 10, lane: 4 }, { beat: 12.5, lane: 3 }, { beat: 15, lane: 2 }, { beat: 17.5, lane: 1 },
      { beat: 20, lane: 0 }, { beat: 22.5, lane: 2 }, { beat: 25, lane: 3 }, { beat: 27.5, lane: 2 },
      { beat: 30, lane: 1 }, { beat: 32.5, lane: 2 }, { beat: 35, lane: 3 }, { beat: 37.5, lane: 4 },
      { beat: 40, lane: 3 }, { beat: 42.5, lane: 2 }, { beat: 45, lane: 0 },
    ],
  },
  {
    id: 'khlui-lvl2-khamensaiyok',
    instrument: 'khlui',
    level: 2,
    bpm: 95,
    leadInBeats: 4,
    title: { th: 'เขมรไทรโยค (ทำนองขลุ่ย)', en: 'Khamen Sai Yok — Flute Motif' },
    notes: [
      { beat: 0, lane: 2 }, { beat: 1.5, lane: 3 }, { beat: 3, lane: 4 }, { beat: 4.5, lane: 3 },
      { beat: 6, lane: 2 }, { beat: 7.5, lane: 1 }, { beat: 9, lane: 2 }, { beat: 10.5, lane: 3 },
      { beat: 12, lane: 2 }, { beat: 13.5, lane: 1 }, { beat: 15, lane: 0 }, { beat: 16.5, lane: 1 },
      { beat: 18, lane: 2 }, { beat: 19.5, lane: 3 }, { beat: 21, lane: 4 }, { beat: 22.5, lane: 3 },
      { beat: 24, lane: 2 }, { beat: 25.5, lane: 1 }, { beat: 27, lane: 0 }, { beat: 28.5, lane: 2 },
      { beat: 30, lane: 3 }, { beat: 31.5, lane: 4 }, { beat: 33, lane: 3 }, { beat: 34.5, lane: 2 },
      { beat: 36, lane: 1 }, { beat: 37.5, lane: 0 },
    ],
  },
  {
    id: 'khlui-lvl3-phamahe',
    instrument: 'khlui',
    level: 3,
    bpm: 120,
    leadInBeats: 4,
    title: { th: 'พม่าเห่ (ขลุ่ยพริ้วเร็ว)', en: 'Phama He — Allegro Flute' },
    notes: [
      { beat: 0, lane: 0 }, { beat: 1.25, lane: 1 }, { beat: 2.5, lane: 2 }, { beat: 3.75, lane: 3 },
      { beat: 5, lane: 4 }, { beat: 6.25, lane: 3 }, { beat: 7.5, lane: 2 }, { beat: 8.75, lane: 3 },
      { beat: 10, lane: 4 }, { beat: 11.25, lane: 2 }, { beat: 12.5, lane: 1 }, { beat: 13.75, lane: 0 },
      { beat: 15, lane: 1 }, { beat: 16.25, lane: 2 }, { beat: 17.5, lane: 3 }, { beat: 18.75, lane: 4 },
      { beat: 20, lane: 3 }, { beat: 21.25, lane: 2 }, { beat: 22.5, lane: 1 }, { beat: 23.75, lane: 2 },
      { beat: 25, lane: 3 }, { beat: 26.25, lane: 4 }, { beat: 27.5, lane: 3 }, { beat: 28.75, lane: 1 },
      { beat: 30, lane: 0 }, { beat: 31.25, lane: 2 }, { beat: 32.5, lane: 4 }, { beat: 33.75, lane: 3 },
      { beat: 35, lane: 2 }, { beat: 36.25, lane: 1 }, { beat: 37.5, lane: 0 },
    ],
  },
];

export function getBeatmap(instrument, level) {
  return BEATMAPS.find((b) => b.instrument === instrument && b.level === Number(level)) || BEATMAPS[0];
}

export function buildTimeline(beatmap) {
  const secPerBeat = 60 / beatmap.bpm;
  const leadInSec = (beatmap.leadInBeats || 4) * secPerBeat;

  const notes = beatmap.notes.map((n, index) => ({
    id: index,
    beat: n.beat,
    time: leadInSec + n.beat * secPerBeat,
    lane: n.lane ?? 0,
    type: n.type ?? beatmap.instrument,
    chord: Boolean(n.chord),
    status: 'pending',
  }));

  const lastNoteTime = notes.length ? notes[notes.length - 1].time : leadInSec;
  const totalDuration = lastNoteTime + 2.4;

  return {
    secPerBeat,
    leadInSec,
    totalDuration,
    notes,
  };
}
