// Electron ince kabuk: backend calismiyorsa cocuk surec olarak baslatir,
// saglik kontrolu gecince pencereyi acar. UI tamamen backend'in sundugu web.
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { join } = require('node:path');

const PORT = process.env.API_PORT || '3001';
const BASE = `http://127.0.0.1:${PORT}`;
let backend = null;

const isUp = () =>
  fetch(`${BASE}/api/v1/health`)
    .then((r) => r.ok)
    .catch(() => false);

function startBackend() {
  // ponytail: yol repo dizin yapisina gore; paketlemede (adim 3) resourcesPath'e gecer.
  const entry = join(__dirname, '..', 'backend', 'dist', 'main.js');
  // ELECTRON_RUN_AS_NODE: electron.exe'yi duz node olarak kullan (sistemde node gerekmez).
  backend = spawn(process.execPath, [entry], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
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
  if (!(await isUp())) {
    // Dev'de backend'i kendin calistiriyorsan buraya dusmez.
    startBackend();
    if (!(await waitUp(30000))) {
      dialog.showErrorBox(
        'Backend başlatılamadı',
        'Sunucu 30 saniye içinde hazır olmadı. Backend build edildi mi? (apps/backend/dist)',
      );
      app.quit();
      return;
    }
  }
  const win = new BrowserWindow({ width: 1280, height: 800 });
  win.removeMenu();
  win.loadURL(BASE);
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => backend?.kill());
