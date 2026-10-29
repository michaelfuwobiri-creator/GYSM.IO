// Extra catalogues loaded at start-up, in order. Each is a JSON file made by
// tools/filmhub-import.mjs. Bundled files ship inside the Fire TV app; add the
// URL where you publish the file to update films without an app update (a file
// on another domain must be served with CORS: Access-Control-Allow-Origin).
export const CATALOG_FEEDS = [
  'catalog/filmhub.json',
  // 'https://cdn.example.com/films/filmhub.json',
];
