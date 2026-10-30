# Nollywood — streaming TV app for Amazon Fire TV

A modern, remote-first streaming app for Nollywood films and series, with
**thirdweb** sign-in and an on-chain **Nollywood Pass** membership that unlocks
premium titles.

| | |
| --- | --- |
| **TV app** (`index.html`, `src/`) | Plain JavaScript + Vite. Built for the Fire TV remote at 1080p; scales to 720p and 4K. |
| **Phone checkout** (`pass.html`, `src/pass.jsx`) | Opened from a QR code on the TV. Buys the pass with thirdweb (card or crypto) and sends it to the TV viewer's wallet. |
| **Fire TV wrapper** (`android/`) | A small Android TV app that hosts the web app in a WebView, with Leanback launcher banner and remote Back key support. |

## What's in the TV app

- **Home**: rotating hero for featured originals, a full-screen backdrop that follows whichever poster has focus, rows for Continue watching, My List, Trending, Top 10 (with large rank numbers), Pass-only titles and genres.
- **Details**: synopsis, cast, match score, episode rail for series, "More like this".
- **Player**: HLS (hls.js, loaded on first play) and MP4, resume where you left off, ±10 s buttons, Fire TV play/pause, rewind and fast-forward keys, auto-hiding controls.
- **Search** with an on-screen keyboard; **Series**, **Movies** and **My List** grids.
- **Account**: email sign-in with a thirdweb in-app wallet, pass status and checkout.
- D-pad navigation that remembers your place in each row; Back always steps out one level and exits from Home.
- No image files: posters are drawn in CSS from each title's colour and pattern. Add `image: "https://…"` to a title in `src/catalog.js` to use real key art.

## How thirdweb is used

1. **Sign-in.** The viewer types their email with the remote; thirdweb emails a 6-digit code (`preAuthenticate` → `inAppWallet().connect`). A wallet is created for them, with no seed phrase or wallet app. The session is restored on the next launch with `autoConnect`.
2. **Gating.** Titles marked `premium: true` check the viewer's balance of the pass token (`balanceOf` on an ERC-1155 **Edition Drop**).
3. **Buying the pass.** The TV shows a QR code to `pass.html?to=<viewer's address>`. On the phone the buyer connects any wallet (or signs in with email, Google, Apple, phone or passkey) and taps **Buy pass** (thirdweb `ClaimButton`; thirdweb's pay modal offers card payment when the wallet has no funds). The pass is minted to the TV address, and the TV polls every 4 s and unlocks itself. The TV never signs a transaction.

Without a client ID the app runs in **demo mode**: any email and 6 digits sign you in and "Simulate purchase" grants the pass, so you can try every screen.

## Run it

```bash
cd nollywood-tv
```

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL at a 1920×1080 window. Arrow keys = D-pad, Enter = OK, Escape = Back, Space = play/pause.

## Set up thirdweb (real wallets)

1. Create a project at https://thirdweb.com/dashboard and copy its **client ID**. Under allowed domains add the domain you host `pass.html` on, plus `appassets.androidplatform.net` (the origin the Fire TV app runs on), or allow all domains while testing.
2. Deploy an **Edition Drop** (ERC-1155) on Base Sepolia (testnet) or Base. Lazy-mint one token ("Nollywood Pass", token ID 0) and set a claim condition with your price.
3. Copy `.env.example` to `.env` and fill in the client ID, chain ID, contract address and token ID.
4. Host the `dist/` folder (Vercel, Netlify, Cloudflare Pages…) after `npm run build`, and set `VITE_PASS_PAGE_URL` to the public URL of `pass.html`, then build again. The QR code must point to a page a phone can reach.

## Build for Fire TV

You need Android Studio (or the Android SDK + JDK 17).

```bash
npm run android:assets
```

This builds the web app into `android/app/src/main/assets/www`. Then open `android/` in Android Studio and run it, or build from the command line:

```bash
cd android && ./gradlew assembleDebug
```

Install on a Fire TV with developer options and ADB debugging turned on (Settings → My Fire TV → Developer options):

```bash
adb connect <fire-tv-ip>:5555
```

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Submit to the Amazon Appstore from the Amazon Developer Console as an Android app. The app uses `LEANBACK_LAUNCHER`, a 320×180 banner, needs no touchscreen and is landscape only, as Amazon's Fire TV checklist requires. Replace the banner and icons in `android/app/src/main/res` with final artwork before submitting.

## Before you publish

- **Content.** Titles, cast and synopses in `src/catalog.js` are invented placeholders, and the streams are public test videos (Mux test stream and Google's sample films). Replace them with content you hold the rights to, ideally loaded from your CMS or API.
- **DRM.** The player plays clear HLS/MP4. Studio content usually needs Widevine DRM: use hls.js with EME, or move playback to ExoPlayer/Media3 in the Android wrapper.
- **Subscription rules.** Amazon's Appstore policies cover in-app purchases of digital content. Check whether selling the pass on a phone web page is allowed for your app category and region, or offer Amazon In-App Purchasing alongside it.
- **Pass expiry.** An ERC-1155 balance never expires. For a monthly pass, check an expiry you store on-chain (for example an ERC-5643 subscription NFT) or burn and re-claim each month.
