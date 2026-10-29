# Cadence & Co — 3D product reels

Turns every listing in the Shopify store into a 12-second vertical video for Facebook and Instagram Reels:

1. **Fly-in:** the product's photos fly in from the background as a spinning 3D ring of cards.
2. **Turn:** the ring turns once so each photo comes to the front, with a light sweep across the cards.
3. **Product info:** the category, product name and a gold price tag animate in.
4. **End card:** a pulsing **Shop now** button and the shop's web address.

Output per listing: `<handle>.mp4` (1080×1920, 30 fps, H.264 with a silent AAC track, which is the format Facebook expects) and `<handle>.jpg` (cover image). `captions.csv` holds a ready-made caption with price, link and hashtags for every reel.

## Files

| File | What it is |
| --- | --- |
| `products.json` | The 70 active listings exported from Shopify (title, type, price, link, up to 3 photo URLs). |
| `reel.html` | The animation. Open `reel.html?demo` in a browser to watch it loop with sample art. |
| `render.mjs` | Downloads the photos, records every frame and encodes the MP4s. |
| `fonts/` | Cormorant Garamond and Inter (SIL Open Font License), embedded so rendering works offline. |

## Render on GitHub (no setup)

Every push that changes `reels/` runs the **Render product reels** workflow (`.github/workflows/reels.yml`). You can also start it by hand under **Actions → Render product reels → Run workflow**.
- It renders the reels in 7 parallel batches using the original Shopify photos.
- It publishes a new **Release** with every reel as its own download, plus the cover images and `captions.csv`.
- Find it under **Releases** on the repository page. It takes about 10–15 minutes.

## Render on your computer

Needs Node 18+, ffmpeg, curl, and Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`).

```sh
node reels/render.mjs                         # all 70 listings → reels/out/
node reels/render.mjs --only=aella-ring       # one listing (comma-separate several)
node reels/render.mjs --limit=5 --jobs=2      # first 5, two at a time
node reels/render.mjs --placeholder --limit=1 # test run with stand-in art, no downloads
```

Each reel takes about 35 seconds with 3 jobs in parallel, so all 70 take roughly 40 minutes. Photos are cached in `reels/.cache/`. Videos go to `reels/out/`. Neither folder is committed.

To refresh the listings, export the store's products again into `products.json` in the same shape.

## Posting tips

- Upload in Meta Business Suite → Reels, and use the matching row of `captions.csv` as the caption.
- Add music from Facebook's own library while uploading. The videos have a silent track, so there are no music-licensing problems.
- Links in Reel captions aren't clickable, so the end card shows the shop address. A boosted Reel can carry a real "Shop now" button.
