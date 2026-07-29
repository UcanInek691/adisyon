// Masaustu paketi icin kendi-yeten bundle hazirlar (electron-builder oncesi).
// Kullanim: node build-bundle.mjs  (cwd: apps/desktop)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..', '..');
const bundle = resolve(import.meta.dirname, 'bundle');
const run = (cmd, env = {}) =>
  execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(bundle, { recursive: true, force: true });

// 1) Derle
run('npm --prefix apps/frontend run build');
run('npm --prefix apps/backend run build');

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
cpSync(
  join(root, 'prisma', 'schema', 'migrations'),
  join(bundle, 'backend', 'prisma', 'migrations'),
  { recursive: true },
);

// 4) Frontend dist — backend bunu dist/main.js'e gore ../../frontend/dist yolundan sunar.
cpSync(join(root, 'apps', 'frontend', 'dist'), join(bundle, 'frontend', 'dist'), {
  recursive: true,
});

// 5) Sablon DB: bos sema (migrate deploy) + KULLANICISIZ seed (rol/izin/sube).
// Sifre env'leri bilerek bosaltilir -> ilk acilista uygulama kurulum sihirbazini gosterir.
const DATABASE_URL = 'file:' + join(bundle, 'template.db').replaceAll('\\', '/');
const templateDb = new DatabaseSync(join(bundle, 'template.db'));
templateDb.exec(
  'CREATE TABLE "_ado_migrations" ("name" TEXT PRIMARY KEY, "applied_at" TEXT NOT NULL)',
);
for (const name of readdirSync(join(root, 'prisma', 'schema', 'migrations')).sort()) {
  const sqlPath = join(root, 'prisma', 'schema', 'migrations', name, 'migration.sql');
  if (!existsSync(sqlPath)) continue;
  templateDb.exec('BEGIN IMMEDIATE');
  try {
    templateDb.exec(readFileSync(sqlPath, 'utf8'));
    templateDb
      .prepare('INSERT INTO "_ado_migrations" ("name", "applied_at") VALUES (?, ?)')
      .run(name, new Date().toISOString());
    templateDb.exec('COMMIT');
  } catch (error) {
    templateDb.exec('ROLLBACK');
    throw error;
  }
}
templateDb.close();
// Bos string: dotenv mevcut degiskeni ezmez, env semasi ''=yok sayar -> kullanici olusmaz.
run('npm --prefix apps/backend run seed', {
  DATABASE_URL,
  SEED_OWNER_PASSWORD: '',
  SEED_WAITER_PIN: '',
});

console.log('\nbundle hazir:', bundle);
