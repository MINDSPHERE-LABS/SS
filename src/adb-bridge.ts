import { spawn, execSync } from 'child_process';
import WebSocket from 'ws';

const SESSION_ID = process.env.SESSION_ID || 'oneview-live';
const RELAY_WS_URL =
  process.env.RELAY_WS_URL || `wss://ss-srnm.onrender.com/ws?role=athlete&session=${SESSION_ID}`;

function getConnectedDeviceSerial(): string {
  if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
  try {
    const output = execSync('adb devices', { encoding: 'utf-8' });
    const lines = output.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        return parts[0];
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

const DEVICE_SERIAL = getConnectedDeviceSerial();

console.log(`========================================================`);
console.log(`🚀 [ADB Silent Bridge] Option B: Zero-Popup Screen Sharing`);
console.log(`   Session:       ${SESSION_ID}`);
console.log(`   Relay URL:     ${RELAY_WS_URL}`);
console.log(`   Target Device: ${DEVICE_SERIAL || 'Default ADB device'}`);
console.log(`   Status:        100% Silent, No Red Bar, Whole Screen`);
console.log(`========================================================`);

let ws: WebSocket | null = null;
let isRunning = true;
let telemetryTimer: NodeJS.Timeout | null = null;

function connectWs() {
  ws = new WebSocket(RELAY_WS_URL);

  ws.on('open', () => {
    console.log('[ADB Bridge] Connected to Coach Relay WebSocket!');
    startTelemetryLoop();
    captureLoop();
  });

  ws.on('message', (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'coach_cue') {
        console.log(`[Coach Cue Received]: "${msg.message}"`);
      }
    } catch (_) {}
  });

  ws.on('error', (err) => {
    console.error('[ADB Bridge] WS error:', err.message);
  });

  ws.on('close', () => {
    console.log('[ADB Bridge] WS closed, reconnecting in 2s...');
    if (telemetryTimer) clearInterval(telemetryTimer);
    setTimeout(connectWs, 2000);
  });
}

function startTelemetryLoop() {
  if (telemetryTimer) clearInterval(telemetryTimer);
  let heartRate = 72;
  telemetryTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    heartRate += Math.floor(Math.random() * 5) - 2;
    if (heartRate < 65) heartRate = 65;
    if (heartRate > 88) heartRate = 88;

    const telemetry = {
      type: 'telemetry',
      sessionId: SESSION_ID,
      data: {
        heartRate,
        stress: heartRate > 80 ? 'Elevated' : 'Balanced',
        spO2: 98,
        steps: 6280,
        calories: 418,
        battery: 85,
        hydrationMl: 1250,
        hydrationGoalMl: 2500,
        breathingPhase: 'Inhale',
        breathingProgress: 0.65,
      },
    };
    ws.send(JSON.stringify(telemetry));
  }, 1000);
}

async function captureLoop() {
  while (isRunning && ws && ws.readyState === WebSocket.OPEN) {
    try {
      const frameBuffer = await captureScreen();
      if (frameBuffer && frameBuffer.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(frameBuffer);
      }
    } catch (err: any) {
      await new Promise((r) => setTimeout(r, 150));
    }
    // Dynamic throttle: smooth responsive stream
    await new Promise((r) => setTimeout(r, 70));
  }
}

function captureScreen(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = DEVICE_SERIAL
      ? ['-s', DEVICE_SERIAL, 'exec-out', 'screencap', '-p']
      : ['exec-out', 'screencap', '-p'];

    const proc = spawn('adb', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];

    proc.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`adb exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

connectWs();

process.on('SIGINT', () => {
  isRunning = false;
  if (telemetryTimer) clearInterval(telemetryTimer);
  if (ws) ws.close();
  process.exit(0);
});

