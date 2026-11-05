# Galla for iPhone, iPad and Android

A native app (Capacitor) that loads your Galla server in a full-screen native web view, so every change you ship to the web app reaches phones immediately. Native extras: splash screen, status bar, haptics on scans, safe-area handling, home-screen icon.

## One-time setup (Mac)
1. Install Xcode (App Store), Android Studio, `brew install cocoapods`, `brew install --cask zulu@17` (see the main guide).
2. `cd mobile && npm install`
3. `GALLA_URL=https://your-galla-domain npx cap add ios && npx cap add android`
4. `npm run assets` after putting a 1024px `assets/icon-only.png` (the Galla tile) in `mobile/assets/`.

## Run
```bash
GALLA_URL=https://your-galla-domain npm run ios      # opens Xcode: press Run
GALLA_URL=https://your-galla-domain npm run android  # opens Android Studio: press Run
```

## Printing and scanning on phones
- Camera scanning works as on the web (permissions strings are added to Info.plist / AndroidManifest below).
- Receipts print through AirPrint (iOS) and the Android print service. Direct Bluetooth ESC/POS printing from phones needs the `@capacitor-community/bluetooth-le` plugin (planned next step).

Add to `ios/App/App/Info.plist`: `NSCameraUsageDescription` = "Galla scans barcodes with the camera". Android: `<uses-permission android:name="android.permission.CAMERA" />`.
