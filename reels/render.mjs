// Render a 3D Facebook/Instagram Reel (1080×1920 MP4) for every listing in
// products.json, plus a cover image and a captions file.
//
//   node reels/render.mjs                    all listings
//   node reels/render.mjs --only=aella-ring  one or more handles, comma-separated
//   node reels/render.mjs --limit=3          first N listings
//   node reels/render.mjs --placeholder      use stand-in art instead of photos
//   node reels/render.mjs --jobs=3 --out=reels/out
//   node reels/render.mjs --shard=2/7        every 7th listing, starting at the 2nd (for CI)
//
// Needs Node 18+, Playwright with Chromium, ffmpeg and curl on PATH.

import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const OUT = path.resolve(args.out || path.join(HERE, "out"));
const CACHE = path.join(HERE, ".cache");
const FPS = Number(args.fps || 30);
const JOBS = Number(args.jobs || 3);

const CATEGORY = {
  "BACKPACK": "Backpacks",
  "Earring": "Earrings",
  "Eau De Parfum": "Perfume",
  "All Aluminum Basic Wallet": "Wallets",
  "Hair Claws & Clips": "Hair accessories",
  "Gift": "Gift sets",
  "n/a": "Gift sets",
};
const HASHTAGS = {
  Earrings: "#earrings #hoops #jewellery",
  Rings: "#rings #jewellery #stackingrings",
  Necklaces: "#necklace #jewellery #layering",
  Bracelets: "#bracelet #jewellery #armcandy",
  Watches: "#watches #watchoftheday #timepiece",
  Perfume: "#perfume #fragrance #eaudeparfum",
  Backpacks: "#backpack #travelbag #everydaybag",
  Wallets: "#wallet #minimalistwallet #edc",
  "Hair accessories": "#hairaccessories #hairclip #hairstyle",
  "Gift sets": "#giftideas #surprisegift #gifts",
};

const data = JSON.parse(fs.readFileSync(path.join(HERE, "products.json"), "utf8"));
const shopHost = new URL(data.shop_url).host;

// "AELLA RING" -> "Aella Ring"; long marketplace titles are cut at " | ".
function cleanTitle(raw) {
  let t = raw.split(" | ")[0].replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "");
  if (letters.length && upper.length / letters.length > 0.7) {
    t = t.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  }
  return t;
}

function prepare(p) {
  const category = CATEGORY[p.type] || p.type;
  const title = shorten(cleanTitle(p.title));
  const price = new Intl.NumberFormat("it-IT", { style: "currency", currency: p.currency || "EUR" }).format(p.price);
  const caption =
    `${title} ✨\n${price} · Shop now at ${data.store}\n${p.url}\n\n` +
    `#cadenceandco ${HASHTAGS[category] || "#shopsmall"} #giftideas`;
  return { ...p, category, cleanTitle: title, priceText: price, caption };
}

// Very long marketplace titles are cut to ~60 characters at a word boundary.
function shorten(t, max = 62) {
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max)).replace(/[\s,;:&|/-]+$/, "") + "…";
}

// A packshot (product on a white or transparent background) is shown whole;
// lifestyle photos fill the card. Decided from the image's outer border.
function isPackshot(file) {
  const N = 24;
  try {
    const px = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${N}:${N}:flags=area`,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 20 });
    let light = 0, total = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (x > 1 && x < N - 2 && y > 1 && y < N - 2) continue;
        const i = (y * N + x) * 4;
        total++;
        if (px[i + 3] < 40 || (px[i] > 222 && px[i + 1] > 222 && px[i + 2] > 222)) light++;
      }
    }
    return light / total > 0.6;
  } catch {
    return false;
  }
}

function download(url) {
  const ext = (path.extname(new URL(url).pathname) || ".jpg").toLowerCase();
  const file = path.join(CACHE, createHash("sha1").update(url).digest("hex").slice(0, 16) + ext);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    execFileSync("curl", ["-sSfL", "--retry", "2", "--max-time", "60", "-o", file, url], { stdio: ["ignore", "ignore", "pipe"] });
  }
  return { src: pathToFileURL(file).href, fit: isPackshot(file) };
}

function placeholderImages() {
  const shapes = [
    ["#f6ecdc", "#e3cfab", '<circle cx="32" cy="38" r="16"/><path d="M24 14l8-8 8 8-8 8z"/>'],
    ["#f3e4e6", "#dcc0c8", '<path d="M10 8c0 22 10 34 22 34S54 30 54 8"/><path d="M32 42l-6 8 6 8 6-8z"/>'],
    ["#e8eee3", "#c9d6c0", '<circle cx="32" cy="10" r="4"/><path d="M32 14v8"/><circle cx="32" cy="38" r="14"/>'],
  ];
  return shapes.map(([a, b, d]) => ({ fit: false, src: "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 600"><defs><linearGradient id="g" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="460" height="600" fill="url(#g)"/><g fill="none" stroke="#a8834a" stroke-width="6" stroke-linecap="round" ` +
    `transform="translate(110 170) scale(3.75)">${d}</g></svg>`) }));
}

