# GYSM Stream: handover

Everything needed to continue the work: what the app is, where everything is, what was rejected and fixed, what is tested, and what is left. **No passwords or keys are in this file.** The signing key and its secrets are held privately by the owner and stored in GitHub Secrets.

Last updated: 31 October 2026 · branch `claude/gifted-hawking-98io3u`

## Paste this into a new chat

> I'm continuing work on GYSM Stream, a Fire TV film app. The code is in the public GitHub repository michaelfuwobiri-creator/GYSM.IO, branch `claude/gifted-hawking-98io3u`, folder `stream/`. Read `stream/HANDOFF.md` on that branch first; it has the status, links and remaining steps. Never ask me for the signing key or passwords; they are in GitHub Secrets. Don't push to any other branch.

## 1. The app

| | |
| --- | --- |
| Name | GYSM Stream |
| What it does | A Fire TV film app. **Smart downloads** save films in the background on Wi-Fi so they play offline with no data used. Watched films are cleared automatically. |
| Films | 9 films hosted by GYSM itself: Blender Foundation open movies (Creative Commons) and two public-domain silent films. The full list is in section 4. |
| Accounts | None. No sign-in, sign-up, ads, payments or analytics. Settings shows "Account: None required". |
| Platforms | Fire OS (Android APK, the one submitted); a web version; a Vega OS version (not yet built with the Vega SDK) |
| Package / version | `io.gysm.stream`, **1.0.1** (versionCode 2) |
| Target / min SDK | 34 / 22 |
| Signing | Release key alias `gysm`, RSA 4096, SHA-256 `ED:07:F8:8C:E5:7D:C7:55:E3:D7:7C:26:02:2C:7A:23:36:59:D9:45:CF:03:E8:BC:A0:79:8A:98:69:72:09:9C` |
| Owner contact | michaelfuwobiri@gmail.com |

## 2. Links

| What | Link |
| --- | --- |
| Repository | https://github.com/michaelfuwobiri-creator/GYSM.IO (public; app on branch `claude/gifted-hawking-98io3u`) |
| **Signed store APK (1.0.1)** | https://github.com/michaelfuwobiri-creator/GYSM.IO/actions/runs/41184835252/artifacts/13035947499 (sign in to GitHub; unzip to get `app-release.apk`). Newer builds appear under Actions → Build Fire TV APK. |
| Test APK (fixed link, no sign-in) | https://github.com/michaelfuwobiri-creator/GYSM.IO/releases/download/test-build/gysm-stream-test.apk (rebuilt on every push) |
| Browser test, demo clips only | https://claude.ai/artifact/9BniqLPN8feR7EDBH4AaqH (private to the owner) |
| Browser test with films | https://michaelfuwobiri-creator.github.io/GYSM.IO/stream/ (works once GitHub Pages publishes this branch; see section 7) |
| Privacy policy (for the listing) | https://github.com/michaelfuwobiri-creator/GYSM.IO/blob/claude/gifted-hawking-98io3u/PRIVACY.md |
| Film files | GitHub release `films`: https://github.com/michaelfuwobiri-creator/GYSM.IO/releases/tag/films |

## 3. The Amazon rejection and what was fixed

Version 1.0 was rejected on two counts:

1. **"Settings → Sign in: unable to create or sign in to the account."** GYSM Stream has no sign-in screen; every file in the app was searched. Another app in this repository, **Nollywood TV** (branch `claude/zealous-gauss-0wwvur`, package `tv.nollywood.app`), has a thirdweb email sign-in, so the reviewer most likely received that APK. To prevent it happening again: upload only the GYSM APK and check that the console shows `io.gysm.stream`. Settings now starts with "Account: None required".
2. **"Saves, streams or downloads media from third-party sources without authorization."** Version 1.0 streamed films from Wikimedia Commons at runtime. Fixed in 1.0.1:
   - every film is copied once into GYSM's own hosting (the `films` release), and the app connects only there;
   - the Wikimedia API client and search are removed;
   - films that are public domain only in the US were dropped;
   - each title shows its licence and credit;
   - saved films can only be played inside the app.

The reply to Amazon and the reviewer note are ready in `stream/store-assets/AMAZON-REPLY.md`.

## 4. Films (all published and checked)

| Film | Licence | Credit | Length |
| --- | --- | --- | --- |
| Big Buck Bunny | CC BY 3.0 | Blender Foundation | 11 min |
| Sintel | CC BY 3.0 | Blender Foundation (Durian Open Movie Project) | 15 min |
| Tears of Steel | CC BY 3.0 | Blender Foundation | 12 min |
| Cosmos Laundromat | CC BY-SA 3.0 | Blender Foundation | 12 min |
| Elephants Dream | CC BY 2.5 | Orange Open Movie Team | 11 min |
| Spring | CC BY 4.0 | Andy Goralczyk / Blender Foundation | 8 min |
| Caminandes: Llama Drama | CC BY 3.0 | Pablo Vazquez, Beorn Leonard, and Francesco Siddi | 2 min |
| A Trip to the Moon | Public domain | Georges Méliès | 13 min |
| Nosferatu | Public domain | F. W. Murnau / Henrik Galeen | 92 min |

**Agent 327** is in the catalogue but deliberately not published. The first run picked a wrong 56-minute video; the stricter check (name and length must match) then found no correct copy, so the title stays hidden. The first run also picked a NASA video for A Trip to the Moon; that was deleted and replaced with the correct film.

## 5. Where things are

