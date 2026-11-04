# Galla desktop app (macOS + Windows)

A native window around your Galla server. It adds what a browser can't do alone:

- **Installed printer (silent)**: prints receipts, A4 invoices and labels straight to any printer installed on the computer (laser, inkjet, label, thermal) with no print dialog.
- **USB / Serial / Bluetooth printers**: the device picker works inside the app (Settings → Printer & scanner).
- **Scanners**: USB and Bluetooth keyboard scanners work like in the browser; the camera works too.
- Offline billing keeps working (same service worker as the web app).

## Run it

```bash
cd desktop
npm install
GALLA_URL=http://localhost:3000 npm start
```

Without `GALLA_URL` the app asks for your server address on first launch (File → Change server… later).

## Build installers

```bash
npm run dist:mac   # .dmg + .zip (build on a Mac)
npm run dist:win   # installer + portable .exe (build on Windows, or on a Mac with Wine)
```

Output is in `desktop/dist/`. Builds are unsigned: macOS shows "unidentified developer" (right-click → Open once), Windows SmartScreen shows "More info → Run anyway". Add your own signing certificates in `package.json` → `build` for production distribution.

## Printer setup in the app

1. Settings → Printer & scanner.
2. Pick **Installed printer (silent)**, choose the printer, set paper width (58/80 mm for rolls), press **Print test page**.
3. Raw ESC/POS options (USB, Serial, Bluetooth, Network bridge) are there for cash-drawer kick and the fastest thermal printing.
