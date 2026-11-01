# OneView Coach Relay & Live Dashboard 🫀📱

Real-time, low-latency screen sharing relay server and web dashboard designed for coaches to observe athlete live screens, synchronized vital telemetry, ECG waveforms, and issue real-time coaching cues.

---

## ⚡ Features

- **Real-Time Live Canvas Feed:** Renders incoming binary JPEG/PNG screen frames with dynamic resolution tracking and live FPS counters.
- **Synchronized Vitals HUD:** Real-time Heart Rate (BPM), $\text{SpO}_2$, Stress Level, Hydration tracking, Active Calories, and Step counts.
- **Continuous ECG Waveform:** Smooth HTML5 canvas ECG waveform plotted in sync with athlete telemetry.
- **Bidirectional Coaching Cues:** Send actionable prompts (*"Breathe Deeply"*, *"Form Check"*, *"Lower Heart Rate"*, or custom coaching advice) straight to the athlete's screen.
- **Snapshot Capture & Fullscreen Mode:** One-click frame capture and distraction-free viewing for coaches.
- **ADB Whole-Screen Companion Bridge:** Stream the entire Android phone screen directly without system prompt dialogs or status bar recording indicators.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or pnpm

### Installation

```bash
npm install
```

### Running the Server

Start the NestJS relay server and Coach web dashboard:

```bash
npm start
```

The server boots at:
- **Local Dashboard:** `http://localhost:3000/?session=oneview-live`
- **Network / LAN:** `http://<your-lan-ip>:3000/?session=oneview-live`
- **WebSocket Endpoint:** `ws://<your-lan-ip>:3000/ws`

---

## 📱 Streaming Options

### 1. In-App Direct Stream (OneView Android App)
Connect the mobile app over WebSocket to `ws://<server-ip>:3000/ws?role=athlete&session=oneview-live`. Uses hardware `PixelCopy` for zero-overhead streaming without system notifications.

### 2. Whole Screen ADB Companion Bridge
Stream the entire phone screen across all apps and home screen without Android 14 status bar recording chips:

```bash
npm run stream:adb
```

---

## 📡 REST API Endpoints

- `GET /api/status` — Returns server uptime and metrics for all active sessions (athlete connection status, frame counts, FPS, byte throughput).
- `GET /api/sessions` — Lists currently active coaching sessions.

---

## 🛠️ Tech Stack

- **Backend:** NestJS, Express, ws (WebSocket Server)
- **Frontend:** Vanilla HTML5 Canvas, modern CSS variables, responsive dark-mode UI
- **Companion Tooling:** ADB, tsx

