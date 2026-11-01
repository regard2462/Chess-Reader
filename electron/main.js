// The main process of Chess Reader: one window that shows the built page (dist/reader) through its own secure scheme, so
// that the folder picker, IndexedDB and the workers behave as on a web server. The books are read by the page itself;
// this file only opens the window and allows the page to read the folder the user chose.
'use strict';
const { app, BrowserWindow, protocol, session, Menu, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const PAGE_DIR = fs.existsSync(path.join(__dirname, '..', 'web')) ? path.join(__dirname, '..', 'web') : path.join(__dirname, '..', 'dist', 'reader');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream' };

protocol.registerSchemesAsPrivileged([{ scheme: 'reader', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(() => {
    protocol.handle('reader', async (request) => {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.normalize(path.join(PAGE_DIR, rel));
      if (!file.startsWith(PAGE_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found', { status: 404 });
      return new Response(fs.readFileSync(file), { headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' } });
    });
    // the folder the user picks: reading it needs the file system permission of the page, nothing else is allowed
    const allowed = (permission) => permission === 'fileSystem' || permission === 'clipboard-sanitized-write' || permission === 'fullscreen';
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed(permission));
    Menu.setApplicationMenu(null);

    win = new BrowserWindow({
      width: 1280, height: 860, minWidth: 720, minHeight: 520, title: 'Chess Reader', backgroundColor: '#e3dccf',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'), autoHideMenuBar: true,
      show: !process.env.CHESSREADER_HIDDEN,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
    });
    win.loadURL('reader://app/index.html');
    // links to the web open in the browser of the system, the window never leaves the page
    win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('reader://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
    win.on('closed', () => { win = null; });
  }).catch((e) => { dialog.showErrorBox('Chess Reader', String((e && e.stack) || e)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
