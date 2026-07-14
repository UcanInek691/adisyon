/**
 * Yan-etkili ilk import. main.ts ve seed.ts'in EN BASINDA import edilir.
 * reflect-metadata (NestJS DI icin) + .env yuklemesi her seyden once yapilmali;
 * aksi halde AppModule dekoratorleri process.env'i bos gorur.
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

// __dirname: apps/backend/{src|dist} -> repo koku 3 seviye yukarida.
loadDotenv({ path: resolve(__dirname, '../../../.env') });
