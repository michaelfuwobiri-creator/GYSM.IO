// The GYSM Stream catalogue. Every film is free to stream AND to keep offline:
// Blender Foundation open movies (Creative Commons Attribution) and silent
// classics in the public domain worldwide. GYSM hosts the video files itself
// (MEDIA_BASE in config.js, filled by tools/mirror-films.mjs); a film appears
// once its files are published there. The licence and credit shown on each
// title come from that manifest (CC BY requires attribution).
//
// Licensed films from Filmhub are added at start-up from the feeds listed in
// config.js (see feeds.js and tools/filmhub-import.mjs).

export const COLLECTIONS = [
  { id: 'filmhub', title: 'More films' },
  { id: 'open', title: 'Blender open movies' },
  { id: 'classic', title: 'Classic cinema' },
  { id: 'short', title: 'Under 15 minutes' },
  { id: 'demo', title: 'Try offline viewing' },
];

export const TITLES = [
  {
    id: 'big-buck-bunny', title: 'Big Buck Bunny', year: 2008, minutes: 10, maturity: 'All',
    genres: ['Animation', 'Comedy'], collections: ['open', 'short'], featured: true, media: true,
    blurb: 'A giant, gentle rabbit is pushed too far by three bullying rodents and plans a cartoon revenge.',
  },
  {
    id: 'sintel', title: 'Sintel', year: 2010, minutes: 15, maturity: '12+',
    genres: ['Animation', 'Fantasy'], collections: ['open', 'short'], featured: true, media: true,
    blurb: 'A lone young woman crosses a harsh land to find the baby dragon she once rescued.',
  },
  {
    id: 'tears-of-steel', title: 'Tears of Steel', year: 2012, minutes: 12, maturity: '12+',
    genres: ['Sci-Fi', 'Action'], collections: ['open', 'short'], featured: true, media: true,
    blurb: 'In a future Amsterdam, scientists and warriors try to save the world from destructive robots.',
  },
  {
    id: 'cosmos-laundromat', title: 'Cosmos Laundromat', year: 2015, minutes: 12, maturity: '12+',
    genres: ['Animation', 'Drama'], collections: ['open', 'short'], featured: true, media: true,
    blurb: 'A suicidal sheep meets a salesman who offers him the gift of a lifetime.',
  },
  {
    id: 'elephants-dream', title: 'Elephants Dream', year: 2006, minutes: 11, maturity: '12+',
    genres: ['Animation', 'Surreal'], collections: ['open', 'short'], media: true,
    blurb: 'Two men explore an endless, strange machine; the first open movie ever made.',
  },
  {
    id: 'spring', title: 'Spring', year: 2019, minutes: 8, maturity: 'All',
    genres: ['Animation', 'Fantasy'], collections: ['open', 'short'], media: true,
    blurb: 'A shepherd girl and her dog face ancient spirits to keep the cycle of life going.',
  },
  {
    id: 'agent-327', title: 'Agent 327: Operation Barbershop', year: 2017, minutes: 4, maturity: 'All',
    genres: ['Animation', 'Action'], collections: ['open', 'short'], media: true,
    blurb: 'Undercover in a barbershop, Agent 327 fights a hired killer.',
  },
  {
    id: 'caminandes', title: 'Caminandes: Llama Drama', year: 2013, minutes: 2, maturity: 'All',
    genres: ['Animation', 'Comedy'], collections: ['open', 'short'], media: true,
    blurb: 'Koro the llama wants the grass on the other side of the road.',
  },
  {
    id: 'trip-to-the-moon', title: 'A Trip to the Moon', year: 1902, minutes: 13, maturity: 'All',
    genres: ['Sci-Fi', 'Silent'], collections: ['classic', 'short'], featured: true, media: true,
    blurb: 'Georges M\u00e9li\u00e8s sends astronomers to the Moon by cannon. Public domain.',
  },
  {
    id: 'nosferatu', title: 'Nosferatu', year: 1922, minutes: 94, maturity: '12+',
    genres: ['Horror', 'Silent'], collections: ['classic'], media: true,
    blurb: 'F. W. Murnau\u2019s silent vampire classic. Public domain.',
  },
  {
    id: 'demo-bars', title: 'Signal Test', year: 2026, minutes: 0.5, maturity: 'All',
    genres: ['Demo'], collections: ['demo'],
    blurb: 'A 30-second test clip bundled with the app. Use it to try downloads and offline playback.',
    local: { url: 'media/demo-bars.webm', poster: 'media/demo-bars.jpg', mime: 'video/webm', mp4: 'media/demo-bars.mp4', licence: 'CC0', artist: 'GYSM' },
  },
  {
    id: 'demo-fractal', title: 'Mandelbrot Drift', year: 2026, minutes: 0.5, maturity: 'All',
    genres: ['Demo'], collections: ['demo'],
    blurb: 'A 30-second fractal zoom bundled with the app.',
    local: { url: 'media/demo-fractal.webm', poster: 'media/demo-fractal.jpg', mime: 'video/webm', mp4: 'media/demo-fractal.mp4', licence: 'CC0', artist: 'GYSM' },
  },
  {
    id: 'demo-life', title: 'Game of Life', year: 2026, minutes: 0.5, maturity: 'All',
    genres: ['Demo'], collections: ['demo'],
    blurb: 'Thirty seconds of Conway’s Game of Life, bundled with the app.',
    local: { url: 'media/demo-life.webm', poster: 'media/demo-life.jpg', mime: 'video/webm', mp4: 'media/demo-life.mp4', licence: 'CC0', artist: 'GYSM' },
  },
];

export const byId = new Map(TITLES.map((t) => [t.id, t]));

// Licensed titles arrive from feeds (see feeds.js). Returns how many were new.
export function addTitles(list) {
  let added = 0;
  for (const t of list) {
    if (byId.has(t.id)) continue;
    TITLES.push(t);
    byId.set(t.id, t);
    added++;
  }
  return added;
}
