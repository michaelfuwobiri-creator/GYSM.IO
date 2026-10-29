// Every title here is free to stream AND to download: Blender Foundation open
// movies (Creative Commons Attribution) and films in the public domain.
// Video files come from Wikimedia Commons, which only hosts freely licensed
// media. `commons` is the exact file name we expect; `search` is the fallback
// query if the file was renamed. Licence and author are read from Commons at
// runtime and shown on the details screen (CC-BY requires attribution).
//
// Licensed films from Filmhub are added at start-up from the feeds listed in
// config.js (see feeds.js and tools/filmhub-import.mjs).

export const COLLECTIONS = [
  { id: 'filmhub', title: 'More films' },
  { id: 'open', title: 'Blender open movies' },
  { id: 'classic', title: 'Classic cinema' },
  { id: 'short', title: 'Under 15 minutes' },
  { id: 'demo', title: 'Demo clips (bundled, always downloadable)' },
];

export const TITLES = [
  {
    id: 'big-buck-bunny', title: 'Big Buck Bunny', year: 2008, minutes: 10, maturity: 'All',
    genres: ['Animation', 'Comedy'], collections: ['open', 'short'], featured: true,
    blurb: 'A giant, gentle rabbit is pushed too far by three bullying rodents and plans a cartoon revenge.',
    commons: 'File:Big Buck Bunny 4K.webm', search: 'Big Buck Bunny Blender',
  },
  {
    id: 'sintel', title: 'Sintel', year: 2010, minutes: 15, maturity: '12+',
    genres: ['Animation', 'Fantasy'], collections: ['open', 'short'], featured: true,
    blurb: 'A lone young woman crosses a harsh land to find the baby dragon she once rescued.',
    commons: 'File:Sintel movie 4K.webm', search: 'Sintel Blender open movie',
  },
  {
    id: 'tears-of-steel', title: 'Tears of Steel', year: 2012, minutes: 12, maturity: '12+',
    genres: ['Sci-Fi', 'Action'], collections: ['open', 'short'], featured: true,
    blurb: 'In a future Amsterdam, scientists and warriors try to save the world from destructive robots.',
    commons: 'File:Tears of Steel in 4k - Official Blender Foundation release.webm', search: 'Tears of Steel Blender',
  },
  {
    id: 'elephants-dream', title: 'Elephants Dream', year: 2006, minutes: 11, maturity: '12+',
    genres: ['Animation', 'Surreal'], collections: ['open', 'short'],
    blurb: 'Two men explore an endless, strange machine; the first open movie ever made.',
    commons: 'File:Elephants Dream (2006).webm', search: 'Elephants Dream 2006 Blender',
  },
  {
    id: 'cosmos-laundromat', title: 'Cosmos Laundromat', year: 2015, minutes: 12, maturity: '12+',
    genres: ['Animation', 'Drama'], collections: ['open', 'short'], featured: true,
    blurb: 'A suicidal sheep meets a salesman who offers him the gift of a lifetime.',
    commons: 'File:Cosmos Laundromat - First Cycle - Official Blender Foundation release.webm', search: 'Cosmos Laundromat Blender',
  },
  {
    id: 'spring', title: 'Spring', year: 2019, minutes: 8, maturity: 'All',
    genres: ['Animation', 'Fantasy'], collections: ['open', 'short'],
    blurb: 'A shepherd girl and her dog face ancient spirits to keep the cycle of life going.',
    commons: 'File:Spring - Blender Open Movie.webm', search: 'Spring Blender Open Movie',
  },
  {
    id: 'agent-327', title: 'Agent 327: Operation Barbershop', year: 2017, minutes: 4, maturity: 'All',
    genres: ['Animation', 'Action'], collections: ['open', 'short'],
    blurb: 'Undercover in a barbershop, Agent 327 fights a hired killer.',
    commons: 'File:Agent 327 Operation Barbershop.webm', search: 'Agent 327 Operation Barbershop',
  },
  {
    id: 'caminandes', title: 'Caminandes: Llama Drama', year: 2013, minutes: 2, maturity: 'All',
    genres: ['Animation', 'Comedy'], collections: ['open', 'short'],
    blurb: 'Koro the llama wants the grass on the other side of the road.',
    commons: 'File:Caminandes- Llama Drama - Short Movie.ogv', search: 'Caminandes Llama Drama',
  },
  {
    id: 'night-living-dead', title: 'Night of the Living Dead', year: 1968, minutes: 96, maturity: '16+',
    genres: ['Horror'], collections: ['classic'], featured: true,
    blurb: 'Strangers barricade themselves in a farmhouse as the dead rise. Public domain.',
    commons: 'File:Night of the Living Dead (1968).webm', search: 'Night of the Living Dead 1968 film',
  },
  {
    id: 'nosferatu', title: 'Nosferatu', year: 1922, minutes: 94, maturity: '12+',
    genres: ['Horror', 'Silent'], collections: ['classic'],
    blurb: 'F. W. Murnau’s silent vampire classic. Public domain.',
    commons: 'File:Nosferatu (1922).webm', search: 'Nosferatu 1922 Murnau film',
  },
  {
    id: 'the-general', title: 'The General', year: 1926, minutes: 78, maturity: 'All',
    genres: ['Comedy', 'Silent'], collections: ['classic'],
    blurb: 'Buster Keaton chases a stolen locomotive across Civil War lines. Public domain.',
    commons: 'File:The General (1926).webm', search: 'The General 1926 Buster Keaton',
  },
  {
    id: 'trip-to-the-moon', title: 'A Trip to the Moon', year: 1902, minutes: 13, maturity: 'All',
    genres: ['Sci-Fi', 'Silent'], collections: ['classic', 'short'],
    blurb: 'Georges Méliès sends astronomers to the Moon by cannon. Public domain.',
    commons: 'File:Le Voyage dans la lune.webm', search: 'A Trip to the Moon 1902 Melies',
  },
  {
    id: 'steamboat-willie', title: 'Steamboat Willie', year: 1928, minutes: 8, maturity: 'All',
    genres: ['Animation', 'Comedy'], collections: ['classic', 'short'],
    blurb: 'The 1928 cartoon, in the US public domain since 2024.',
    commons: 'File:Steamboat Willie (1928) by Walt Disney.webm', search: 'Steamboat Willie 1928',
  },
  {
    id: 'his-girl-friday', title: 'His Girl Friday', year: 1940, minutes: 92, maturity: 'All',
    genres: ['Comedy'], collections: ['classic'],
    blurb: 'A fast-talking editor tries to win back his star reporter and ex-wife. Public domain.',
    commons: 'File:His Girl Friday (1940) by Howard Hawks.webm', search: 'His Girl Friday 1940',
  },
  {
    id: 'charade', title: 'Charade', year: 1963, minutes: 113, maturity: '12+',
    genres: ['Thriller', 'Romance'], collections: ['classic'],
    blurb: 'Audrey Hepburn and Cary Grant in a Paris thriller about stolen gold. Public domain.',
    commons: 'File:Charade (1963).webm', search: 'Charade 1963 film Hepburn',
  },
  {
    id: 'carnival-of-souls', title: 'Carnival of Souls', year: 1962, minutes: 78, maturity: '12+',
    genres: ['Horror'], collections: ['classic'],
    blurb: 'After a car crash, a church organist is drawn to an abandoned pavilion. Public domain.',
    commons: 'File:Carnival of Souls (1962).webm', search: 'Carnival of Souls 1962',
  },
  {
    id: 'demo-bars', title: 'Signal Test', year: 2026, minutes: 0.5, maturity: 'All',
    genres: ['Demo'], collections: ['demo'],
    blurb: 'A 30-second test clip bundled with the app. Use it to try downloads and offline playback.',
    local: { url: 'media/demo-bars.webm', poster: 'media/demo-bars.jpg', mime: 'video/webm', licence: 'CC0', artist: 'GYSM' },
  },
  {
    id: 'demo-fractal', title: 'Mandelbrot Drift', year: 2026, minutes: 0.5, maturity: 'All',
    genres: ['Demo'], collections: ['demo'],
    blurb: 'A 30-second fractal zoom bundled with the app.',
    local: { url: 'media/demo-fractal.webm', poster: 'media/demo-fractal.jpg', mime: 'video/webm', licence: 'CC0', artist: 'GYSM' },
  },
  {
    id: 'demo-life', title: 'Game of Life', year: 2026, minutes: 0.5, maturity: 'All',
    genres: ['Demo'], collections: ['demo'],
    blurb: 'Thirty seconds of Conway’s Game of Life, bundled with the app.',
    local: { url: 'media/demo-life.webm', poster: 'media/demo-life.jpg', mime: 'video/webm', licence: 'CC0', artist: 'GYSM' },
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
