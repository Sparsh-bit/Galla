// Galla desktop shell (macOS + Windows). Loads your Galla server in a native window and adds what a
// browser can't do alone: device pickers for USB/serial/Bluetooth printers and scanners, and silent
// printing to any installed printer.
const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, powerMonitor, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// The server every Galla app talks to (same backend and database as the website). Order: the user's own
// choice, GALLA_URL, then the address baked into the installer (app-config.json, written by the release build).
const bundledUrl = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8")).url || "";
  } catch {
    return "";
  }
};
const DEFAULT_URL = process.env.GALLA_URL || bundledUrl();
const configFile = () => path.join(app.getPath("userData"), "config.json");

function readUrl() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8")).url || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

function normalizeUrl(raw) {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Use an http:// or https:// address");
  return u.origin;
}

let win = null;
let appOrigin = "";

// Testing against a server on the shop's network (http://192.168.x.x): let Chromium treat it as a secure
// origin so the camera, offline service worker and secure storage behave exactly as on https.
// Production servers are https and need nothing here. Must run before the app is ready.
try {
  const boot = new URL(readUrlEarly());
  if (boot.protocol === "http:" && !["localhost", "127.0.0.1"].includes(boot.hostname)) app.commandLine.appendSwitch("unsafely-treat-insecure-origin-as-secure", boot.origin);
} catch {}
function readUrlEarly() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8")).url || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

const isApp = (url) => {
  try {
    return !!appOrigin && new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
};
const fromApp = (e) => isApp(e.senderFrame?.url ?? "");

function loadApp() {
  const url = readUrl();
  if (!url) return win.loadFile(path.join(__dirname, "setup.html"));
  try {
    appOrigin = normalizeUrl(url);
  } catch {
    return win.loadFile(path.join(__dirname, "setup.html"));
  }
  return win.loadURL(`${appOrigin}/pos`);
}

/* ---------- native device pickers (Web Serial / WebUSB / Web Bluetooth) ---------- */
async function choose(title, items, parent) {
  if (!items.length) return null;
  if (items.length === 1) return items[0].id;
  const shown = items.slice(0, 8);
  const { response } = await dialog.showMessageBox(parent, { type: "question", title: "Galla", message: title, buttons: [...shown.map((i) => i.label), "Cancel"], cancelId: shown.length, defaultId: 0 });
  return response === shown.length ? null : shown[response].id;
}

function setupDevices(ses) {
  ses.setPermissionCheckHandler((wc, permission, origin) => isApp(origin) && ["serial", "usb", "bluetooth", "clipboard-sanitized-write", "media", "notifications"].includes(permission));
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(isApp(details.requestingUrl) && ["serial", "usb", "bluetooth", "media", "notifications", "clipboard-sanitized-write"].includes(permission)));
  ses.setDevicePermissionHandler((d) => isApp(d.origin) && ["serial", "usb", "hid"].includes(d.deviceType));

  ses.on("select-serial-port", async (event, ports, wc, cb) => {
    event.preventDefault();
    cb((await choose("Choose the printer or scanner port", ports.map((p) => ({ id: p.portId, label: `${p.displayName || p.portName} (${p.portName})` })), win)) ?? "");
  });
  ses.on("select-usb-device", async (event, devices, wc, cb) => {
    event.preventDefault();
    cb((await choose("Choose the USB device", devices.map((d) => ({ id: d.deviceId, label: d.productName || `USB ${d.vendorId}:${d.productId}` })), win)) ?? undefined);
  });
}

function setupBluetooth(wc) {
  let seen = new Map();
  let timer = null;
  wc.on("select-bluetooth-device", (event, devices, cb) => {
    event.preventDefault();
    devices.forEach((d) => seen.set(d.deviceId, d));
    clearTimeout(timer);
    // Devices arrive over several callbacks while scanning; wait for the list to settle.
    timer = setTimeout(async () => {
      const list = [...seen.values()].map((d) => ({ id: d.deviceId, label: d.deviceName || d.deviceId }));
      seen = new Map();
      cb((await choose("Choose the Bluetooth device", list, win)) ?? "");
    }, 2500);
  });
}

/* ---------- printing ---------- */
const mm = (n) => Math.round(n * 1000); // Electron wants microns