| Path | What it is |
| --- | --- |
| `stream/web/` | The app (HTML, CSS, JS). Bundled inside the APK, and also the website. Entry: `index.html`, `js/app.js`. |
| `stream/web/js/config.js` | `MEDIA_BASE` (film hosting) and the film-list URLs |
| `stream/web/js/catalog.js` | Titles and rows; a film appears only once it's in the film list |
| `stream/web/js/downloads.js` | Smart downloads; native path on Fire OS; Cache Storage path elsewhere |
| `stream/web/js/sources.js` | Turns a title into its video URL, poster, licence and credit |
| `stream/web/js/player.js` | Player: remote keys, touch buttons, subtitles, 15 s stuck-video message |
| `stream/web/catalog/media-manifest.json` | Published film list, committed by the film workflow |
| `stream/android/` | Fire OS app: `MainActivity.kt` (WebView, remote keys, bridge) and `OfflineStore.java` (native resumable downloads; serves saved films at `/offline/<id>` with Range support) |
| `stream/vega/` | Vega OS app: `src/App.tsx` (Vega WebView shell), `scripts/build-web.mjs`, `README.md` |
| `stream/tools/mirror-films.mjs` + `.json` | Copies films into GYSM hosting: licence check (CC BY / BY-SA / CC0 / public domain only), name and length check, H.264 conversion |
| `stream/tools/filmhub-import.mjs` | Optional: imports Filmhub delivery packages as licensed films |
| `stream/store-assets/` | Icons, Fire TV icon, background, 6 screenshots, logos, `listing.md`, `SUBMISSION.md`, `RESUBMISSION.md`, `AMAZON-REPLY.md` |
| `PRIVACY.md` | Privacy policy (rendered by GitHub; linked from the listing) |
| `.github/workflows/firetv-apk.yml` | Builds the debug APK, publishes it to the `test-build` release, and builds the signed release APK when the 4 secrets exist |
| `.github/workflows/mirror-films.yml` | Publishes films to the `films` release, commits the film list and rebuilds the APK. Runs when the mirror files change, or by hand. |

## 6. How it works (short)

- **Film hosting.** Films are downloads of the `films` release: flat names such as `sintel-480.mp4`, `sintel-poster.jpg` and `sintel.meta.json`. Each film has 480p and 720p versions (360p and 480p for the two long silent films).
- **Film list.** `media-manifest.json` is bundled in the app, and the live copy on `raw.githubusercontent.com` adds films without an app update.
- **Offline on Fire OS.** Release downloads have no CORS headers, so web pages can't save them. The Fire OS app saves them natively instead, through `OfflineStore.java`, which resumes interrupted downloads and serves saved files to the player with seeking. In the browser and on Vega these films are streaming only.
- **Republishing a film.** Raise its `rev` in `stream/tools/mirror-films.json` and push. The workflow deletes the old copy and publishes it again.

## 7. Status

**Done and verified**
- All 9 films published, each checked for licence, credit and length.
- Signed release APK 1.0.1 built (run 41184835252).
- Test APK published at the fixed link.
- Downloader: 14 JVM unit tests pass (resume after a dropped connection, Range serving, rejecting bad ids).
- Browser tests pass for the remote and keyboard, touch controls, smart downloads, offline playback, the native download path (with a stand-in for the Fire OS downloader) and the Vega build loaded from local files.
- Store listing, privacy policy, content-rating answers, reviewer note and reply are written.

**Not verified**
- The app on a real Fire TV. The owner has no Fire TV; use an Android phone, the Android Studio TV emulator, or Amazon Live App Testing.
- The Vega OS build with the Vega SDK. Amazon's site and SDK weren't reachable from the build environment; `App.tsx` was type-checked against the real Vega packages.
- The GitHub Pages site. `has_pages` is true, but no Pages build ran after a push to this branch, so Pages is probably set to the default branch `claude/stoic-brown-lg6cnw`. Fix: Settings → Pages → Branch `claude/gifted-hawking-98io3u`, `/ (root)`.

## 8. What's left (owner)

1. **Amazon Developer Console → GYSM Stream → App files:** upload `app-release.apk` from the signed build and check that the package shows **`io.gysm.stream`**. Replace the rejected file if it says `tv.nollywood.app`.
2. **Listing:** privacy policy URL from section 2; text from `listing.md`; images from `store-assets/`; content rating answers from `SUBMISSION.md`.
3. **Testing instructions:** paste the short note from `AMAZON-REPLY.md`.
4. **Submit,** then send the full reply in `AMAZON-REPLY.md` through Contact Us → Appstore → App Submission and Certification → App Content Policy Review Results.
5. Optional: test first with Amazon's tools (upload compatibility check, App Testing Service, Live App Testing) or the test APK on an Android phone.

## 9. Rules for whoever continues

- Work and push only on `claude/gifted-hawking-98io3u`.
- Never commit `gysm-release.jks`, `keystore.properties` or any password; the repository is public. The 4 `FIRETV_` secrets are already in GitHub Secrets.
- Every update must use the same signing key, and must raise `versionCode` in `stream/android/app/build.gradle.kts`.
- Never stream or download from third-party sites in the app: Amazon rejects that. New films go through `mirror-films.json` (freely licensed) or `filmhub-import.mjs` (licensed). No Netflix or YouTube downloads; their terms forbid it.
- Keep Nollywood TV (`tv.nollywood.app`) separate from GYSM Stream.
- Hosting films as GitHub release downloads is fine for launch. If usage grows, move them to a CDN such as Cloudflare R2 and change `MEDIA_BASE`.
