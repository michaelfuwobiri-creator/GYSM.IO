# GYSM Stream: free films that download themselves

A streaming app for **Amazon Fire TV**. Its distinctive feature is **smart downloads**: while the TV is on an unmetered connection, the app downloads films in the background. Viewers can then watch offline, and a film already on the device uses no data when it plays.

| Folder | What it is |
| --- | --- |
| `web/` | The app (HTML, CSS, JavaScript, no dependencies). Runs in any browser and inside the Fire TV app. |
| `android/` | Fire OS app: a Kotlin WebView shell that meets Amazon's Fire TV requirements. |
| `store-assets/` | Amazon Appstore listing images: icons (512 and 114 px), 1920×1080 background, 1920×1080 screenshots. |

## Why there is no Netflix in it

Netflix has had no public API since 2014, and its films are DRM-protected. Downloading them outside the Netflix app would mean breaking that protection, which is copyright infringement and against Netflix's terms. This app uses only films that may be streamed **and** downloaded:

- **Blender Foundation open movies** (Big Buck Bunny, Sintel, Tears of Steel, and others) under Creative Commons Attribution.
- **Public-domain classics** (Night of the Living Dead, Nosferatu, The General, and others).
- Both are served by **Wikimedia Commons**, which only hosts freely licensed media. Its API is public, needs no key and allows browser (CORS) access. The licence and author of each title are read from Commons and shown on its details screen, as CC-BY requires.
- Three short demo clips are bundled in `web/media/` so downloads and offline playback can be tried with no network.

