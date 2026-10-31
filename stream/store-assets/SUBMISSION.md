# Amazon Appstore submission checklist: GYSM Stream

Everything for the Developer Console is in this folder. Work through the steps in order. Items marked **you** need your details or your computer.

## 1. Before you start (you)

- [ ] Amazon Developer account at https://developer.amazon.com (free). Accept the Developer Services Agreement.
- [ ] A support email address and a website.
- [ ] Publish the website and privacy policy on Cloudflare Pages: **Workers & Pages → Create → Pages → Connect to Git → `michaelfuwobiri-creator/GYSM.IO`**, project name `gysm-stream`, production branch `claude/gifted-hawking-98io3u`, framework preset None, build command `bash stream/build-site.sh`, output directory `_site`. The privacy policy is then at https://gysm-stream.pages.dev/privacy/ (the support email in it is already filled in).
- [ ] Replace the placeholders under "Contact details" in `listing.md`.
- [ ] A Fire TV device to test on.

## 2. Build the signed release APK (you)

You need Android Studio (or the Android SDK command-line tools) and JDK 17.

1. Create your signing key once, and **back it up**. Every future update must be signed with the same key.
   ```bash
   cd stream/android
   keytool -genkeypair -v -keystore gysm-release.jks -alias gysm -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Copy `keystore.properties.example` to `keystore.properties` and fill in the passwords. Git ignores this file.
3. Make sure `stream/web/catalog/filmhub.json` contains only titles you license (it is empty by default), and that there is no `stream/web/filmhub-media/` folder. Everything in `stream/web/` goes into the APK.
4. Build:
   - Android Studio: open `stream/android`, then **Build → Generate Signed Bundle / APK → APK → release**, or
   - Command line: `gradle assembleRelease`
5. The APK is `stream/android/app/build/outputs/apk/release/app-release.apk`. It is signed with v1 and v2 signatures, as Fire OS 8 requires.

### Or let GitHub build it

The workflow `.github/workflows/firetv-apk.yml` builds the APK on every push to this branch, with no Android Studio needed:

1. Create the key with `keytool` as in step 1 above (keytool comes with any Java install).
2. In the repository's **Settings → Secrets and variables → Actions**, add `FIRETV_KEYSTORE_BASE64` (the output of `base64 -w0 gysm-release.jks`; on a Mac, `base64 -i gysm-release.jks`), `FIRETV_KEYSTORE_PASSWORD`, `FIRETV_KEY_ALIAS` and `FIRETV_KEY_PASSWORD`.
3. Open **Actions → Build Fire TV APK → Run workflow**. When it finishes, download **gysm-stream-release-apk** from the run page. Without the secrets you get only the debug APK, which is fine for sideloading but not for the store.

## 3. Test on a Fire TV (you)

Install it with `adb install -r app-release.apk` (see the README for turning on ADB), then check:

- [ ] The app appears under Your Apps & Channels with the GYSM banner
- [ ] Everything works with the remote alone: D-pad, Select, Back, Menu, Play/Pause, Rewind, Fast-forward
- [ ] Back on the home screen returns to the Fire TV launcher
- [ ] Pressing Home during a film pauses it
- [ ] Films load and play (from GYSM's own storage; MEDIA_BASE in `stream/web/js/config.js` must be set)
- [ ] Smart downloads start on Wi-Fi; with the network unplugged, saved films still play
- [ ] Nothing is cut off at the screen edges
- [ ] Optional: replace the screenshots here with real captures (`adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png`). The ones included were taken in a test browser, where only the bundled clips could load.

## 4. Developer Console

Go to **Apps & Services → My Apps → Add New App → Android** (Fire OS apps are Android apps).

### Availability and pricing
- Price: Free
- Countries: worldwide for the free films. If you add Filmhub titles, set CDN geo-blocking to match their territories.

### Appstore details: text
Copy the text from `listing.md`: title, short description, long description, feature bullets and keywords.

### Appstore details: images
| Console field | File |
| --- | --- |
| Small icon (114×114, transparent PNG) | `icon-114.png` |
| Large icon (512×512, transparent PNG) | `icon-512.png` |
| Fire TV icon (1280×720, PNG, no transparency) | `fire-tv-icon-1280x720.png` |
| Fire TV background (1920×1080) | `background-1920x1080.jpg` (a PNG copy is also included) |
| Screenshots (3 to 10, 1920×1080) | `screenshot-1-home.png` to `screenshot-6-offline-player.png` |

Logo files for your website or press are in `logo/`.

### Content rating
Answer the questionnaire honestly for the whole catalogue. Suggested answers for the current films:

| Topic | Suggested answer | Why |
| --- | --- | --- |
| Violence | Realistic violence: infrequent or mild (horror) | Nosferatu |
| Horror or fear themes | Yes | Nosferatu |
| Cartoon or fantasy violence | Infrequent or mild | Sintel, Agent 327, Tears of Steel |
| Sexual content or nudity | None | |
| Profanity or crude humour | Infrequent or mild | Older and independent films; review any Filmhub titles you add |
| Drugs, alcohol or tobacco | Infrequent or mild | Classic films show smoking |
| Gambling | None | |
| Collects user data | No | See the privacy policy |
| Account or login | No | |
| Advertising | No | |
| In-app purchases | No | |
| Users can communicate with each other | No | |

Expect a teen-level rating. The app shows its own age badges, and Settings can hide 16+ titles.

### Binary files
- [ ] Upload `app-release.apk`
- [ ] Device support: select **Fire TV** devices. Tablets and phones are optional; the interface is designed for TVs.
- [ ] Language: English
- [ ] Export compliance: the app uses only standard HTTPS encryption

### Testing instructions for the reviewer
Paste this into the notes for Amazon's testers:

> No login or account exists in this app (Settings shows "Account: None required"). All films are hosted on GYSM's own servers; the app does not access, save or convert media from any third-party site. The catalogue is Blender Foundation open movies (Creative Commons Attribution, which permits redistribution) and public-domain silent films. "Save for offline" keeps our own titles inside the app's private storage, like downloads in other streaming apps; files cannot be exported. To test it, add a title to My List (press Menu) on Wi-Fi, wait for "ready to watch offline", then disconnect the network and play it from Downloads.

## 5. Submit

Select **Submit App**. Review usually takes a few days, and Amazon emails you the result. If something fails, the email names the test case. Fix it, raise `versionCode` in `android/app/build.gradle.kts`, rebuild, and upload the new APK.
