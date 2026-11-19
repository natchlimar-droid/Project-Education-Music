# Siam Rhythm (สยามจังหวะ) — Thai Traditional Music Rhythm Game

A 100% client-side, zero-install **Thai Traditional Music Rhythm Game** powered by real-time webcam hand tracking (`@mediapipe/tasks-vision` HandLandmarker) and pure `Web Audio API` synthesis. Designed with **Universal Design for Learning (UDL)** principles for all ages, featuring bilingual support (Thai / English).

## Features
- **2 Selectable Thai Instruments:**
  - **Ranat Ek (ระนาดเอก):** Virtual wooden xylophone bars with downward velocity strike detection, 165ms anti-double-trigger cooldown, and selectable fingertip (Landmark 8) or palm center (Landmark 9) tracking.
  - **Ching (ฉิ่ง):** Scale-normalized two-palm tracking distinguishing **Ching** (open ringing chime: touch & release) vs **Chab** (dampened snap: touch & hold briefly).
- **Progressive 3-Level Difficulty:**
  - **Level 1 (Beginner / พื้นฐาน):** 75 BPM, 5 wide keys (`ด, ร, ม, ซ, ล`), `±150ms` Perfect / `±300ms` Good, visual target aids.
  - **Level 2 (Intermediate / ปานกลาง):** 95 BPM, 7 keys (`ด, ร, ม, ฟ, ซ, ล, ท`), `±100ms` Perfect / `±220ms` Good.
  - **Level 3 (Master / ท้าทาย):** 120 BPM, 7 keys, rapid passages & two-hand chords (ตีคู่), `±70ms` Perfect / `±150ms` Good, `x2` / `x4` combo multipliers.
- **Audio-Synced Engine:** All rhythm timing is strictly anchored to `audioCtx.currentTime` with built-in Web Audio synthesis (ready to swap in `.wav` AudioBuffers via `audioEngine.loadSample()`).
- **Privacy-First:** Runs entirely on-device in the browser. No video or images are recorded or uploaded.

## Project Structure
```text
├── index.html          # Main semantic HTML & HUD/Overlay layout
├── css/
│   └── style.css       # Thai-modern dark theme & UDL responsive styles
└── js/
    ├── main.js         # UI controller, TH/EN i18n, localStorage progression
    ├── vision.js       # MediaPipe HandLandmarker & anti-bug gesture logic
    ├── audio.js        # Web Audio API Thai instrument synthesizer & clock
    ├── gameEngine.js   # Audio-synced rhythm loop, hit detection & Canvas renderer
    └── beatmaps.js     # Extensible Beatmap Schema & 6 sample Thai songs
```

## Run Locally
ES6 modules and webcam access (`getUserMedia`) require serving via `http://localhost` or `https://` (opening `index.html` via `file://` will be blocked by browser CORS/camera policies).

- **Option 1: VS Code Live Server**
  1. Install the **Live Server** extension in VS Code.
  2. Right-click `index.html` → **Open with Live Server**.
- **Option 2: Python HTTP Server**
  ```bash
  python -m http.server 8000
  ```
  Then open `http://localhost:8000` in Chrome, Edge, or Safari.

## Deploy to GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **Deploy from a branch**, choose `main` and `/ (root)`, then click **Save**.
4. Your app will be live over HTTPS at `https://<username>.github.io/<repo-name>/` (HTTPS is automatically provided by GitHub Pages, enabling webcam access on all devices).

