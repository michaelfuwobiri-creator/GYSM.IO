// Loads licensed titles (Filmhub) from the feeds in config.js and adds them
// to the catalogue. The last good copy of each feed is kept, so the titles
// and their downloads still work offline. Titles outside their licence
// window are left out.

import { CATALOG_FEEDS } from './config.js';
import { addTitles } from './catalog.js';
import { load, save } from './store.js';

const MATURITY = new Set(['All', '12+', '16+']);

export function inWindow(t, now = Date.now()) {
  const l = (t.filmhub && t.filmhub.licence) || {};
  if (l.start && Date.parse(l.start) > now) return false;
  if (l.end && Date.parse(l.end) + 864e5 <= now) return false; // end date is inclusive
  return true;
}

function valid(t) {
  return t && typeof t.id === 'string' && typeof t.title === 'string'
    && t.filmhub && t.filmhub.video && typeof t.filmhub.video.url === 'string';
}

function normalise(t, feedUrl) {
  const base = new URL(feedUrl, location.href);
  const abs = (u) => (u ? new URL(u, base).href : '');
  const f = t.filmhub;
  return {
    id: t.id,
    title: t.title,
    year: Number(t.year) || '',
    minutes: Number(t.minutes) || 90,
    maturity: MATURITY.has(t.maturity) ? t.maturity : '16+',
    genres: Array.isArray(t.genres) ? t.genres.slice(0, 3) : [],
    collections: ['filmhub', ...(Array.isArray(t.collections) ? t.collections : [])],
    featured: !!t.featured,
    blurb: t.blurb || '',
    studio: t.studio || '',
    filmhub: {
      video: { url: abs(f.video.url), mime: f.video.mime || 'video/mp4' },
      poster: abs(f.poster),
      backdrop: abs(f.backdrop),
      captions: (f.captions || []).filter((c) => c && c.url).map((c) => ({ lang: c.lang || 'en', label: c.label || c.lang || 'Subtitles', url: abs(c.url) })),
      licence: {
        start: (f.licence && f.licence.start) || '',
        end: (f.licence && f.licence.end) || '',
        territories: (f.licence && f.licence.territories) || [],
        offline: !!(f.licence && f.licence.offline),
        offlineDays: Number(f.licence && f.licence.offlineDays) || 0,
      },
    },
  };
}

function addFeed(url, data) {
  const titles = (data && Array.isArray(data.titles) ? data.titles : []).filter(valid).map((t) => normalise(t, url));
  return addTitles(titles.filter((t) => inWindow(t)));
}

// Synchronous: the copies saved last time, so downloads resolve at start-up.
export function loadCachedFeeds() {
  let n = 0;
  // The Vega build embeds bundled feeds (pages loaded from local files cannot fetch them).
  const embedded = window.GYSM_EMBEDDED_FEEDS || {};
  for (const url of CATALOG_FEEDS) n += addFeed(url, embedded[url] || load('feed:' + url, null));
  return n;
}

// Fetch fresh copies; resolves with the number of titles added.
export async function refreshFeeds() {
  let n = 0;
  await Promise.all(CATALOG_FEEDS.map(async (url) => {
    if (location.protocol === 'file:' && !/^https:/.test(url)) return; // embedded instead
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return;
      const data = await res.json();
      save('feed:' + url, data);
      n += addFeed(url, data);
    } catch { /* offline or no such feed: keep the cached copy */ }
  }));
  return n;
}
