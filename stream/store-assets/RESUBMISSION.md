# GYSM Stream 1.0.1: resubmission checklist

Everything Amazon checks, and where each item stands.

✅ done · ⏳ finishing on its own · ❗ needs you

## The two rejection reasons

| Reason | Status | Fix |
| --- | --- | --- |
| "Settings → Sign in: unable to create or sign in to the account" | ✅ | GYSM Stream has no sign-in screen anywhere; every file in the app was searched. The screen in Amazon's video matches a different app in this repository, Nollywood TV (package `tv.nollywood.app`), which does have a sign-in. Settings now starts with "Account: None required". **Upload the GYSM APK, package `io.gysm.stream`** (see ❗3). |
| "Saves, streams or downloads media from third-party sources" | ✅ | Films are now hosted by GYSM in its own repository (the `films` release) and the app connects only there. Wikimedia search and streaming are removed. Only CC BY and worldwide public-domain films remain, and each shows its licence and credit. |

## App file (APK)

| Requirement | Status |
| --- | --- |
| Package `io.gysm.stream`, version 1.0.1 (versionCode 2, higher than the rejected 1) | ✅ |
| Target API 34 (Amazon's minimum for Fire OS 8 is 30) | ✅ |
| Runs on 32- and 64-bit devices (no native code) | ✅ |
| Opens from the Fire TV home screen (`LAUNCHER` + `LEANBACK_LAUNCHER`, 320×180 banner) | ✅ |
| Doesn't require a touchscreen | ✅ |
| Builds on GitHub without errors | ✅ |
| **Signed with your release key (v1 + v2)** | ❗1 |
| Contains the films | ⏳ 7 of 10 published; the app rebuilds automatically when the rest finish |

## How the app behaves (Amazon's test criteria)

| Requirement | Status |
| --- | --- |
| Works with the remote alone (D-pad, Select, Back, Menu, Play/Pause, Rewind, Fast-forward) | ✅ tested in a browser with keyboard keys standing in for the remote |
| Back goes back one step; Back on Home exits to the Fire TV home screen | ✅ |
| Pressing Home pauses the film | ✅ |
| Nothing cut off at the screen edges (5% safe zone) | ✅ |
| No sign-in, no dead ends; a video that won't load shows a message and can be closed | ✅ |
| Films stream and save for offline viewing | ✅ tested with a stand-in for the native downloader; ⏳ real films once publishing finishes |
| Tested on a real device | ❗2 (an Android phone is enough if you have no Fire TV) |

## Store listing (Developer Console)

| Field | Status | Where |
| --- | --- | --- |
| Title, short and long description, feature bullets, keywords | ✅ | `listing.md` |
| Small icon 114×114, large icon 512×512 | ✅ | `icon-114.png`, `icon-512.png` |
| Fire TV icon 1280×720 | ✅ | `fire-tv-icon-1280x720.png` |
| Background 1920×1080 | ✅ | `background-1920x1080.jpg` |
| Screenshots, 3 to 10 at 1920×1080 | ✅ (6) | `screenshot-*.png`. They show the demo clips; captures with films are better if you can make them. |
| Privacy policy URL | ✅ | https://github.com/michaelfuwobiri-creator/GYSM.IO/blob/claude/gifted-hawking-98io3u/PRIVACY.md |
| Website | ✅ | https://github.com/michaelfuwobiri-creator/GYSM.IO |
| Support email | ✅ | michaelfuwobiri@gmail.com |
| Content rating answers | ✅ | `SUBMISSION.md`, "Content rating" (expect a teen rating; Nosferatu is horror) |
| Notes for the reviewers | ✅ | `AMAZON-REPLY.md`, short version |
| Reply to the rejection | ✅ | `AMAZON-REPLY.md`, full version |

## ❗ What only you can do

1. **Add the 4 signing secrets to GitHub.** Go to https://github.com/michaelfuwobiri-creator/GYSM.IO/settings/secrets/actions → **New repository secret**, four times, using the names and values in your private `GITHUB-SECRETS.txt` (for `FIRETV_KEYSTORE_BASE64`, paste all of `FIRETV_KEYSTORE_BASE64.txt`). Then open **Actions → Build Fire TV APK → Run workflow**. The store file appears on the run page under Artifacts as **gysm-stream-release-apk**.
2. **Test once on a real device.** Install https://github.com/michaelfuwobiri-creator/GYSM.IO/releases/download/test-build/gysm-stream-test.apk on an Android phone (sideways) or a Fire TV. Play a film, add one to My List, wait for "ready to watch offline", turn off Wi-Fi, and play it from Downloads.
3. **Upload the right file.** In the Developer Console, open GYSM Stream → **App files** → upload `app-release.apk` and check the package name shows **io.gysm.stream**. If the rejected upload shows `tv.nollywood.app`, that was the wrong app; replace it.
4. **Submit.** Paste the short reviewer note from `AMAZON-REPLY.md` into **Testing instructions**, submit, and send the full reply through **Contact Us → Appstore → App Submission and Certification → App Content Policy Review Results**.
