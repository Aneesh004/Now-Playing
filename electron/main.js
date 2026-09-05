import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let authServer = null;
let tray = null;

/* ─── Single instance lock ────────────────────────────────────── */

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

/* ─── Persistence helpers ─────────────────────────────────────── */

const getPath = (name) => path.join(app.getPath('userData'), name);

function readJSON(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function loadWindowState() {
  const state = readJSON(getPath('window-state.json'), { width: 340, height: 480 });
  // Prevent loading into a limbo size between compact and full
  if (state.height > 80 && state.height < 380) state.height = 480;
  return state;
}

let saveStateTimeout = null;
function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    writeJSON(getPath('window-state.json'), mainWindow.getBounds());
  }, 500);
}

/* ─── Tray icon (16×16 green circle from raw RGBA pixels) ───── */

function createTrayIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const cx = 7.5, cy = 7.5, r = 7;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        buffer[idx]     = 0x1D; // R
        buffer[idx + 1] = 0xB9; // G
        buffer[idx + 2] = 0x54; // B
        buffer[idx + 3] = 255;  // A
      }
      // remaining bytes default to 0 (transparent)
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/* ─── Always-on-top enforcement ───────────────────────────────── */

function enforceAlwaysOnTop() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.moveTop();
}

function showAndFocus() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  enforceAlwaysOnTop();
}

/* ─── Window creation ─────────────────────────────────────────── */

function createWindow() {
  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: savedState.width || 340,
    height: savedState.height || 480,
    x: savedState.x,
    y: savedState.y,
    minWidth: 340,
    minHeight: 56,
    maxWidth: 500,
    resizable: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    type: 'toolbar',
    hasShadow: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  enforceAlwaysOnTop();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('blur', enforceAlwaysOnTop);
  mainWindow.on('focus', enforceAlwaysOnTop);
  mainWindow.on('show', enforceAlwaysOnTop);

  // Periodic check to keep it above all apps
  const topTimer = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  }, 1000);

  mainWindow.on('close', () => {
    clearInterval(topTimer);
    saveWindowState();
    app.quit();
  });

  mainWindow.on('closed', () => {
    clearInterval(topTimer);
    mainWindow = null;
  });
}

/* ─── System tray ─────────────────────────────────────────────── */

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Spotify Mini Player');

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Player', click: showAndFocus },
    { type: 'separator' },
    { label: 'Quit', click: () => { saveWindowState(); app.quit(); } },
  ]));

  tray.on('click', showAndFocus);
}

/* ─── OAuth callback server ───────────────────────────────────── */

function startAuthServer() {
  return new Promise((resolve) => {
    if (authServer) authServer.close();

    authServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1:8888');
      if (url.pathname !== '/callback') return;

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="background:#121212;color:#fff;font-family:Inter,sans-serif;
            display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center">
              <h1 style="color:#1DB954">${error ? '✗ Authorization Failed' : '✓ Connected!'}</h1>
              <p style="color:#b3b3b3">You can close this tab and return to the mini player.</p>
            </div>
          </body>
        </html>
      `);

      if (code && mainWindow) {
        mainWindow.webContents.send('spotify:auth-code', code);
      }

      setTimeout(() => {
        if (authServer) { authServer.close(); authServer = null; }
      }, 1000);
    });

    authServer.listen(8888, '127.0.0.1', resolve);
  });
}

/* ─── IPC handlers ────────────────────────────────────────────── */

ipcMain.handle('spotify:start-auth-server', () => startAuthServer());
ipcMain.handle('spotify:open-external', (_e, url) => shell.openExternal(url));

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:close', () => { saveWindowState(); app.quit(); });

ipcMain.on('window:toggle-compact', () => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  if (bounds.height <= 120) {
    mainWindow.setBounds({
      x: bounds.x,
      y: Math.max(0, bounds.y - (480 - bounds.height)),
      width: Math.max(340, bounds.width),
      height: 480,
    });
  } else {
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y + (bounds.height - 56),
      width: bounds.width,
      height: 56,
    });
  }
  saveWindowState();
});

ipcMain.on('window:set-compact', (_e, compact) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  if (compact) {
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y + (bounds.height - 56),
      width: bounds.width,
      height: 56,
    });
  } else {
    mainWindow.setBounds({
      x: bounds.x,
      y: Math.max(0, bounds.y - (480 - bounds.height)),
      width: Math.max(340, bounds.width),
      height: 480,
    });
  }
  saveWindowState();
});

/* ─── Token persistence IPC ───────────────────────────────────── */

const tokensPath = () => getPath('auth-tokens.json');

ipcMain.handle('auth:get-tokens', () => readJSON(tokensPath()));
ipcMain.handle('auth:save-tokens', (_e, tokens) => writeJSON(tokensPath(), tokens));
ipcMain.handle('auth:clear-tokens', () => {
  try {
    if (fs.existsSync(tokensPath())) fs.unlinkSync(tokensPath());
    return true;
  } catch {
    return false;
  }
});

/* ─── App lifecycle ───────────────────────────────────────────── */

if (gotTheLock) {
  app.on('second-instance', showAndFocus);

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });

  app.on('before-quit', saveWindowState);

  app.on('window-all-closed', () => {
    if (authServer) { authServer.close(); authServer = null; }
  });

  app.on('activate', () => {
    if (mainWindow) {
      showAndFocus();
    } else {
      createWindow();
    }
  });
}
