# Galla for iPhone and iPad

A native iOS app (Capacitor) that loads **your Galla server** in a full-screen native web view. It uses the same backend, database and login as the website and the Mac/Windows apps, and every web deploy reaches the phone immediately, with no App Store update. Native extras: splash screen, status bar, haptics on scans, safe areas, home-screen icon. (Android is planned later.)

## One-time setup (Mac)
1. Install Xcode from the App Store, open it once and accept the licence, then run `sudo xcode-select -s /Applications/Xcode.app`.
2. `brew install cocoapods`
3. `cd mobile && npm install`
4. `GALLA_URL=https://your-galla-domain npx cap add ios`
5. Add to `ios/App/App/Info.plist`: `NSCameraUsageDescription` = "Galla scans barcodes with the camera".

## Run
```bash
GALLA_URL=https://your-galla-domain npm run ios   # opens Xcode: choose a simulator or your iPhone and press Run
```
For local testing use `http://<your-mac-lan-ip>:3000`.

## Printing on iPhone and iPad
Receipts print through AirPrint. Direct Bluetooth ESC/POS printing from iOS needs a Bluetooth LE plugin (next step).
