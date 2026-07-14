import './bootstrap-env';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
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

  await app.listen(env.API_PORT, env.API_HOST);
  app.get(Logger).log(`Backend hazir: http://${env.API_HOST}:${env.API_PORT}/api/v1`);
}

void bootstrap();
