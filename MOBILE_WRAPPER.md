# Operation Hunt — Phase 4 Mobile Wrapper

## Branch and baseline

Native packaging work lives on the `mobile-wrapper` branch.

The game bundled by this branch is derived from the certified web baseline:

```text
c3d97026ae523f86496c5ee35d4946336e73dcae
```

Do not merge native-wrapper work into `main`. The certified browser release remains preserved on `app-release`.

## App identity

```text
App name: Operation Hunt
App ID: com.cdunmore89.operationhunt
Package version: 1.0.0
Android version: 1.0 (code 1)
iOS version: 1.0 (build 1)
Web assets: www/
```

## Current native status

- Capacitor 8.4.2 dependencies installed
- certified offline web bundle builds successfully
- `ios/` native project generated and committed
- `android/` native project generated and committed
- Capacitor Doctor recognizes both native projects
- native project metadata validator passes 30/30 checks
- Android GitHub Actions compilation workflow is active
- simulator/emulator and physical-device launch testing remain pending compatible build machines

## Toolchain requirements

- Node.js 22 or newer
- npm
- macOS for iOS compilation
- Xcode 26 or newer for iOS
- Xcode Command Line Tools
- JDK 21 or newer for Capacitor 8 Android compilation
- Android Studio 2025.2.1 or newer for Android
- Android SDK Platform Tools
- Android SDK API 24 or newer

Run the included environment report:

```bash
npm run preflight
```

The preflight script fails only when the required Node/npm foundation is missing. Native rows marked `NOT READY` identify tools that must be installed before compiling that platform.

## First-time setup

From the repository directory:

```bash
git fetch origin
git switch mobile-wrapper
git pull origin mobile-wrapper
node --version
npm run preflight
npm install
npm run build
```

The build command creates a clean `www/` folder containing only the production game and mobile-shell files. It does not copy the design lab, audit pages, regression pages, or repository documentation.

The native projects have already been initialized and committed. Do not run `npm run mobile:init` again unless one of the platform directories has intentionally been removed.

## Native validation

Validate package identifiers, versions, SDK targets, orientation support, secure Android defaults, display names, and Android test namespaces:

```bash
npm run native:check
```

Run the complete non-compiling verification sequence:

```bash
npm run mobile:verify
```

That command:

1. rebuilds the certified `www/` bundle
2. runs the native metadata validator
3. runs Capacitor Doctor against both platform projects

## Normal development workflow

After web or mobile-shell changes:

```bash
npm run mobile:sync
```

Open the native projects on compatible build machines:

```bash
npm run mobile:open:ios
npm run mobile:open:android
```

Run on a simulator, emulator, or connected device:

```bash
npm run mobile:run:ios
npm run mobile:run:android
```

## Mobile web bundle contents

The reproducible builder copies the approved production CSS and JavaScript files from the repository root and transforms `demo.html` into `www/index.html`.

Mobile-only additions:

- `viewport-fit=cover`
- safe-area padding for notches and home indicators
- touch-action improvements
- overscroll prevention
- native/web-preview classes
- app visibility lifecycle event

The source browser build is not edited by this process.

## Generated directories

- `www/` is generated and ignored by Git.
- `ios/` and `android/` are committed native source projects.
- platform build output remains ignored by each native project's `.gitignore`.
- `node_modules/` is generated and ignored by Git.

## Phase 4A completion rule

This mobile scaffold milestone is complete when:

1. `npm run preflight` reports Node and npm as ready.
2. `npm install` completes without vulnerabilities.
3. `npm run build` creates and validates `www/index.html`.
4. both native platform projects exist and are synchronized.
5. `npm run native:check` passes every metadata check.
6. `npx cap doctor` recognizes iOS and Android.
7. Operation Hunt launches in one iOS simulator and one Android emulator without missing assets or console errors.

Items 1–6 are complete. Android cloud compilation and device launch testing are the active checkpoints.
