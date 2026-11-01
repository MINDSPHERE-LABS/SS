import { spawn } from 'child_process';
import WebSocket from 'ws';

const SESSION_ID = process.env.SESSION_ID || 'oneview-live';
const RELAY_WS_URL = process.env.RELAY_WS_URL || `wss://ss-eb5j.onrender.com/ws?role=athlete&session=${SESSION_ID}`;
const DEVICE_SERIAL = process.env.ANDROID_SERIAL || '';

console.log(`[ADB Bridge] Starting Whole Screen ADB Bridge for session [${SESSION_ID}]...`);

let ws: WebSocket | null = null;
let isRunning = true;

function connectWs() {
  ws = new WebSocket(RELAY_WS_URL);

  ws.on('open', () => {
    console.log('[ADB Bridge] Connected to Coach Relay WebSocket!');
    captureLoop();
  });

  ws.on('error', (err) => {
    console.error('[ADB Bridge] WS error:', err.message);
  });

  ws.on('close', () => {
    console.log('[ADB Bridge] WS closed, reconnecting in 2s...');
    setTimeout(connectWs, 2000);
  });
}

async function captureLoop() {
  while (isRunning && ws && ws.readyState === WebSocket.OPEN) {
    try {
      const frameBuffer = await captureScreen();
      if (frameBuffer && frameBuffer.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(frameBuffer);
      }
    } catch (err: any) {
      // Small pause on error
      await new Promise((r) => setTimeout(r, 200));
    }
    // Rate limit ~15-20 FPS for optimal responsiveness
    await new Promise((r) => setTimeout(r, 60));
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
  if (ws) ws.close();
  process.exit(0);
});

