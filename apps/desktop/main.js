// Electron ince kabuk: backend calismiyorsa cocuk surec olarak baslatir,
// saglik kontrolu gecince pencereyi acar. UI tamamen backend'in sundugu web.
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');

const PORT = process.env.API_PORT || '3001';
const BASE = `http://127.0.0.1:${PORT}`;
let backend = null;

const isUp = () =>
  fetch(`${BASE}/api/v1/health`)
    .then((r) => r.ok)
    .catch(() => false);

// Paketli surumde: DB userData'da yasar (kurulum dizini yazilabilir degil),
// gizli anahtarlar ilk aciliste uretilip userData/secrets.json'da saklanir.
function packagedEnv() {
  const dataDir = app.getPath('userData');
  mkdirSync(dataDir, { recursive: true }); // ilk aciliste henuz yok
  const dbPath = join(dataDir, 'ado.db');
  if (!existsSync(dbPath)) {
    copyFileSync(join(process.resourcesPath, 'template.db'), dbPath);
  }
  const secretsPath = join(dataDir, 'secrets.json');
  if (!existsSync(secretsPath)) {
    writeFileSync(
      secretsPath,
      JSON.stringify({
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
        JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
        BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      }),
    );
  }
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'file:' + dbPath.replaceAll('\\', '/'),
    API_PORT: PORT,
    ...JSON.parse(readFileSync(secretsPath, 'utf8')),
  };
}

function startBackend() {
  const base = app.isPackaged
    ? join(process.resourcesPath, 'backend')
    : join(__dirname, '..', 'backend');
  // ELECTRON_RUN_AS_NODE: electron.exe'yi duz node olarak kullan (sistemde node gerekmez).
  backend = spawn(process.execPath, [join(base, 'dist', 'main.js')], {
    env: {
      ...process.env,
      ...(app.isPackaged ? packagedEnv() : {}),
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'inherit',
  });
}

async function waitUp(timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await isUp()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

app.whenReady().then(async () => {
  try {
    if (!(await isUp())) {
      // Dev'de backend'i kendin calistiriyorsan buraya dusmez.
      startBackend();
      if (!(await waitUp(30000))) {
        dialog.showErrorBox(
          'Backend başlatılamadı',
          'Sunucu 30 saniye içinde hazır olmadı. Dev ise: backend build edildi mi? (apps/backend/dist)',
        );
        app.quit();
        return;
      }
    }
    const win = new BrowserWindow({ width: 1280, height: 800 });
    win.removeMenu();
    win.loadURL(BASE);
  } catch (err) {
    // Sessiz cikis olmasin: hatayi goster, sonra kapan.
    dialog.showErrorBox('Uygulama başlatılamadı', String(err && err.stack ? err.stack : err));
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => backend?.kill());
