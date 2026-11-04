// Exposes a tiny, fixed API to the Galla web app. Nothing else from Node/Electron leaks through.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gallaDesktop", {
  platform: process.platform,
  version: ipcRenderer.sendSync("galla:version"),
  listPrinters: () => ipcRenderer.invoke("galla:printers"),
  printUrl: (url, o) => ipcRenderer.invoke("galla:print-url", url, o),
  printHtml: (html, o) => ipcRenderer.invoke("galla:print-html", html, o),
});

// Used by setup.html only (a local file, never the remote app).
if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("gallaSetup", {
    current: () => ipcRenderer.invoke("galla:get-url"),
    save: (url) => ipcRenderer.invoke("galla:set-url", url),
  });
}
