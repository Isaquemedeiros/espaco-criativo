const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const https = require('https');
function post({ url, headers, body }) {
  return new Promise((res, rej) => {
    const u = new URL(url); if (u.protocol !== 'https:') return rej(new Error('url'));
    const buf = Buffer.from(body, 'utf8');
    const req = https.request(u, { method: 'POST', headers: Object.assign({}, headers, { 'Content-Length': buf.length }) }, r => {
      const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('error', rej); req.setTimeout(20000, () => req.destroy(new Error('timeout'))); req.end(buf);
  });
}
ipcMain.handle('ec-post', (e, a) => post(a));
const path = require('path');
if (!app.requestSingleInstanceLock()) { app.quit(); }
let win;
function create() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#02040A', show: false,
    title: 'Espaço Criativo', icon: path.join(__dirname, 'www', 'icon-512.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, i) => { if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
