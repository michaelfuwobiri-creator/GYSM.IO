# Nollywood TV: handover

Paste this file into a new chat (or point the chat at it) to pick up the work where it stopped.

## The request

> "Develop a very modern streaming TV app for Amazon Fire TV, with thirdweb, called Nollywood."

## Where the code is

- Repo: `michaelfuwobiri-creator/gysm.io`, branch `claude/zealous-gauss-0wwvur`
- Folder: `nollywood-tv/`. The rest of the repo is an unrelated project, the Cadence&co Shopify homepage.
- The commit "Add Nollywood streaming TV app for Amazon Fire TV with thirdweb" holds all the app code. No pull request has been opened.
- Setup and build steps are in `nollywood-tv/README.md`.

## Stack and decisions

| Decision | Why |
| --- | --- |
| Web app (Vite 6, plain JS, no framework) wrapped in an Android WebView | Fast on Fire TV Sticks, one codebase, and simple to host the phone page too. |
| Android wrapper serves files from `https://appassets.androidplatform.net` (`WebViewAssetLoader`) | `file://` blocks ES modules, and thirdweb needs a real https origin. |
| Layout in `rem`, with `html { font-size: 100vw/120 }` | Designed at 1920×1080. It scales the same way to 720p and 4K. |
| Custom D-pad navigation (`src/nav.js`) | Moves to the nearest element in the arrow's direction. Each row (`data-group`) remembers its last focused item. Overlays are pushed and popped as "layers". |
| Posters drawn in CSS (`hue` + `motif` per title) | No image files and no licensing questions. Setting `image:` on a title shows real artwork instead. |
| thirdweb **in-app wallet with email code** on the TV | Works with a remote. No wallet app or seed phrase needed. |
| Pass = ERC-1155 **Edition Drop** token, bought on a phone through a QR code (`pass.html?to=<tvAddress>`) | The TV never signs a transaction. The phone uses `ClaimButton`, which can take card payments through thirdweb's pay modal. The TV checks `balanceOf` every 4 s. |
| **Demo mode** when `VITE_THIRDWEB_CLIENT_ID` is empty | Every screen can be tried without a contract. Any email and code sign you in, and "Simulate purchase" grants the pass. |
| hls.js loaded only on first play | Keeps the TV bundle at about 60 kB. |

Pinned versions: thirdweb 5.121.6, hls.js 1.6.15, qrcode-generator 2.0.4, vite 6.3.5, react 18.3.1 (phone page only), Android Gradle Plugin 8.5.2, Gradle 8.7, compileSdk 34, minSdk 25.

## File map

```
nollywood-tv/
  index.html          TV shell: side menu, #screen, #overlays, #toast
  pass.html           Phone checkout page (React)
  src/main.js         Screens (home, series, movies, list, search, account), hero, details, pass modal, routing, Back logic
  src/nav.js          D-pad focus engine and key codes (Fire TV: 179 play/pause, 227 rewind, 228 forward)
  src/player.js       Full-screen player, resume, media keys, keep-awake hook
  src/web3.js         thirdweb: sign-in, autoConnect, pass balance, polling, demo mode
  src/config.js       Reads the VITE_* settings from .env
  src/catalog.js      16 invented titles and the rows (placeholder data and streams)
  src/store.js        My List and watch progress (localStorage)
  src/keyboard.js     On-screen keyboard (search, email and digit layouts)
  src/pass.jsx/.css   Phone checkout: ConnectButton and ClaimButton
  src/styles.css      All TV styles
  android/            WebView wrapper: MainActivity.java, manifest (LEANBACK_LAUNCHER), banner and icons, Gradle wrapper
  .env.example        Settings: client ID, chain, contract, token ID, pass page URL, price label
```

## Status

**Done and checked** in headless Chromium at 1920×1080, using simulated key presses:
- Moving around with the arrows, row memory, side menu, Back behaviour
- Details pages, demo sign-in, the QR modal, the simulated purchase with its celebration screen, and the account page with the pass active
- Search, the player screen and its controls
- `vite build` passes with no warnings

**Not tested:**
- **The Android APK has never been built.** The sandbox blocked `dl.google.com` (Google's Maven repo). Build it locally with `npm run android:assets` and then `cd android && ./gradlew assembleDebug`.
- **Video playback.** The test streams were blocked by the network, so only the loading spinner was seen.
- **Real thirdweb flows.** There was no client ID, so email codes, `autoConnect`, the `balanceOf` check and the phone `ClaimButton` have not run against a real contract.
- On a real Fire TV: whether the WebView delivers the media keys as 179/227/228, and how fast the app runs on a Stick.

## Next steps, roughly in priority order

1. Build the APK and sideload it onto a Fire TV (`adb connect <ip>:5555`, then `adb install -r …`). Check Back, the media keys and smoothness.
2. Create a thirdweb project and add `appassets.androidplatform.net` and the phone page's domain to its allowed domains. Deploy an Edition Drop on Base Sepolia, then fill in `.env`.
3. Host `dist/` (Vercel, Netlify or Cloudflare Pages), set `VITE_PASS_PAGE_URL`, rebuild, and test the full QR → phone → TV-unlock flow.
4. Replace the placeholder catalogue and streams with licensed content, ideally loaded from a CMS or API rather than `catalog.js`.
5. Make the pass expire, for example with an ERC-5643 subscription NFT or a stored expiry. An ERC-1155 balance never expires.
6. Add DRM (Widevine) if studios require it: hls.js with EME, or switch playback to ExoPlayer/Media3 in the wrapper.
7. Check Amazon Appstore rules on selling digital content outside Amazon In-App Purchasing.
8. Before store submission: final banner and icons, a release signing key, and Amazon's Fire TV checklist.

## Known rough edges

- When the home page is scrolled, the hero title can show behind the side-menu logo.
- Episodes are generated (names and lengths) and every episode plays the series' single stream.
- In demo mode the phone page shows only a "needs config" message.
- `PLAY_PAUSE` includes key code 32 (Space) for desktop testing. Remove it if a hardware keyboard on the TV causes trouble.

## Run locally

```bash
cd nollywood-tv && npm install && npm run dev
```

Keys: arrows = D-pad, Enter = OK, Escape = Back, Space = play/pause.