To use a licensed catalogue instead, replace `web/js/catalog.js` and add a resolver in `web/js/sources.js`. The rest of the app does not change. See [Legal sources of films](#legal-sources-of-films) below.

## How smart downloads work

`web/js/downloads.js`:

1. **What gets downloaded:** Continue Watching first, then My List, then featured titles, until *Titles to keep ready* (default 5) is reached or the *storage limit* (default 2 GB) would be exceeded. 16+ titles are skipped when *Hide 16+ titles* is on.
2. **When:** only while online. With *unmetered networks only* on, only on Wi-Fi or Ethernet. On Fire TV, the Android `ConnectivityManager.isActiveNetworkMetered()` decides; in a browser, `navigator.connection`.
3. **How:** films are fetched in 4 MB pieces with HTTP Range requests and stored in Cache Storage. If the app is closed or the connection drops, the download resumes from the last piece. Servers without Range support are fetched in one piece.
4. **Playback:** a downloaded film plays from local storage (the pieces are joined into one Blob). The player shows "Playing offline · no data used". The Downloads page counts the data saved.
5. **Clean-up:** when a smart download has been watched to the end, it is deleted and the next title is fetched. Downloads you start yourself stay until you delete them.

The planner runs at start-up, every minute, and whenever the network or a setting changes.

## Fire TV requirements covered

| Requirement | Where |
| --- | --- |
| Works with the remote alone: D-pad, Select, Back, Menu, Play/Pause, Rewind, Fast-forward. No touch, mouse or keyboard needed. | `web/js/focus.js`, `web/js/platform.js`, `MainActivity.dispatchKeyEvent` |
| Clear focus indicator at 10 feet | `.focusable:focus` in `web/css/app.css` |
| Back goes back one step; Back on the home screen exits to the Fire TV launcher | `handle('back')` in `app.js` and `finish()` in `MainActivity` |
| Content inside the overscan safe zone (5%: 96 px × 54 px at 1080p) | `--safe-x` and `--safe-y` in `app.css` |
| 1080p layout, text at least 24 px | Fixed 1920×1080 canvas scaled to the screen |
| Appears on the Fire TV home screen | `LEANBACK_LAUNCHER` intent filter, 320×180 `android:banner` |
| Not filtered out of the Appstore for missing touch support | `android.hardware.touchscreen required="false"` |
| Playback pauses when the user presses Home or another app opens | `MainActivity.onPause` calls `GYSM.onPause()` |
| Screen saver held off during playback only | `FLAG_KEEP_SCREEN_ON`, set and cleared through the JavaScript bridge |
| Landscape only, HTTPS only | Manifest: `screenOrientation`, `usesCleartextTraffic="false"` |
| Respects limited storage (Fire TV Sticks have about 5 GB free) | Storage limit setting, default 2 GB |
| Maturity ratings | Every title has a rating badge; 16+ titles can be hidden |

## Run the web version

```bash
cd stream/web
python3 -m http.server 8000
```

Open http://localhost:8000. Downloads need a secure context (`localhost` or `https`). Keyboard controls: arrow keys move, Enter selects, Esc or Backspace goes back, Space is Play/Pause, `,` and `.` rewind and fast-forward, M is the Menu key (adds the focused title to My List).

## Build the Fire TV app

You need Android Studio (Koala or newer) or the Android SDK command-line tools with JDK 17.

1. In Android Studio, open the `stream/android` folder and wait for Gradle sync. Then choose **Build → Build APK(s)**.
   - Command line, with Gradle 8.7 or newer installed: `cd stream/android && gradle assembleDebug`
2. The APK is written to `stream/android/app/build/outputs/apk/debug/app-debug.apk`.

The web app is copied into the APK as assets. Rebuild after changing anything in `web/`.

### Install on a Fire TV (sideload)

1. On the Fire TV: **Settings → My Fire TV → About**, and select the device name 7 times to turn on developer options.
2. **Settings → My Fire TV → Developer options**: turn on **ADB debugging**.
3. Find the IP address under **Settings → My Fire TV → About → Network**.
4. On your computer:
   ```bash
   adb connect 192.168.1.50:5555      # your Fire TV's address
   adb install -r app-debug.apk
   ```
5. GYSM Stream appears under **Your Apps & Channels**.

To debug the WebView, open `chrome://inspect` on your computer while a debug build is running.

### Publish on the Amazon Appstore

1. Create a signed release build: **Build → Generate Signed Bundle / APK → APK**. Keep the keystore safe; every update must be signed with the same key.
2. In the Amazon Developer Console, add a new app for **Fire TV** and upload the APK.
3. Upload the images in `store-assets/` (icons, background, screenshots).
4. Fill in the content rating questionnaire. The catalogue includes horror titles rated 16+.
5. Credit the Blender Foundation open movies under CC-BY in the description, for example: "Includes films © Blender Foundation, licensed CC BY, cloud.blender.org".

## Legal sources of films

| Source | What you get | Offline downloads |
| --- | --- | --- |
| **Wikimedia Commons API** (used now) | Free-licensed and public-domain films; licence data included | Allowed. Keep the attribution. |
| **Internet Archive** (`archive.org/metadata/{id}`, `advancedsearch.php`) | Large public-domain feature film collection | Allowed for public-domain items. Licences vary by item, so check each one. |
| **Blender Studio** (studio.blender.org) | The open movies in high quality | Allowed (CC-BY) |
| **Pexels Videos API** / **Pixabay API** | Free stock footage and short clips, free API key | Allowed under their licences |
| **Vimeo API** | Videos from creators who license them to you, or your own uploads | Only where the owner allows downloads |
| **Filmhub** (licensing marketplace) | Thousands of independent films and series licensed to your platform, revenue share | As agreed in the licence; usually needs DRM |
| Studio or distributor licensing (Cineverse, FilmRise, and others) | Mainstream catalogues | Usually needs DRM-protected downloads with expiry dates |
| **TMDB API** | Posters, cast, plot summaries | Metadata only, no video |

For licensed (non-free) films, downloads normally have to be DRM-protected. Fire TV supports Widevine and PlayReady offline licences through ExoPlayer/Media3 `DownloadManager`. Services such as AWS Elemental MediaConvert with SPEKE, PallyCon, EZDRM or BuyDRM issue those licences. That would replace the Cache Storage download path with a native one in `android/`.
