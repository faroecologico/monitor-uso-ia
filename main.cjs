// Ventana flotante: sin marco, siempre encima, fondo transparente y arrastrable.
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, nativeTheme, screen } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const ANCHO = 140;
const PUERTO = 4517;
let tray; // referencia global: si se recolecta, el ícono desaparece

if (!app.requestSingleInstanceLock()) app.quit();

app.setAppUserModelId('cl.local.monitor-uso-ia'); // ícono propio en la barra de tareas, sin agruparse como Electron

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'; // el vidrio oscuro deja leer el texto claro sobre cualquier fondo
  await import(pathToFileURL(join(__dirname, 'server.mjs')).href);

  const guardado = join(app.getPath('userData'), 'ventana.json');
  let pos = {};
  try { pos = JSON.parse(readFileSync(guardado, 'utf8')); } catch { /* primera vez */ }
  // si cambió el monitor, la posición guardada puede quedar fuera de la pantalla
  const visible = pos.x != null && screen.getAllDisplays().some(({ workArea: a }) =>
    pos.x >= a.x - ANCHO + 40 && pos.x < a.x + a.width - 40 && pos.y >= a.y && pos.y < a.y + a.height - 40);
  if (!visible) {
    const a = screen.getPrimaryDisplay().workArea;
    pos = { x: a.x + a.width - ANCHO - 24, y: a.y + 24 };
  }

  const win = new BrowserWindow({
    x: pos.x, y: pos.y, width: ANCHO, height: 110,
    frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, title: 'Uso restante', icon: join(__dirname, 'icono.png'),
    transparent: true, hasShadow: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs') },
  });
  win.setAlwaysOnTop(true, 'screen-saver'); // el nivel más alto: queda sobre juegos en ventana sin bordes
  win.on('moved', () => {
    const [x, y] = win.getPosition();
    try { writeFileSync(guardado, JSON.stringify({ x, y })); } catch { /* sin permiso de escritura */ }
  });
  ipcMain.on('alto', (_e, alto) => {
    if (Number.isFinite(alto)) win.setContentSize(ANCHO, Math.max(60, Math.min(900, Math.round(alto))));
  });
  win.once('ready-to-show', () => win.show());

  // Ícono junto al reloj: clic muestra u oculta; clic derecho trae el menú para cerrar
  const alternar = () => (win.isVisible() ? win.hide() : win.show());
  tray = new Tray(nativeImage.createFromPath(join(__dirname, 'icono.png')).resize({ width: 32, height: 32 }));
  tray.setToolTip('Uso restante de Codex y Claude');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar u ocultar', click: alternar },
    { type: 'separator' },
    { label: 'Cerrar', click: () => app.quit() },
  ]));
  tray.on('click', alternar);
  win.loadURL(`http://127.0.0.1:${PUERTO}/`);
});

app.on('window-all-closed', () => app.quit());
