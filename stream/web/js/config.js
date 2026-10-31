// Where GYSM hosts its own films: downloads of the "films" release in the
// GYSM.IO repository, published by .github/workflows/mirror-films.yml.
export const MEDIA_BASE = 'https://github.com/michaelfuwobiri-creator/GYSM.IO/releases/download/films/';

// The list of published films. The copy bundled in the app is used first (and
// offline); the live copy in the repository adds films without an app update.
export const MEDIA_MANIFESTS = [
  'catalog/media-manifest.json',
  'https://raw.githubusercontent.com/michaelfuwobiri-creator/GYSM.IO/claude/gifted-hawking-98io3u/stream/web/catalog/media-manifest.json',
];

// Extra catalogues loaded at start-up, in order. Each is a JSON file made by
// tools/filmhub-import.mjs. Bundled files ship inside the Fire TV app; add the
// URL where you publish the file to update films without an app update (a file
// on another domain must be served with CORS: Access-Control-Allow-Origin).
export const CATALOG_FEEDS = [
  'catalog/filmhub.json',
  // 'https://cdn.example.com/films/filmhub.json',
];
