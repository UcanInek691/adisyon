// Masaustu paketi icin kendi-yeten bundle hazirlar (electron-builder oncesi).
// Kullanim: node build-bundle.mjs  (cwd: apps/desktop)
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const bundle = resolve(import.meta.dirname, 'bundle');
const run = (cmd, env = {}) =>
  execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(bundle, { recursive: true, force: true });

// 1) Derle
run('pnpm --filter @ado/frontend build');
run('pnpm --filter @ado/backend build');

// 2) Kendi-yeten backend: hoisted linker gercek (junction'siz) node_modules uretir,
//    argon2 win32 native paketi de dahil olur.
run(
  `pnpm --filter @ado/backend --prod deploy "${join(bundle, 'backend')}" --legacy --config.node-linker=hoisted`,
);

// 3) pnpm deploy uretilen prisma client'i (.prisma) tasimaz; kokteki store'dan kopyala.
const req = createRequire(join(root, 'apps', 'backend', 'package.json'));
const prismaClient = join(
  dirname(req.resolve('@prisma/client/package.json')),
  '..',
  '..',
  '.prisma',
  'client',
);
cpSync(prismaClient, join(bundle, 'backend', 'node_modules', '.prisma', 'client'), {
  recursive: true,
});

// 4) Frontend dist — backend bunu dist/main.js'e gore ../../frontend/dist yolundan sunar.
cpSync(join(root, 'apps', 'frontend', 'dist'), join(bundle, 'frontend', 'dist'), {
  recursive: true,
});

// 5) Sablon DB: bos sema (migrate deploy) + KULLANICISIZ seed (rol/izin/sube).
// Sifre env'leri bilerek bosaltilir -> ilk acilista uygulama kurulum sihirbazini gosterir.
const DATABASE_URL = 'file:' + join(bundle, 'template.db').replaceAll('\\', '/');
run('pnpm exec prisma migrate deploy --schema prisma/schema', { DATABASE_URL });
// Bos string: dotenv mevcut degiskeni ezmez, env semasi ''=yok sayar -> kullanici olusmaz.
run('pnpm --filter @ado/backend seed', {
  DATABASE_URL,
  SEED_OWNER_PASSWORD: '',
  SEED_WAITER_PIN: '',
});

console.log('\nbundle hazir:', bundle);
