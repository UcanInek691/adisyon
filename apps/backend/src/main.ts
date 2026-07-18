import './bootstrap-env';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import * as express from 'express';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const env = loadEnv(); // fail-fast: gecersiz .env ile baslamaz.

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  // LAN'daki Waiter tabletleri farkli origin'den baglanir.
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();

  // LAN tarayicilari icin build edilmis frontend'i ayni porttan sun (varsa).
  // Hem src/ (ts-node) hem dist/ (build) ayni derinlikte -> ../../frontend/dist.
  const webDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback: /api disindaki GET istekleri index.html'e duser.
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(join(webDist, 'index.html'));
      } else {
        next();
      }
    });
    app.get(Logger).log(`Frontend sunuluyor: ${webDist}`);
  }

  await app.listen(env.API_PORT, env.API_HOST);
  app.get(Logger).log(`Backend hazir: http://${env.API_HOST}:${env.API_PORT}/api/v1`);
}

void bootstrap();
