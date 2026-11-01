import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';

export interface TelemetryData {
  heartRate?: number;
  stressLevel?: string;
  ecgWavePoints?: number[];
  steps?: number;
  caloriesBurned?: number;
  hydrationMl?: number;
  hydrationGoalMl?: number;
  bodyBattery?: number;
  breathingPhase?: string;
  breathingProgress?: number;
  connectionLatencyMs?: number;
  timestamp?: number;
}

export interface SessionState {
  id: string;
  athleteWs: WebSocket | null;
  coachWsList: Set<WebSocket>;
  lastTelemetry: TelemetryData | null;
  frameCount: number;
  bytesReceived: number;
  currentFps: number;
  fpsTimer: number;
  fpsCounter: number;
  startedAt: number;
}

@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);
  private sessions = new Map<string, SessionState>();
  private socketSessionMap = new Map<WebSocket, { sessionId: string; role: 'athlete' | 'coach' }>();

  getOrCreateSession(sessionId: string): SessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        athleteWs: null,
        coachWsList: new Set<WebSocket>(),
        lastTelemetry: null,
        frameCount: 0,
        bytesReceived: 0,
        currentFps: 0,
        fpsTimer: Date.now(),
        fpsCounter: 0,
        startedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  registerClient(ws: WebSocket, role: 'athlete' | 'coach', sessionId: string) {
    const session = this.getOrCreateSession(sessionId);
    this.socketSessionMap.set(ws, { sessionId, role });

    if (role === 'athlete') {
      if (session.athleteWs && session.athleteWs !== ws) {
        try {
          session.athleteWs.close();
        } catch (_) {}
      }
      session.athleteWs = ws;
      session.frameCount = 0;
      session.bytesReceived = 0;
      session.fpsCounter = 0;
      session.fpsTimer = Date.now();
      this.logger.log(`Athlete connected to session [${sessionId}]`);

      // Notify coaches that athlete joined
      this.broadcastToCoaches(session, {
        type: 'athlete_status',
        connected: true,
        sessionId,
      });
    } else {
      session.coachWsList.add(ws);
      this.logger.log(`Coach viewer joined session [${sessionId}] (Total coaches: ${session.coachWsList.size})`);

      // Send initial status & last telemetry to the new coach
      const initialPayload = {
        type: 'session_init',
        sessionId,
        athleteConnected: !!session.athleteWs,
        telemetry: session.lastTelemetry,
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(initialPayload));
      }
    }
  }

  handleBinary(ws: WebSocket, buffer: Buffer) {
    const mapping = this.socketSessionMap.get(ws);
    if (!mapping || mapping.role !== 'athlete') return;

    const session = this.sessions.get(mapping.sessionId);
    if (!session) return;

    session.frameCount++;
    session.fpsCounter++;
    session.bytesReceived += buffer.length;

    // Calculate rolling FPS every 1000ms
    const now = Date.now();
    if (now - session.fpsTimer >= 1000) {
      session.currentFps = session.fpsCounter;
      session.fpsCounter = 0;
      session.fpsTimer = now;
    }

    // Forward binary frame immediately to all active coach sockets
    for (const coachWs of session.coachWsList) {
      if (coachWs.readyState === WebSocket.OPEN) {
        coachWs.send(buffer, { binary: true });
      }
    }
  }

  handleJson(ws: WebSocket, data: any) {
    const mapping = this.socketSessionMap.get(ws);
    if (!mapping) return;

    const session = this.sessions.get(mapping.sessionId);
    if (!session) return;

    if (mapping.role === 'athlete') {
      // Message from phone
      if (data.type === 'telemetry') {
        session.lastTelemetry = data.payload;
        this.broadcastToCoaches(session, {
          type: 'telemetry',
          fps: session.currentFps,
          payload: data.payload,
        });
      }
    } else if (mapping.role === 'coach') {
      // Message from coach (e.g., feedback cue)
      if (data.type === 'coach_cue' || data.type === 'feedback') {
        this.logger.log(`Coach sent feedback to athlete in [${mapping.sessionId}]: ${JSON.stringify(data)}`);
        if (session.athleteWs && session.athleteWs.readyState === WebSocket.OPEN) {
          session.athleteWs.send(JSON.stringify(data));
        }
      }
    }
  }

  handleDisconnect(ws: WebSocket) {
    const mapping = this.socketSessionMap.get(ws);
    if (!mapping) return;

    const { sessionId, role } = mapping;
    this.socketSessionMap.delete(ws);

    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (role === 'athlete') {
      if (session.athleteWs === ws) {
        session.athleteWs = null;
        this.logger.log(`Athlete disconnected from session [${sessionId}]`);
        this.broadcastToCoaches(session, {
          type: 'athlete_status',
          connected: false,
          sessionId,
        });
      }
    } else {
      session.coachWsList.delete(ws);
      this.logger.log(`Coach left session [${sessionId}] (Remaining coaches: ${session.coachWsList.size})`);
    }

    // Clean up empty sessions
    if (!session.athleteWs && session.coachWsList.size === 0) {
      this.sessions.delete(sessionId);
    }
  }

  broadcastToCoaches(session: SessionState, message: any) {
    const text = JSON.stringify(message);
    for (const coachWs of session.coachWsList) {
      if (coachWs.readyState === WebSocket.OPEN) {
        coachWs.send(text);
      }
    }
  }

  getAllSessions() {
    const result = [];
    for (const [id, s] of this.sessions.entries()) {
      result.push({
        id,
        athleteConnected: !!s.athleteWs,
        coachCount: s.coachWsList.size,
        frameCount: s.frameCount,
        fps: s.currentFps,
        bytesReceived: s.bytesReceived,
        startedAt: s.startedAt,
      });
    }
    return result;
  }
}

