// Where GYSM hosts its own films: the public address of the Cloudflare R2
// bucket filled by tools/mirror-films.mjs (ends with "/"), for example
// "https://pub-0123456789abcdef.r2.dev/". Empty = only the bundled demo clips.
// The bucket must allow CORS GET/HEAD with Range (the mirror workflow sets it).
export const MEDIA_BASE = '';

// Extra catalogues loaded at start-up, in order. Each is a JSON file made by
// tools/filmhub-import.mjs. Bundled files ship inside the Fire TV app; add the
// URL where you publish the file to update films without an app update (a file
// on another domain must be served with CORS: Access-Control-Allow-Origin).
export const CATALOG_FEEDS = [
  'catalog/filmhub.json',
  // 'https://cdn.example.com/films/filmhub.json',
];
