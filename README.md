# Siam Rhythm (สยามจังหวะ) — Thai Traditional Music Rhythm Game

A client-side, zero-install **Thai Traditional Music Rhythm Game** powered by real-time webcam hand tracking (`@mediapipe/tasks-vision` `HandLandmarker`) and pure `Web Audio API` synthesis. Designed with **Universal Design for Learning (UDL)** and **WCAG/ARIA** accessibility principles for all ages (children, adults, and seniors), with bilingual **Thai / English** support and full **Mobile + Classroom PWA** readiness.

---

## Key Features

### 1. Four Selectable Thai Traditional Instruments (36 Songs Total)
All pitched instruments use **Thai 7-Tone Equidistant Tuning (7-TET, ~171.43 cents/step)** relative to C5 (`THAI_ROOT_HZ = 523.25 Hz`, customizable in `js/beatmaps.js`).

| Instrument | Tracking & Controls | Keyboard / Touch Pads | Songs |
| :--- | :--- | :--- | :---: |
| **ระนาดเอก (Ranat Ek)** | Downward velocity strike (`deltaY` + `vy`) with `165ms` per-hand/key cooldown. Selectable **Index Fingertip (Landmark 8)** or **Palm Center (Landmark 9)**. | `A S D F G` (5 keys) / `A S D F G H J` (7 keys) | 9 (3/level) |
| **ฉิ่ง (Ching)** | Scale-normalized two-palm distance (`palmDist / avgHandSize`): touch & release = **ฉิ่ง (Open)**; touch & hold `≥ 185ms` = **ฉับ (Dampened, chokes ringing Ching)**. | `C` / `Space` (Ching), `V` / `Enter` (Chab) | 9 (3/level) |
| **ตะโพน / กลองไทย (Taphon)** | Downward **Wrist (Landmark 0)** velocity across 4 drum zones with per-zone cooldown: Left Rim (`ติง`), Left Head (`ทุ่ม`), Right Head (`ป๊ะ`), Right Rim (`จ๊ะ`). | `A` (`ติง`), `S` (`ทุ่ม`), `D` (`ป๊ะ`), `F` (`จ๊ะ`) | 9 (3/level) |
| **ขลุ่ยเพียงออ (Khlui)** | Rotation-invariant **1–5 extended finger count** (wrist-distance geometry + separate thumb check + 4-frame debounce) synthesized with oscillator + LFO vibrato + breath noise. | `1` (`ด`), `2` (`ร`), `3` (`ม`), `4` (`ซ`), `5` (`ล`) | 9 (3/level) |

### 2. Progressive 3-Level Difficulty System
- **Level 1 — Beginner (พื้นฐาน):** `75 BPM`, 5 wide Ranat keys (`ด ร ม ซ ล`), `±150ms` Perfect / `±300ms` Good, slower note fall speed, visual target aids, and single-hand readiness check (friendly for narrow mobile front cameras).
- **Level 2 — Intermediate (ปานกลาง):** `95 BPM`, full 7-tone Thai scale (`ด ร ม ฟ ซ ล ท`), `±100ms` Perfect / `±220ms` Good, alternating hand patterns.
- **Level 3 — Master (ท้าทาย):** `120 BPM`, 7 keys, rapid passages & simultaneous two-hand chords (ตีคู่/กรอ), `±70ms` Perfect / `±150ms` Good, and **Combo Multipliers (`x2` at 10+, `x4` at 25+)**.

### 3. Audio-Synced Engine & Dual Latency Calibration
- Strictly anchored to Web Audio hardware timing (`getOutputTimestamp()` / `outputLatency` fallback to `audioCtx.currentTime` — never `setInterval`).
- Built-in Web Audio Thai instrument synthesizer works out-of-the-box, with `audioEngine.loadSample(name, url)` ready to swap in `.wav` recordings later.
- **Dual Latency Offset (`±200ms`):** Separate `localStorage` profiles for **Camera Mode** (measured via 8-beat real webcam hand-claps) and **Touch / Keyboard Mode** (measured via 8-beat tap/Spacebar), using the **median** to filter outliers.

### 4. Mobile, Accessibility (WCAG/ARIA) & Offline Classroom PWA
- **Mobile-First:** `100dvh` viewport sizing, sticky bottom CTA bar, responsive portrait/landscape HUD, synced **Multi-Touch On-Screen Pad** with gentle haptic feedback (`navigator.vibrate`), **Screen Wake Lock**, **Auto-Pause** on app switch/call (`visibilitychange` / `pagehide`), iOS first-tap audio unlock, and MediaPipe **GPU → CPU fallback** capped at `640×480 @ 30 FPS`.
- **Accessibility:** Valid HTML5 phrasing markup inside `<button>` radio cards, ARIA `radiogroup` with roving `tabindex` & arrow-key navigation, focus-trapped `aria-modal` dialogs (`Tab` trap, `Esc` close, focus return), dynamic TH/EN `aria-label` & slider `aria-valuetext`, `≥ 44×44px` touch targets, inline SVG instrument icons, and `<noscript>` fallback.
- **Privacy & Offline PWA:** Zero external fonts (local system Thai/Latin font stack). Camera video is processed **100% locally** and never recorded or uploaded. Includes `manifest.json`, `192×192` / `512×512` PNG icons, and `sw.js` Service Worker that caches the app shell and MediaPipe WASM/model assets after first load for offline classroom use.

---

## Project Structure

```text
├── index.html          # Semantic HTML5 layout, inline SVG icons, HUD & modals
├── manifest.json       # Installable PWA manifest (192x192 & 512x512 PNG icons)
├── sw.js               # Offline-first classroom Service Worker (App Shell + MediaPipe cache)
├── icons/
│   ├── icon-192.png    # PWA icon (192x192)
│   └── icon-512.png    # PWA icon (512x512)
├── css/
│   └── style.css       # Thai-modern dark theme, UDL touch targets & mobile 100dvh styles
└── js/
    ├── main.js         # UI controller, TH/EN i18n, ARIA/focus trap, dual latency sync, touch pad & Wake Lock
    ├── vision.js       # MediaPipe HandLandmarker (GPU->CPU fallback, 30fps cap) & anti-bug gesture logic
    ├── audio.js        # Web Audio API Thai instrument synthesizer & output-compensated clock
    ├── gameEngine.js   # Audio-synced rhythm loop, hit detection, calibration & DPR-scaled Canvas renderer
    └── beatmaps.js     # Thai 7-TET tuning, extensible Beatmap Schema & 36 Thai songs
```

---

## Run Locally

Because ES6 modules, Service Workers, and webcam access (`getUserMedia`) require `http://localhost` or `https://` (browsers block them on `file://`), serve the folder with a local static server:

- **Option 1: VS Code Live Server**
  1. Install the **Live Server** extension in VS Code.
  2. Right-click `index.html` → **Open with Live Server**.
- **Option 2: Python HTTP Server**
  ```bash
  python -m http.server 8000
  ```
  Then open `http://localhost:8000` in Chrome, Edge, or Safari.
- **Option 3: Node (`npx serve`)**
  ```bash
  npx serve .
  ```

---

## Deploy to GitHub Pages (HTTPS)

1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
2. Open your repository on GitHub → **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch** → select `main` and `/ (root)` → click **Save**.
4. Access your live HTTPS app at `https://<username>.github.io/<repo-name>/` (GitHub Pages automatically serves HTTPS, enabling webcam tracking, Wake Lock, and PWA installation on desktop & mobile).
