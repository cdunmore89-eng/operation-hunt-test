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
Version: 1.0.0
Web assets: www/
```

## Toolchain requirements

- Node.js 22 or newer
- npm
- macOS for iOS compilation
- Xcode 26 or newer for iOS
- Xcode Command Line Tools
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

After the web bundle succeeds, create both native platform projects once:

```bash
npm run mobile:init
```

That command:

1. rebuilds `www/`
2. creates `ios/`
3. creates `android/`
4. copies the web bundle into both native projects
5. synchronizes native dependencies

Capacitor 8 uses Swift Package Manager for new iOS projects by default.

## Normal development workflow

After web or mobile-shell changes:

```bash
npm run mobile:sync
```

Open the native projects:

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
- `ios/` and `android/` will be generated during the first native initialization and should be committed after their initial configuration is verified.
- `node_modules/` is generated and ignored by Git.

## Phase 4A completion rule

This first mobile milestone is complete when:

1. `npm run preflight` reports Node and npm as ready.
2. `npm install` completes.
3. `npm run build` creates and validates `www/index.html`.
4. `npm run mobile:init` creates both native projects.
5. Operation Hunt launches in one iOS simulator and one Android emulator without missing assets or console errors.
