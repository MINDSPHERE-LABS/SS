// OneView Coach Live Dashboard Client
(function () {
  // Query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session') || 'oneview-live';

  // DOM Elements
  const sessionLabel = document.getElementById('sessionLabel');
  const connectionBadge = document.getElementById('connectionBadge');
  const connectionText = document.getElementById('connectionText');
  const fpsValue = document.getElementById('fpsValue');
  const feedResolution = document.getElementById('feedResolution');
  const waitingPlaceholder = document.getElementById('waitingPlaceholder');
  const screenCanvas = document.getElementById('screenCanvas');
  const canvasCtx = screenCanvas.getContext('2d');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const snapshotBtn = document.getElementById('snapshotBtn');
  const canvasContainer = document.getElementById('canvasContainer');

  // Vitals & Telemetry Elements
  const hrValue = document.getElementById('hrValue');
  const stressBadge = document.getElementById('stressBadge');
  const heartSvg = document.getElementById('heartSvg');
  const ecgCanvas = document.getElementById('ecgCanvas');
  const ecgCtx = ecgCanvas.getContext('2d');
  const stepsValue = document.getElementById('stepsValue');
  const stepsGoal = document.getElementById('stepsGoal');
  const caloriesValue = document.getElementById('caloriesValue');
  const caloriesGoal = document.getElementById('caloriesGoal');
  const hydrationValue = document.getElementById('hydrationValue');
  const hydrationGoal = document.getElementById('hydrationGoal');
  const recoveryValue = document.getElementById('recoveryValue');
  const breathingPhase = document.getElementById('breathingPhase');
  const breathingProgress = document.getElementById('breathingProgress');

  // Cues Elements
  const cueButtons = document.querySelectorAll('.cue-btn');
  const customCueInput = document.getElementById('customCueInput');
  const sendCustomCueBtn = document.getElementById('sendCustomCueBtn');
  const cuesHistory = document.getElementById('cuesHistory');

  sessionLabel.textContent = `Session: ${sessionId}`;

  // WebSocket Connection
  let ws = null;
  let isAthleteConnected = false;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;
  let ecgPoints = [];

  // Setup ECG Canvas size
  function resizeEcg() {
    ecgCanvas.width = ecgCanvas.clientWidth * window.devicePixelRatio;
    ecgCanvas.height = ecgCanvas.clientHeight * window.devicePixelRatio;
    drawEcg();
  }
  window.addEventListener('resize', resizeEcg);
  setTimeout(resizeEcg, 100);

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?role=coach&session=${encodeURIComponent(sessionId)}`;

    ws = new WebSocket(wsUrl);
    ws.binaryType = 'blob';

    ws.onopen = () => {
      console.log('Connected to OneView Coach Relay Server');
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        // Binary JPEG frame
        handleBinaryFrame(event.data);
      } else {
        // JSON Telemetry or status
        try {
          const msg = JSON.parse(event.data);
          handleJsonMessage(msg);
        } catch (err) {
          console.error('Failed to parse incoming JSON:', err);
        }
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed, retrying in 2s...');
      updateAthleteStatus(false);
      setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  // Handle incoming JPEG frame
  async function handleBinaryFrame(blob) {
    if (!isAthleteConnected) {
      updateAthleteStatus(true);
    }

    try {
      const imgBitmap = await createImageBitmap(blob);

      if (screenCanvas.width !== imgBitmap.width || screenCanvas.height !== imgBitmap.height) {
        screenCanvas.width = imgBitmap.width;
        screenCanvas.height = imgBitmap.height;
        feedResolution.textContent = `${imgBitmap.width} × ${imgBitmap.height}`;
      }

      if (screenCanvas.style.display !== 'block') {
        screenCanvas.style.display = 'block';
        waitingPlaceholder.style.display = 'none';
      }

      canvasCtx.drawImage(imgBitmap, 0, 0);
      imgBitmap.close();

      // FPS Calculation
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        fpsValue.textContent = currentFps;
        frameCount = 0;
        lastFpsTime = now;
      }
    } catch (e) {
      console.error('Error rendering frame bitmap:', e);
    }
  }

  // Handle JSON message
  function handleJsonMessage(msg) {
    if (msg.type === 'session_init') {
      updateAthleteStatus(msg.athleteConnected);
      if (msg.telemetry) {
        renderTelemetry(msg.telemetry);
      }
    } else if (msg.type === 'athlete_status') {
      updateAthleteStatus(msg.connected);
    } else if (msg.type === 'telemetry') {
      renderTelemetry(msg.payload);
      if (msg.fps !== undefined && msg.fps > 0) {
        fpsValue.textContent = msg.fps;
      }
    }
  }

  function updateAthleteStatus(connected) {
    isAthleteConnected = connected;
    if (connected) {
      connectionBadge.className = 'status-badge live';
      connectionText.textContent = 'Athlete Live';
    } else {
      connectionBadge.className = 'status-badge waiting';
      connectionText.textContent = 'Waiting for Athlete...';
      screenCanvas.style.display = 'none';
      waitingPlaceholder.style.display = 'flex';
      feedResolution.textContent = 'Offline';
      fpsValue.textContent = '0';
    }
  }

  // Render Telemetry
  function renderTelemetry(t) {
    if (!t) return;

    if (t.heartRate !== undefined) {
      hrValue.textContent = t.heartRate;
      // Adjust heartbeat animation speed dynamically based on HR!
      const beatDuration = (60 / t.heartRate).toFixed(2);
      heartSvg.style.animationDuration = `${beatDuration}s`;
    }

    if (t.stressLevel) {
      stressBadge.textContent = t.stressLevel;
      stressBadge.className = `stress-badge ${t.stressLevel.toLowerCase()}`;
    }

    if (t.ecgWavePoints && Array.isArray(t.ecgWavePoints)) {
      ecgPoints = t.ecgWavePoints;
      drawEcg();
    }

    if (t.steps !== undefined) {
      stepsValue.textContent = Number(t.steps).toLocaleString();
      if (t.stepGoal) stepsGoal.textContent = `Goal: ${Number(t.stepGoal).toLocaleString()}`;
    }

    if (t.caloriesBurned !== undefined) {
      caloriesValue.textContent = `${t.caloriesBurned} kcal`;
      if (t.calorieGoal) caloriesGoal.textContent = `Goal: ${t.calorieGoal} kcal`;
    }

    if (t.hydrationMl !== undefined) {
      hydrationValue.textContent = `${t.hydrationMl} ml`;
      if (t.hydrationGoalMl) hydrationGoal.textContent = `Goal: ${t.hydrationGoalMl} ml`;
    }

    if (t.bodyBattery !== undefined) {
      recoveryValue.textContent = `${t.bodyBattery}%`;
    }

    if (t.breathingPhase) {
      breathingPhase.textContent = t.breathingPhase;
    }

    if (t.breathingProgress !== undefined) {
      breathingProgress.style.width = `${Math.round(t.breathingProgress * 100)}%`;
    }
  }

  // Draw smooth ECG line
  function drawEcg() {
    if (!ecgPoints.length) return;
    const w = ecgCanvas.width;
    const h = ecgCanvas.height;

    ecgCtx.clearRect(0, 0, w, h);
    ecgCtx.lineWidth = 3 * window.devicePixelRatio;
    ecgCtx.strokeStyle = '#00F5A0';
    ecgCtx.lineJoin = 'round';
    ecgCtx.lineCap = 'round';

    ecgCtx.beginPath();
    const stepX = w / (ecgPoints.length - 1);
    const midY = h * 0.55;

    for (let i = 0; i < ecgPoints.length; i++) {
      const x = i * stepX;
      const y = midY - (ecgPoints[i] * (h * 0.45));
      if (i === 0) {
        ecgCtx.moveTo(x, y);
      } else {
        ecgCtx.lineTo(x, y);
      }
    }
    ecgCtx.stroke();
  }

  // Coaching Cues
  function sendCoachCue(message) {
    if (!message || !message.trim()) return;
    const cuePayload = {
      type: 'coach_cue',
      sessionId: sessionId,
      message: message.trim(),
      timestamp: Date.now()
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cuePayload));
      addCueToHistory(message);
    } else {
      alert('Relay server not connected!');
    }
  }

  function addCueToHistory(text) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    item.innerHTML = `<span>${escapeHtml(text)}</span><span class="history-time">${timeStr}</span>`;
    cuesHistory.prepend(item);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  cueButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sendCoachCue(btn.getAttribute('data-cue'));
    });
  });

  sendCustomCueBtn.addEventListener('click', () => {
    sendCoachCue(customCueInput.value);
    customCueInput.value = '';
  });

  customCueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendCoachCue(customCueInput.value);
      customCueInput.value = '';
    }
  });

  // Copy Link
  copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      const orig = copyLinkBtn.querySelector('span').textContent;
      copyLinkBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        copyLinkBtn.querySelector('span').textContent = orig;
      }, 2000);
    });
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      canvasContainer.requestFullscreen().catch(err => {
        console.error('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  });

  // Snapshot
  snapshotBtn.addEventListener('click', () => {
    if (!isAthleteConnected || screenCanvas.style.display === 'none') {
      alert('No active screen stream to capture!');
      return;
    }
    const dataUrl = screenCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `athlete-screen-${Date.now()}.png`;
    a.click();
  });

  // Start connection
  connect();
})();

