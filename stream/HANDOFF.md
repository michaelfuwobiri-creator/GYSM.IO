# GYSM Stream: handoff for deployment and Amazon Appstore submission

Everything another assistant or person needs to finish deploying and submitting the app. **No passwords or keys are in this file.** The signing key, its passwords and the base64 copy for GitHub are in three separate files the owner keeps privately (`gysm-release.jks`, `GITHUB-SECRETS.txt`, `FIRETV_KEYSTORE_BASE64.txt`). Never paste those into a chat.

## Paste this into the new chat

> I'm finishing the Amazon Appstore submission for my Fire TV app, GYSM Stream. The code is in the public GitHub repository michaelfuwobiri-creator/GYSM.IO on branch `claude/gifted-hawking-98io3u`, folder `stream/`. The full handoff, with what is done and what is left, is in `stream/HANDOFF.md` on that branch. Please read it and walk me through the remaining steps one at a time. Don't ask me for my signing key passwords; I add those to GitHub Secrets myself.

## 1. The app

| | |
| --- | --- |
| Name | GYSM Stream |
| What it is | A Fire TV film app that downloads films in the background on Wi-Fi (smart downloads), so people can watch offline and save data |
| Films | Blender Foundation open movies (CC BY) and public-domain classics, streamed from Wikimedia Commons. Optional licensed films via Filmhub (none added yet). No Netflix or YouTube content: their terms forbid this kind of downloading. |
| Platform | Fire OS (Android). Not Vega OS. |
| Package name | `io.gysm.stream` |
| Version | versionCode 1, versionName 1.0.0 |
| Target / min SDK | 34 / 22 (Amazon's Fire OS 8 minimum target is 30) |
| Signing | v1 + v2, release key `gysm-release.jks`, alias `gysm`, RSA 4096, SHA-256 fingerprint `ED:07:F8:8C:E5:7D:C7:55:E3:D7:7C:26:02:2C:7A:23:36:59:D9:45:CF:03:E8:BC:A0:79:8A:98:69:72:09:9C` |
| Price | Free, no ads, no accounts, no in-app purchases, collects no user data |
| Owner contact | michaelfuwobiri@gmail.com |

## 2. Where everything is

- **Repository:** https://github.com/michaelfuwobiri-creator/GYSM.IO (public)
- **Branch with the app:** `claude/gifted-hawking-98io3u`. The default branch, `claude/stoic-brown-lg6cnw`, has only the Cadence&co shop.

| Path | Contents |
| --- | --- |
| `stream/web/` | The app (HTML/CSS/JS). Packaged inside the APK; also the website. |
| `stream/android/` | Fire OS WebView wrapper (Kotlin, Gradle) |
| `stream/store-assets/` | All Amazon images, `listing.md` (store text), `SUBMISSION.md` (detailed checklist) |
| `privacy/index.html` | Privacy policy page |
| `stream/build-site.sh` | Builds the website into `_site/` for Cloudflare Pages |
| `stream/tools/filmhub-import.mjs` | Optional: imports Filmhub delivery packages |
| `.github/workflows/firetv-apk.yml` | GitHub Actions: builds the debug APK, plus the signed release APK when secrets exist |
| `stream/README.md` | Technical documentation |

## 3. Status

**Done and verified**
- The web app passes browser tests: remote navigation, smart downloads, resumable downloads, offline playback, subtitles, Filmhub licence rules.
- The Fire TV APK compiles on GitHub Actions. The first debug build succeeded: https://github.com/michaelfuwobiri-creator/GYSM.IO/actions/runs/40944258256 (artifact `gysm-stream-debug-apk`, 6.9 MB).
- Store images are made and checked for size and transparency.
- Listing text, privacy policy (with email), content-rating guidance and reviewer notes are written.
- The release signing key is created and given to the owner.

**Not yet done (owner actions)**
1. Add the 4 GitHub secrets (section 4).
2. Publish the website on Cloudflare Pages (section 5).
3. Build the signed release APK (section 6).
4. Test on a Fire TV (section 7).
5. Submit in the Amazon Developer Console (section 8).

**Not verified yet**
- The signed release build: it can only run once the secrets are added.
- The app on a real Fire TV device.
- Real films playing from Wikimedia Commons: the development sandbox couldn't reach Wikimedia, so tests used the bundled demo clips.

## 4. GitHub secrets

At https://github.com/michaelfuwobiri-creator/GYSM.IO/settings/secrets/actions, choose **New repository secret** for each. The values are in the owner's private `GITHUB-SECRETS.txt`.

| Secret name | Value |
| --- | --- |
| `FIRETV_KEYSTORE_BASE64` | Whole contents of `FIRETV_KEYSTORE_BASE64.txt` |
| `FIRETV_KEYSTORE_PASSWORD` | From `GITHUB-SECRETS.txt` |
| `FIRETV_KEY_ALIAS` | `gysm` |
| `FIRETV_KEY_PASSWORD` | From `GITHUB-SECRETS.txt` (same as the keystore password) |

## 5. Website and privacy policy (Cloudflare Pages)

The Amazon listing needs a public privacy-policy URL. Set it up at dash.cloudflare.com (account "Michaelfuwobiri@gmail.com's Account"): **Workers & Pages → Create → Pages → Connect to Git → `michaelfuwobiri-creator/GYSM.IO`**.

| Setting | Value |
| --- | --- |
| Project name | `gysm-stream` |
| Production branch | `claude/gifted-hawking-98io3u` |
| Framework preset | None |
| Build command | `bash stream/build-site.sh` |
| Build output directory | `_site` |

Result: the app at `https://gysm-stream.pages.dev/` and the privacy policy at `https://gysm-stream.pages.dev/privacy/`. If Cloudflare assigns another address, update the "Privacy policy URL" and "Website" lines in `stream/store-assets/listing.md`.

Hosts already ruled out:
- GitHub Pages is not switched on and needs the owner to change a repo setting.
- Vercel is blocked by an overdue balance on the owner's Vercel team.
- Supabase serves HTML as plain text, so it can't host web pages.

## 6. Build the signed release APK

After section 4: open https://github.com/michaelfuwobiri-creator/GYSM.IO/actions/workflows/firetv-apk.yml, choose **Run workflow** on branch `claude/gifted-hawking-98io3u`, and wait about 5 minutes. On the run page, under **Artifacts**, download `gysm-stream-release-apk` (a zip). It contains `app-release.apk`. Artifacts only appear when signed in to GitHub on a computer.

## 7. Test on a Fire TV

On the Fire TV:
1. Open **Settings → My Fire TV → About** and select the device name 7 times.
2. Go to **Developer options → ADB debugging → On**.
3. Note the IP address under **About → Network**.

From a computer:
```bash
adb connect <fire-tv-ip>:5555
adb install -r app-release.apk
```

Then check:
- The app opens from Your Apps & Channels.
- The remote alone works: D-pad, Select, Back, Menu, Play/Pause, Rewind and Fast-forward.
- Back on the home screen exits the app.
- Pressing Home during a film pauses it.
- Films play.
- Adding a title to My List downloads it on Wi-Fi, and it plays with the network off.
- Nothing is cut off at the screen edges.

## 8. Amazon Developer Console submission

Go to **developer.amazon.com → Apps & Services → My Apps → Add New App → Android**.

**Availability and pricing:** Free, all countries.

**Store text** (full text in `stream/store-assets/listing.md`):
- Title: GYSM Stream
- Category: Movies & TV (or the closest Fire TV category offered)
- Short description, long description, feature bullets and keywords: copy them from `listing.md`.
- Support email: michaelfuwobiri@gmail.com
- Website: https://github.com/michaelfuwobiri-creator/GYSM.IO
- Privacy policy: https://github.com/michaelfuwobiri-creator/GYSM.IO/blob/claude/gifted-hawking-98io3u/PRIVACY.md

**Images** (all in `stream/store-assets/`):

| Console field | File | Spec |
| --- | --- | --- |
| Small icon | `icon-114.png` | 114×114 PNG, transparent |
| Large icon | `icon-512.png` | 512×512 PNG, transparent |
| Fire TV app icon | `fire-tv-icon-1280x720.png` | 1280×720 PNG, opaque |
| Fire TV background | `background-1920x1080.jpg` (PNG copy also included) | 1920×1080 |
| Screenshots | `screenshot-1-home.png` … `screenshot-6-offline-player.png` | 6 images, 1920×1080 |

The screenshots were taken in a test browser, where only the bundled demo clips could load. Real captures from a Fire TV with films showing would make a stronger listing: `adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png`.

**Content rating:** Suggested answers are in `SUBMISSION.md`. In short:
- Horror themes: yes (Nosferatu).
- Realistic and fantasy violence: mild.
- Sexual content and gambling: none.
- Profanity, and drugs, alcohol or tobacco: mild.
- No data collection, accounts, ads or in-app purchases.

Expect a teen rating.

**Binary:** upload `app-release.apk`, select Fire TV devices, language English. For export compliance, the app uses only standard HTTPS.

**Notes for the reviewer:**
> No login or account exists in this app (Settings shows "Account: None required"). All films are hosted on GYSM's own servers; the app does not access, save or convert media from any third-party site. The catalogue is Blender Foundation open movies (Creative Commons Attribution, which permits redistribution) and public-domain silent films. "Save for offline" keeps our own titles inside the app's private storage, like downloads in other streaming apps; files cannot be exported. To test it, add a title to My List (press Menu) on Wi-Fi, wait for "ready to watch offline", then disconnect the network and play it from Downloads.

**Submit.** Review usually takes a few days. If it is rejected, fix the named test case, raise `versionCode` in `stream/android/app/build.gradle.kts`, push (GitHub rebuilds the APK), and upload the new APK.

## 9. Rules for whoever continues

- Never commit `gysm-release.jks`, `keystore.properties` or any password. The repository is public, and `.gitignore` already excludes these files.
- Every update must be signed with the same key. If the key is lost, the app can't be updated.
- Don't add Netflix or YouTube downloads: both forbid it.
- Filmhub titles are optional and streaming-only by default. Only allow downloads (`--allow-offline`) if the licence permits it without DRM.
- Keep `stream/web/catalog/filmhub.json` free of sample titles, and never ship a `stream/web/filmhub-media/` folder: everything in `stream/web/` goes into the APK.
