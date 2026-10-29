// Turns a catalogue entry into a playable URL, a poster and its licence.
// Wikimedia Commons is queried through its public API (origin=* enables CORS,
// no key needed). Results are cached for a week so the catalogue still shows
// when the device is offline.

import { load, save, settings } from './store.js';

const API = 'https://commons.wikimedia.org/w/api.php';
const TTL = 7 * 24 * 3600 * 1000;
const cache = load('resolved', {});
const pending = new Map();

const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function canPlay(mime) {
  if (!mime) return true;
  try { return document.createElement('video').canPlayType(mime) !== ''; } catch { return true; }
}

function lengthOf(info) {
  const m = (info.metadata || []).find((x) => x.name === 'length' || x.name === 'playtime_seconds');
  return m ? Number(m.value) || 0 : 0;
}

// Best transcode at or below the chosen height, falling back to the original.
function pickStream(info, quality) {
  const options = (info.derivatives || [])
    .filter((d) => /^video\//.test(d.type || '') && canPlay(d.type))
    .map((d) => ({ url: d.src, mime: d.type, height: Number(d.height) || parseInt(d.transcodekey, 10) || 0 }))
    .filter((d) => d.height > 0);
  const atOrBelow = options.filter((d) => d.height <= quality).sort((a, b) => b.height - a.height);
  const above = options.filter((d) => d.height > quality).sort((a, b) => a.height - b.height);
  const best = atOrBelow[0] || above[0];
  if (best) return best;
  return canPlay(info.mime) ? { url: info.url, mime: info.mime, height: info.height || 0, size: info.size } : null;
}

async function query(params) {
  const url = new URL(API);
  const base = {
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    prop: 'videoinfo', viprop: 'url|size|mime|derivatives|extmetadata|metadata', viurlwidth: '1280',
  };
  for (const [k, v] of Object.entries({ ...base, ...params })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Commons ' + res.status);
  const data = await res.json();
  return (data.query && data.query.pages) || [];
}

function toResult(page, quality) {
  const info = page && page.videoinfo && page.videoinfo[0];
  if (!info) return null;
  const stream = pickStream(info, quality);
  if (!stream) return null;
  const meta = info.extmetadata || {};
  return {
    url: stream.url,
    mime: stream.mime,
    size: stream.size || 0,
    poster: info.thumburl || '',
    seconds: lengthOf(info),
    licence: stripHtml(meta.LicenseShortName && meta.LicenseShortName.value) || 'Free licence',
    artist: stripHtml(meta.Artist && meta.Artist.value).slice(0, 120),
    page: info.descriptionurl || '',
  };
}

async function resolveCommons(title, quality) {
  if (title.commons) {
    const [page] = await query({ titles: title.commons });
    const hit = page && !page.missing && toResult(page, quality);
    if (hit) return hit;
  }
  // The file may have been renamed: search Commons, keep the longest video
  // that is at least half the expected running time (skips trailers and clips).
  const pages = await query({
    generator: 'search', gsrnamespace: '6', gsrlimit: '6', gsrsearch: title.search + ' filetype:video',
  });
  const results = pages.map((p) => toResult(p, quality)).filter(Boolean);
  const want = title.minutes * 60 * 0.5;
  results.sort((a, b) => b.seconds - a.seconds);
  return results.find((r) => !r.seconds || r.seconds >= want) || null;
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
  const hit = cache[title.id + '@' + settings.quality] || cache[title.id + '@any'];
  return hit ? hit.value : null;
}

export async function resolve(title, { force = false } = {}) {
  if (title.local) return { ...title.local, sameOrigin: true };
  if (title.filmhub) return fromFilmhub(title);
  const key = title.id + '@' + settings.quality;
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.at < TTL) return hit.value;
  if (!navigator.onLine) return hit ? hit.value : null;
  if (pending.has(key)) return pending.get(key);
  const job = resolveCommons(title, settings.quality)
    .then((value) => {
      if (value) {
        cache[key] = { at: Date.now(), value };
        cache[title.id + '@any'] = { at: Date.now(), value };
        save('resolved', cache);
      }
      return value;
    })
    .catch(() => (hit ? hit.value : null))
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

// Resolve the whole catalogue a few at a time; `onEach` re-renders as titles arrive.
export async function resolveAll(titles, onEach) {
  const queue = titles.filter((t) => !t.local && !t.filmhub);
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      const r = await resolve(t);
      onEach(t, r);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
