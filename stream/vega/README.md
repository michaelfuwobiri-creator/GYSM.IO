# GYSM Stream for Vega OS

Newer Fire TV devices, such as the Fire TV Stick 4K Select, run **Vega OS** instead of Fire OS (Android). Vega OS does not run APKs; its apps are built with **React Native for Vega** and the **Vega Developer Tools** (Vega SDK, Vega CLI, Vega Studio for VS Code, and the Vega Virtual Device).

This folder turns the same GYSM web app into a Vega app: a full-screen Vega WebView showing `stream/web`, bundled inside the app package. Navigation, the player, My List and Settings are the same code as the Fire OS app.

| File | What it is |
| --- | --- |
| `src/App.tsx` | The whole Vega app: a full-screen `WebView` from `@amazon-devices/webview`, Back and Exit handling |
| `scripts/build-web.mjs` | Copies `stream/web` into `assets/web`, bundling the scripts into one file (pages loaded from the package can't use JavaScript modules) |

## What was checked, and what wasn't

**Checked**
- `App.tsx` type-checks in strict mode against `@amazon-devices/webview` 4.0.5 and `@amazon-devices/react-native-kepler` 4.0.2 from npm. Every prop and import used exists.
- The bundled web app runs from local `file://` files in Chromium, with Vega's message bridge simulated. The D-pad, details, playback, Back and the exit message all work, with no errors.

**Not checked** (the Vega SDK and Amazon's docs weren't reachable from the build environment)
- Building with the Vega SDK, the Vega Virtual Device, or a real Vega device.
- The exact address the WebView uses for packaged files. `App.tsx` uses `file:///pkg/assets/web/index.html`. If the page doesn't load, change `START_URI` (see [Start page](#start-page)).
- Whether media keys (Play/Pause, Rewind, Fast-forward) reach the page. Back does, through `allowSystemKeyEvents`.

**Known difference from the Fire OS app:** offline downloads. On Fire OS, a native downloader saves films. On Vega, the page can only save films if the Vega WebView allows Cache Storage for packaged pages and the film host sends CORS headers. If not, the app works as a streaming app and the Download buttons are switched off. A native Vega download module would close this gap.

## Set up the Vega Developer Tools

Follow Amazon's current guide: **developer.amazon.com → Vega → Get started → Install the Vega SDK**. In outline:

1. **Use a supported computer.** The Vega SDK supports macOS and Linux (Ubuntu); check the current list in the guide.
2. **Install Node.js** (LTS) and **VS Code**.
3. **Install the Vega SDK** with Amazon's installer script. It installs the **Vega CLI** and the **Vega Virtual Device**. Check it worked with the CLI's version command.
4. **Install Vega Studio**, the VS Code extension, from the VS Code Marketplace (search "Vega Studio").

## Create the GYSM Vega project

1. **Create a project from Amazon's template.** In Vega Studio, create a new project (or use the Vega CLI's project command) from the **hello world** template. Name it `gysm-stream` and give it a package ID such as `io.gysm.stream.vega`. Using the official template means the manifest and build files match your SDK version.
2. **Add the WebView and the bundler.** In the new project folder:
   ```bash
   npm install @amazon-devices/webview
   npm install --save-dev esbuild
   ```
3. **Copy GYSM's files in.** Replace the template's `src/App.tsx` with `stream/vega/src/App.tsx` from this repository, and copy `stream/vega/scripts/` into the project.
4. **Allow internet access** in the project's `manifest.toml`, so films can stream. The template's comments and Amazon's WebView guide show the exact permission entry for your SDK version.
5. **Copy the web app in.** Edit the path near the top of `scripts/build-web.mjs` if your project is outside this repository, then run:
   ```bash
   node scripts/build-web.mjs
   ```
   This writes `assets/web/`. Run it again whenever `stream/web` changes.
6. **Build and run.** Use **Build** in Vega Studio, or the build script in the template's `package.json`. Then start the **Vega Virtual Device** (Vega Studio → Devices, or `vega device list` in a terminal) and run the app on it.
7. **Install on a Vega Fire TV.** Turn on developer mode on the TV, connect it (it then appears in `vega device list`), and install the built package (`.vpkg`) from Vega Studio or the CLI.

## Start page

The Vega WebView loads packaged files from `/pkg/assets`. `App.tsx` points at `file:///pkg/assets/web/index.html`. If the screen stays black or shows an error on the Virtual Device:

- Check Amazon's WebView guide (developer.amazon.com → Vega → "Build web apps with WebView") for the exact form, and change only `START_URI`.
- Or point `START_URI` at the hosted web app, for example `https://gysm-stream.pages.dev/`, once it's published on Cloudflare Pages. It works the same way, but needs a connection to start.

## Submit to the Amazon Appstore

A Vega app is a separate binary from the Fire OS APK. Amazon keeps the title, description, pricing and screenshots separately for Fire OS and Vega OS apps. Reuse the text and images in `stream/store-assets/`, upload the Vega package, and send the same reviewer notes (`stream/store-assets/AMAZON-REPLY.md`).
