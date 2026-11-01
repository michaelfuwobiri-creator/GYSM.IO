# Reply to the Appstore review (version 1.0.1)

Send this through **Contact Us → Appstore → App Submission and Certification → App Content Policy Review Results**, and paste the short version into the **Testing instructions** box when you resubmit. Before sending, check the package name of the APK you uploaded (see the note at the end).

## Full reply

> Subject: Striim – response to content policy review, resubmitted as version 1.0.1
>
> Hello,
>
> Thank you for the review. We have made the following changes in version 1.0.1 (versionCode 2).
>
> **1. "Unable to create/sign in to the account" (Settings → Sign in)**
> Striim has no accounts, no sign-in, no sign-up and no payments. Its Settings screen contains only playback and download preferences. To make this clear to users, Settings now starts with an "Account: None required" entry. Package name: io.gysm.stream. If the video shows a sign-in screen, it may show a different app, and we would be grateful if you could check the package name.
>
> **2. Saving, streaming or downloading media from third-party sources**
> Version 1.0 streamed films from Wikimedia Commons. In version 1.0.1, the app no longer accesses, saves or converts media from any third-party site.
> - Every film is hosted on our own servers (Striim's own film storage, in the GYSM repository on GitHub) and is listed in our own catalogue. The app connects only to our servers.
> - We have the right to distribute every title. The catalogue consists of Blender Foundation open movies under Creative Commons licences (CC BY, and CC BY-SA for one title), which explicitly permit redistribution with credit (the credit is shown on each title and in the description), and silent films whose creators died over 70 years ago, which are in the public domain worldwide. Titles that are public domain only in some countries have been removed.
> - "Save for offline" works like downloads in other streaming apps. It keeps our own titles in the app's private storage for playback inside Striim only. Files cannot be exported, converted or opened by other apps, and users cannot enter links or search other services.
> - The privacy policy and description have been updated to match.
>
> Please let us know if you need any further information.
>
> Kind regards,
> Striim
> michaelfuwobiri@gmail.com

## Short version for the Testing instructions box

> Version 1.0.1. No login or account exists in this app (Settings shows "Account: None required"). All films are hosted on Striim's own servers; the app does not access, save or convert media from any third-party site. The catalogue is Blender Foundation open movies (Creative Commons CC BY, and CC BY-SA for one title, which permit redistribution) and public-domain silent films. "Save for offline" keeps our own titles inside the app's private storage, like downloads in other streaming apps; files cannot be exported. To test it, add a title to My List (press Menu) on Wi-Fi, wait for "ready to watch offline", then disconnect the network and play it from Downloads.

## Before you resubmit: check the APK

The reviewer described a **Sign in** screen, and Striim has none. The repository also contains a different app, "Nollywood TV" (branch `claude/zealous-gauss-0wwvur`, package `tv.nollywood.app`), which does have a sign-in. In the Developer Console, open the rejected submission → **App files** and check the package name:

- **io.gysm.stream** → send the reply above as it is.
- **tv.nollywood.app** → the wrong APK was uploaded. Upload the Striim APK from the **Build Fire TV APK** workflow instead, and remove the first paragraph of point 1 from the reply.
