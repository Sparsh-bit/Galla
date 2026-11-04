// Galla desktop shell (macOS + Windows). Loads your Galla server in a native window and adds what a
// browser can't do alone: device pickers for USB/serial/Bluetooth printers and scanners, and silent
// printing to any installed printer.
const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_URL = process.env.GALLA_URL || "";
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

function menu() {
  const mac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(mac ? [{ role: "appMenu" }] : []),
      { label: "File", submenu: [{ label: "Change server…", click: () => win.loadFile(path.join(__dirname, "setup.html")) }, { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win.reload() }, mac ? { role: "close" } : { role: "quit" }] },
      { role: "editMenu" },
      { label: "View", submenu: [{ role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }])] },
      { role: "windowMenu" },
    ]),
  );
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Galla",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#ffffff",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
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
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMain) => {
    if (isMain && code !== -3) {
      dialog.showMessageBox(win, { type: "error", title: "Galla", message: "Can't reach the Galla server", detail: `${desc}\n${url}`, buttons: ["Retry", "Change server"], defaultId: 0 }).then(({ response }) => (response === 0 ? loadApp() : win.loadFile(path.join(__dirname, "setup.html"))));
    }
  });
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
  app.whenReady().then(() => {
    registerIpc();
    setupDevices(session.defaultSession);
    menu();
    createWindow();
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });
  app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
}
