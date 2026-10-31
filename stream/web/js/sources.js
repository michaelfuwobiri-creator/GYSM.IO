// Turns a catalogue entry into a playable URL, a poster and its licence.
//
// The app only plays films hosted by GYSM itself: the bundled demo clips,
// films in our own media storage (MEDIA_BASE, filled by
// tools/mirror-films.mjs), and licensed Filmhub titles from our feeds. It never
// searches or downloads from third-party sites.
//
// The media manifest lists which films are published, their video variants,
// licence and credit. The newest copy found is kept for offline use.

import { MEDIA_BASE, MEDIA_MANIFESTS } from './config.js';
import { load, save, settings } from './store.js';

let manifest = load('media-manifest', null);

const newer = (a, b) => !b || String(a.updated || '') > String(b.updated || '');

export async function loadManifest() {
  if (!MEDIA_BASE) return null;
  const embedded = (window.GYSM_EMBEDDED_FEEDS || {})['catalog/media-manifest.json'];
  if (embedded && embedded.films && newer(embedded, manifest)) manifest = embedded;
  for (const url of MEDIA_MANIFESTS) {
    if (location.protocol === 'file:' && !/^https:/.test(url)) continue; // embedded instead
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.films && newer(data, manifest)) manifest = data;
    } catch { /* offline or not published yet */ }
  }
  if (manifest) save('media-manifest', manifest);
  return manifest;
}

export function isPublished(title) {
  return !!(title.media && manifest && manifest.films && manifest.films[title.id]);
}

// The variant at or below the chosen quality, else the smallest one.
function pickVariant(videos) {
  const sorted = [...videos].sort((a, b) => b.height - a.height);
  return sorted.find((v) => v.height <= settings.quality) || sorted[sorted.length - 1];
}

function fromMedia(title) {
  const m = manifest.films[title.id];
  const base = MEDIA_BASE; // release downloads are flat: <id>-480.mp4, <id>-poster.jpg
  const v = pickVariant(m.videos);
  return {
    url: base + v.file,
    mime: m.mime || 'video/mp4',
    size: v.size || 0,
    poster: m.poster ? base + m.poster : '',
    captions: (m.captions || []).map((c) => ({ ...c, url: base + c.file })),
    licence: m.licence || 'Free licence',
    artist: m.credit || '',
  };
}

// Filmhub titles carry their own URLs (from the feed), so nothing to look up.
function fromFilmhub(title) {
  const f = title.filmhub;
  return {
    url: f.video.url,
    mime: f.video.mime,
    poster: f.backdrop || f.poster,
    captions: f.captions,
    licence: 'Licensed film',
    artist: title.studio,
  };
}

export function cachedSource(title) {
  if (title.local) return { ...title.local, sameOrigin: true };
  if (title.filmhub) return fromFilmhub(title);
  if (isPublished(title)) return fromMedia(title);
  return null;
}

export async function resolve(title) {
  return cachedSource(title);
}
