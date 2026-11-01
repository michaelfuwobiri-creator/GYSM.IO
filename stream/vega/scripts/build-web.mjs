#!/usr/bin/env node
// Copies the GYSM web app (stream/web) into this Vega project's assets/web,
// which Vega packages at /pkg/assets/web. Pages loaded from local package
// files cannot use <script type="module">, so the app's modules are bundled
// into one classic script with esbuild.
//
//   npm install --save-dev esbuild      (once)
//   node scripts/build-web.mjs           (after every change in stream/web)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../web');
const out = path.resolve(process.argv[2] || path.join(here, '../assets/web'));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(web, 'js/app.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome87'],
  minify: true,
  outfile: path.join(out, 'app.js'),
  logLevel: 'warning',
});

for (const dir of ['css', 'img', 'media', 'catalog']) {
  fs.cpSync(path.join(web, dir), path.join(out, dir), { recursive: true });
}

// Same page, but with the bundled script and without the web-only manifest.
let html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const moduleTag = '<script type="module" src="js/app.js"></script>';
if (!html.includes(moduleTag)) throw new Error('index.html no longer has the module script tag; update build-web.mjs');
// Bundled feeds are embedded as a script, because local pages cannot fetch() them.
const feeds = {};
for (const f of fs.readdirSync(path.join(web, 'catalog')).filter((n) => n.endsWith('.json'))) {
  feeds['catalog/' + f] = JSON.parse(fs.readFileSync(path.join(web, 'catalog', f), 'utf8'));
}
fs.writeFileSync(path.join(out, 'feeds.js'), `window.GYSM_EMBEDDED_FEEDS = ${JSON.stringify(feeds)};\n`);
html = html.replace(moduleTag, '<script src="feeds.js"></script>\n  <script src="app.js"></script>');
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
fs.writeFileSync(path.join(out, 'index.html'), html);

const files = fs.readdirSync(out, { recursive: true }).filter((f) => fs.statSync(path.join(out, f)).isFile());
console.log(`GYSM web app copied to ${path.relative(process.cwd(), out) || '.'} (${files.length} files)`);
