import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RelayService } from './relay.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as url from 'url';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static assets from 'public' directory
  const publicDir = path.join(__dirname, '..', 'public');
  app.useStaticAssets(publicDir);

  // Enable CORS
  app.enableCors();

  const relayService = app.get(RelayService);

  // Bind to Render assigned PORT (or 3000 locally) on 0.0.0.0
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  const httpServer = app.getHttpServer();

  // Attach WebSocket server on /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const parsedUrl = url.parse(req.url || '', true);
    const query = parsedUrl.query;

    const role = (query.role === 'athlete' ? 'athlete' : 'coach') as 'athlete' | 'coach';
    const sessionId = (query.session as string) || 'oneview-live';

    relayService.registerClient(ws, role, sessionId);

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        relayService.handleBinary(ws, data);
      } else {
        try {
          const text = data.toString('utf-8');
          const parsed = JSON.parse(text);
          relayService.handleJson(ws, parsed);
        } catch (e) {
          console.warn('Failed to parse incoming JSON WebSocket message:', e);
        }
      }
    });

    ws.on('close', () => {
      relayService.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for [${sessionId} / ${role}]:`, err.message);
      relayService.handleDisconnect(ws);
    });
  });

  console.log(`====================================================`);
  console.log(`🚀 OneView Coach Relay Server running on port ${port}`);
  console.log(`   Coach Portal: https://ss-eb5j.onrender.com/?session=oneview-live`);
  console.log(`   Local URL:    http://localhost:${port}/?session=oneview-live`);
  console.log(`====================================================`);
}

bootstrap();