async function renderOne(page, cdp, p) {
  const images = args.placeholder ? placeholderImages() : p.images.flatMap((u) => {
    try { return [download(u)]; } catch (e) { console.warn(`  ! could not download ${u}`); return []; }
  });
  if (!images.length) throw new Error("no images could be downloaded");

  await page.goto(pathToFileURL(path.join(HERE, "reel.html")).href);
  await page.evaluate((d) => window.setupReel(d), {
    eyebrow: p.category,
    title: p.cleanTitle,
    price: p.priceText,
    footer: shopHost,
    images,
    seed: parseInt(createHash("md5").update(p.handle).digest("hex").slice(0, 8), 16),
  });
  const duration = await page.evaluate(() => window.REEL_DURATION);
  const frames = Math.round(duration * FPS);
  const mp4 = path.join(OUT, `${p.handle}.mp4`);

  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-map", "0:v", "-map", "1:a", "-shortest",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    mp4,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = once(ff, "close");

  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.renderFrame(tt), t);
    const { data: jpg } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    const buf = Buffer.from(jpg, "base64");
    if (i === Math.round(3.6 * FPS)) fs.writeFileSync(path.join(OUT, `${p.handle}.jpg`), buf);
    if (!ff.stdin.write(buf)) await once(ff.stdin, "drain");
  }
  ff.stdin.end();
  const [code] = await done;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  return mp4;
}

function csvCell(v) { return `"${String(v).replace(/"/g, '""')}"`; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });

  let list = data.products.map(prepare);
  if (args.only) {
    const wanted = new Set(String(args.only).split(","));
    list = list.filter((p) => wanted.has(p.handle));
  }
  if (args.limit) list = list.slice(0, Number(args.limit));
  const [shard, shards] = String(args.shard || "1/1").split("/").map(Number);
  list = list.filter((_, k) => k % shards === shard - 1);
  console.log(`Rendering ${list.length} reel(s) → ${OUT}`);

  const browser = await chromium.launch();
  const queue = [...list];
  const failed = [];
  let n = 0;

  async function worker() {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const cdp = await page.context().newCDPSession(page);
    while (queue.length) {
      const p = queue.shift();
      const started = Date.now();
      try {
        await renderOne(page, cdp, p);
        console.log(`  ✓ ${++n}/${list.length} ${p.handle} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      } catch (e) {
        failed.push(p.handle);
        console.log(`  ✗ ${p.handle}: ${e.message}`);
      }
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, worker));
  await browser.close();

  const rows = [["file", "cover", "title", "price", "url", "caption"].map(csvCell).join(",")];
  for (const p of list) {
    if (failed.includes(p.handle)) continue;
    rows.push([`${p.handle}.mp4`, `${p.handle}.jpg`, p.cleanTitle, p.priceText, p.url, p.caption].map(csvCell).join(","));
  }
  const csvName = shards > 1 ? `captions-${shard}.csv` : "captions.csv";
  fs.writeFileSync(path.join(OUT, csvName), "﻿" + rows.join("\n") + "\n");
  console.log(`Done: ${list.length - failed.length} rendered${failed.length ? `, ${failed.length} failed: ${failed.join(", ")}` : ""}.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
