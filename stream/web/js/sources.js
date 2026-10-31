// Turns a catalogue entry into a playable URL, a poster and its licence.
//
// The app only plays films hosted by GYSM itself: the bundled demo clips,
// films in our own media storage (MEDIA_BASE, filled by
// tools/mirror-films.mjs), and licensed Filmhub titles from our feeds. It never
// searches or downloads from third-party sites.
//
// MEDIA_BASE/manifest.json lists which films are published, their video
// variants, licence and credit. The last copy is kept for offline use.

import { MEDIA_BASE } from './config.js';
import { load, save, settings } from './store.js';

let manifest = load('media-manifest', null);

export async function loadManifest() {
  if (!MEDIA_BASE) return null;
  try {
    const res = await fetch(MEDIA_BASE + 'manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.films) { manifest = data; save('media-manifest', data); }
    }
  } catch { /* offline: keep the saved copy */ }
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
  const base = MEDIA_BASE + title.id + '/';
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