async function printWindow(loader, o) {
  const printer = String(o?.printer ?? "");
  const known = (await win.webContents.getPrintersAsync()).some((p) => p.name === printer);
  if (!known) throw new Error("That printer is not installed on this computer. Choose another in Settings → Printer & scanner.");
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: true } });
  try {
    await loader(w);
    // Let fonts, images and the UPI QR finish painting.
    await new Promise((r) => setTimeout(r, 300));
    const thermal = o.kind === "thermal";
    const widthMm = o.width === 58 ? 58 : 80;
    let pageSize = "A4";
    if (thermal) {
      const px = await w.webContents.executeJavaScript("Math.ceil(document.documentElement.scrollHeight)");
      pageSize = { width: mm(widthMm), height: mm(Math.max(60, Math.ceil(px * 0.2646) + 10)) };
    }
    await new Promise((resolve, reject) => {
      w.webContents.print({ silent: true, printBackground: true, deviceName: printer, pageSize, margins: { marginType: "none" } }, (ok, reason) => (ok ? resolve() : reject(new Error(`Printer error: ${reason}`))));
    });
  } finally {
    w.destroy();
  }
}

function registerIpc() {
  ipcMain.on("galla:version", (e) => (e.returnValue = app.getVersion()));
  ipcMain.handle("galla:printers", async (e) => {
    if (!fromApp(e)) return [];
    return (await e.sender.getPrintersAsync()).map((p) => ({ name: p.name, displayName: p.displayName, isDefault: !!p.isDefault }));
  });
  ipcMain.handle("galla:print-url", async (e, url, o) => {
    if (!fromApp(e)) throw new Error("Not allowed");
    const target = new URL(String(url), appOrigin);
    if (target.origin !== appOrigin || !target.pathname.startsWith("/print/")) throw new Error("Not a printable page");
    const kind = target.pathname.startsWith("/print/receipt") ? "thermal" : "a4";
    await printWindow((w) => w.loadURL(target.href), { ...o, kind });
  });
  ipcMain.handle("galla:print-html", async (e, html, o) => {
    if (!fromApp(e)) throw new Error("Not allowed");
    await printWindow((w) => w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(String(html))}`), { ...o, kind: "thermal" });
  });
  ipcMain.handle("galla:get-url", () => readUrl());
  ipcMain.handle("galla:retry", (e) => {
    if (e.senderFrame?.url.startsWith("file:")) loadApp();
  });
  ipcMain.handle("galla:setup", (e) => {
    if (e.senderFrame?.url.startsWith("file:")) win.loadFile(path.join(__dirname, "setup.html"));
  });
  ipcMain.handle("galla:set-url", async (e, raw) => {
    if (!e.senderFrame?.url.startsWith("file:")) return { error: "Not allowed" };
    try {
      const origin = normalizeUrl(String(raw));
      fs.writeFileSync(configFile(), JSON.stringify({ url: origin }));
      await loadApp();
      return {};
    } catch (err) {
      return { error: err.message || "Invalid address" };
    }
  });
}

/* ---------- updates ---------- */
// Screens and features come from the server, so code changes reach users on every deploy (the web app
// shows a "new version is ready" prompt). This updater is for the desktop app itself: it checks the
// GitHub releases when online and tells the user. Windows downloads and installs on restart; macOS
// needs a signed app to self-install, so until then it points to the download page.
const DOWNLOAD_PAGE = "https://galla.concilio.solutions/#download";
const macSelfInstall = () => {
  try {
    return !!JSON.parse(fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8")).macSelfInstall;
  } catch {
    return false;
  }
};
let updater = null;
let promptedFor = null;

function notify(title, body, onClick) {
  if (!Notification.isSupported()) return onClick?.();
  const n = new Notification({ title, body });
  if (onClick) n.on("click", onClick);
  n.show();
}

async function askToRestart(version) {
  const { response } = await dialog.showMessageBox(win, { type: "info", title: "Galla", message: `Galla ${version} is ready to install`, detail: "Restart now to update. Anything you saved is kept.", buttons: ["Restart now", "Later"], defaultId: 0, cancelId: 1 });
  if (response === 0) updater.quitAndInstall();
}

async function askToDownload(version) {
  const { response } = await dialog.showMessageBox(win, { type: "info", title: "Galla", message: `Galla ${version} is available`, detail: "Download the new version and replace the app in Applications.", buttons: ["Download", "Later"], defaultId: 0, cancelId: 1 });
  if (response === 0) shell.openExternal(DOWNLOAD_PAGE);
}

function setupUpdates() {
  if (!app.isPackaged) return;
  try {
    updater = require("electron-updater").autoUpdater;
  } catch {
    return;
  }
  const selfInstall = process.platform !== "darwin" || macSelfInstall();
  updater.autoDownload = selfInstall;
  updater.autoInstallOnAppQuit = selfInstall;
  updater.logger = null; // "no release yet" / offline are normal; we simply check again later
  updater.on("error", () => undefined);
  updater.on("update-available", ({ version }) => {
    if (selfInstall || promptedFor === version) return;
    promptedFor = version;
    notify("Galla update available", `Version ${version} is ready to download.`, () => askToDownload(version));
    askToDownload(version);
  });
  updater.on("update-downloaded", ({ version }) => {
    if (promptedFor === version) return;
    promptedFor = version;
    notify("Galla update ready", `Version ${version} installs when you restart Galla.`, () => askToRestart(version));
    askToRestart(version);
  });
  const check = () => updater.checkForUpdates().catch(() => undefined);
  setTimeout(check, 8_000);
  setInterval(check, 60 * 60 * 1000);
  powerMonitor.on("resume", check);
  ipcMain.on("galla:online", check);
}

/** The server can require a newer desktop app (MIN_DESKTOP_VERSION), e.g. before a subscription change. */
const older = (a, b) => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
};
async function enforceMinimumVersion() {
  if (!appOrigin) return;
  try {
    const res = await fetch(`${appOrigin}/api/version`, { cache: "no-store" });
    const { minDesktopVersion } = await res.json();
    if (!minDesktopVersion || !older(app.getVersion(), minDesktopVersion)) return;
    await dialog.showMessageBox(win, { type: "warning", title: "Galla", message: "Please update Galla", detail: `This version (${app.getVersion()}) is no longer supported. Version ${minDesktopVersion} or newer is required.`, buttons: ["Get the update"] });
    if (updater && (process.platform !== "darwin" || macSelfInstall())) updater.checkForUpdates().catch(() => shell.openExternal(DOWNLOAD_PAGE));
    else shell.openExternal(DOWNLOAD_PAGE);
  } catch {}
}

function menu() {
  const mac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(mac ? [{ role: "appMenu" }] : []),
      { label: "File", submenu: [{ label: "Change server…", click: () => win.loadFile(path.join(__dirname, "setup.html")) }, { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win.reload() }, mac ? { role: "close" } : { role: "quit" }] },
      { role: "editMenu" },
      { label: "View", submenu: [{ role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }])] },
      { role: "windowMenu" },
      { role: "help", submenu: [{ label: "Check for updates…", click: () => (updater ? updater.checkForUpdates().then((r) => !r?.isUpdateAvailable && dialog.showMessageBox(win, { message: "Galla is up to date", detail: `You have version ${app.getVersion()}.` })).catch(() => dialog.showMessageBox(win, { message: "Couldn't check for updates", detail: "Check your internet connection and try again." })) : dialog.showMessageBox(win, { message: "Updates are available in the installed app" })) }, { type: "separator" }, { label: "Galla by Concilio Solutions", click: () => shell.openExternal("https://concilio.solutions") }, ...(mac ? [] : [{ role: "about" }])] },
    ]),
  );
}

const stateFile = () => path.join(app.getPath("userData"), "window.json");
let state = {};

/** Native title bars that blend into Galla: inset traffic lights on macOS, themed caption buttons on Windows. */
function chrome() {
  if (process.platform === "darwin") return { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 20 } };
  if (process.platform === "win32") return { titleBarStyle: "hidden", titleBarOverlay: { color: "#fbf7ef", symbolColor: "#14161f", height: 56 } };
  return {};
}

function createWindow() {
  try {
    state = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    state = {};
  }
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width ?? 1440,
    height: state.height ?? 900,
    minWidth: 1024,
    minHeight: 640,
    title: "Galla",
    show: false,
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#fbf7ef",
    ...chrome(),
    // spellcheck off and the bytecode cache on keep start-up and typing light on low-end PCs.
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, v8CacheOptions: "bypassHeatCheck" },
  });
  setupBluetooth(win.webContents);
  // Keep the app in this window; links to other sites open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isApp(url)) return { action: "allow" };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isApp(url) && !url.startsWith("file:")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    // -3 is an aborted navigation (normal). Anything else on the main page: show the branded offline screen.
    if (isMain && code !== -3 && !url.startsWith("file:")) win.loadFile(path.join(__dirname, "offline.html"), { query: { url: appOrigin } });
  });
  win.once("ready-to-show", () => {
    if (state.maximized) win.maximize();
    win.show();
  });
  const save = () => {
    if (!win || win.isMinimized()) return;
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...(win.isMaximized() ? state : win.getNormalBounds()), maximized: win.isMaximized() }));
    } catch {}
  };
  win.on("close", save);
  win.on("closed", () => (win = null));
  loadApp();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.setAboutPanelOptions({ applicationName: "Galla", applicationVersion: app.getVersion(), copyright: "Powered by Concilio Solutions · concilio.solutions", website: "https://concilio.solutions" });
  app.whenReady().then(() => {
    registerIpc();
    setupDevices(session.defaultSession);
    menu();
    createWindow();
    setupUpdates();
    win.webContents.once("did-finish-load", enforceMinimumVersion);
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });
  app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
}
