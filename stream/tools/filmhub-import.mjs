#!/usr/bin/env node
// Turns Filmhub delivery packages into the app's catalogue feed.
//
// Filmhub delivers each licensed title as a package: the film, artwork,
// captions and a metadata file (CSV or YAML). This script reads one folder per
// title, copies or transcodes the media into --media-out (upload that folder
// to your server or CDN), and writes the feed the app loads (see
// web/js/config.js).
//
//   node tools/filmhub-import.mjs --in ./deliveries --base-url https://cdn.example.com/films/
//
// Options
//   --in DIR            folder of delivery packages, one sub-folder per title (required)
//   --out FILE          feed to write          (default: web/catalog/filmhub.json)
//   --media-out DIR     where media is copied  (default: stream/filmhub-media)
//   --base-url URL      public URL of --media-out; without it, URLs are relative to the feed
//   --mapping FILE      metadata column names  (default: tools/filmhub-mapping.json)
//   --transcode         convert the film to 720p H.264 MP4 for Fire TV (needs ffmpeg)
//   --allow-offline     your licence allows downloads (default: streaming only)
//   --offline-days N    delete downloads N days after they finish (0 = keep)
//   --replace           drop titles from the old feed that are not in --in
//
// Node 18 or newer, no packages needed.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = ['.mp4', '.m4v', '.mov', '.mxf', '.mkv', '.webm', '.avi', '.mpg', '.ts'];
const WEB_VIDEO = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const IMAGE = ['.jpg', '.jpeg', '.png', '.webp'];
const CAPTION = ['.srt', '.vtt', '.scc', '.stl', '.dfxp', '.ttml', '.xml'];
const META = ['.csv', '.yaml', '.yml', '.json'];

// ---- arguments --------------------------------------------------------------

function parseArgs(argv) {
  const flags = new Set(['transcode', 'allow-offline', 'replace', 'help']);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(.+)$/.exec(argv[i]);
    if (!m) throw new Error('Unexpected argument: ' + argv[i]);
    out[m[1]] = flags.has(m[1]) ? true : argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.in) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 23).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(args.help ? 0 : 1);
}
const inDir = path.resolve(args.in);
const outFile = path.resolve(args.out || path.join(here, '../web/catalog/filmhub.json'));
const mediaOut = path.resolve(args['media-out'] || path.join(here, '../filmhub-media'));
const baseUrl = args['base-url'] ? args['base-url'].replace(/\/?$/, '/') : '';
const mapping = JSON.parse(fs.readFileSync(args.mapping || path.join(here, 'filmhub-mapping.json'), 'utf8'));
const offlineDays = Number(args['offline-days'] || 0);

if (args.transcode && spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('--transcode needs ffmpeg on your PATH.');
  process.exit(1);
}

// ---- metadata parsing -------------------------------------------------------

const normKey = (k) => String(k).toLowerCase().replace(/[\s_\-.]+/g, '');

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

// Enough YAML for metadata files: nested maps (flattened to "parent child"
// keys), scalar values and "- item" lists. Not a general YAML parser.
function parseYaml(text) {
  const out = {};
  const stack = []; // [{ indent, key }]
  let listKey = null;
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#') || raw.trim() === '---') continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    const unquote = (v) => v.replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2').trim();
    if (line.startsWith('- ')) {
      if (listKey) (out[listKey] = Array.isArray(out[listKey]) ? out[listKey] : []).push(unquote(line.slice(2)));
      continue;
    }
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const key = [...stack.map((s) => s.key), m[1].trim()].join(' ');
    if (m[2] === '' || m[2] === '|' || m[2] === '>') { stack.push({ indent, key: m[1].trim() }); listKey = key; continue; }
    out[key] = unquote(m[2]);
    listKey = null;
  }
  return out;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? prefix + ' ' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else out[key] = v;
  }
  return out;
}

function readMetadata(file) {
  const text = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') return parseCsv(text)[0] || {};
  if (ext === '.json') { const j = JSON.parse(text); return flatten(Array.isArray(j) ? j[0] : j); }
  return parseYaml(text);
}

function getter(record) {
  const byNorm = new Map(Object.entries(record).map(([k, v]) => [normKey(k), v]));
  return (field) => {
    for (const name of mapping[field] || []) {
      const v = byNorm.get(normKey(name));
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };
}

// ---- field conversion -------------------------------------------------------

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;|/]/)).map((x) => String(x).trim()).filter(Boolean);

function minutes(v) {
  const s = String(v).trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const p = s.split(':').map(Number);
    const secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    return Math.round(secs / 60);
  }
  const n = parseFloat(s);
  if (!n) return 0;
  return /s(ec)?/i.test(s) || n > 400 ? Math.round(n / 60) : Math.round(n); // over 400 must be seconds
}

// Ratings to the app's three bands. Unknown or unrated counts as 16+, so the
// "Hide 16+ titles" setting errs on the safe side.
function maturity(v) {
  const r = String(v).toUpperCase().replace(/\s+/g, '');
  if (['G', 'U', 'TV-Y', 'TV-Y7', 'TV-G', 'ALL', '0', '6', 'FSK0', 'FSK6'].includes(r)) return 'All';
  if (['PG', 'PG-13', 'TV-PG', 'TV-14', '12', '12A', '13+', 'FSK12', '7', '10'].includes(r)) return '12+';
  return '16+';
}

const yes = (v) => /^(y|yes|true|1|allowed|allow|on)$/i.test(String(v).trim());
const isoDate = (v) => {
  const d = new Date(String(v).trim());
  return String(v).trim() && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
};

// ---- media ------------------------------------------------------------------

function filesIn(dir, depth = 2) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth > 1) out.push(...filesIn(p, depth - 1));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const ext = (f) => path.extname(f).toLowerCase();
const named = (files, value) => {
  if (!value) return null;
  const want = path.basename(String(value)).toLowerCase();
  return files.find((f) => path.basename(f).toLowerCase() === want) || null;
};

function pickImage(files, hint) {
  const images = files.filter((f) => IMAGE.includes(ext(f)));
  return images.find((f) => hint.test(path.basename(f))) || null;
}

function captionLang(file) {
  const m = /(?:^|[._\- ])(en|es|fr|de|it|pt|nl|ja|ko|zh|ar|hi|ru|pl|sv|tr|english|spanish|french|german)(?:[._\- ]|$)/i.exec(path.basename(file, ext(file)));
  const map = { english: 'en', spanish: 'es', french: 'fr', german: 'de' };
  const code = m ? (map[m[1].toLowerCase()] || m[1].toLowerCase()) : 'en';
  const label = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  return { lang: code, label };
}

function srtToVtt(text) {
  return 'WEBVTT\n\n' + text.replace(/^﻿/, '').replace(/\r/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2').trim() + '\n';
}

function publicUrl(id, file) {
  if (baseUrl) return baseUrl + id + '/' + file;
  return path.relative(path.dirname(outFile), path.join(mediaOut, id, file)).split(path.sep).join('/');
}

function importPackage(dir) {
  const files = filesIn(dir);
  const metaFile = files.find((f) => META.includes(ext(f)) && !CAPTION.includes(ext(f)));
  if (!metaFile) throw new Error('no metadata file (.csv, .yaml or .json)');
  const get = getter(readMetadata(metaFile));

  const title = String(get('title')).trim();
  if (!title) throw new Error(`no title found in ${path.basename(metaFile)}; check filmhub-mapping.json`);
  const id = 'fh-' + slug(get('id') || title);
  const dest = path.join(mediaOut, id);
  fs.mkdirSync(dest, { recursive: true });

  // The film: the named file, or else the largest video in the package.
  const videos = files.filter((f) => VIDEO.includes(ext(f)));
  const source = named(files, get('video')) || videos.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  if (!source) throw new Error('no video file');
  let videoFile;
  let mime;
  if (args.transcode) {
    videoFile = 'film-720p.mp4';
    mime = 'video/mp4';
    console.log(`  transcoding ${path.basename(source)} (this takes a while)`);
    const r = spawnSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-stats', '-i', source, '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
      '-preset', 'medium', '-crf', '22', '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', path.join(dest, videoFile),
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) throw new Error('ffmpeg failed');
  } else {
    mime = WEB_VIDEO[ext(source)];
    if (!mime) throw new Error(`${path.basename(source)} is not playable on Fire TV as delivered; run again with --transcode`);
    videoFile = 'film' + ext(source);
    fs.copyFileSync(source, path.join(dest, videoFile));
  }

  const copyImage = (file, name) => {
    if (!file) return '';
    const out = name + ext(file).replace('.jpeg', '.jpg');
    fs.copyFileSync(file, path.join(dest, out));
    return publicUrl(id, out);
  };
  const poster = copyImage(named(files, get('poster')) || pickImage(files, /poster|portrait|vertical|2x3|key.?art(?!.*land)/i), 'poster');
  const backdrop = copyImage(named(files, get('backdrop')) || pickImage(files, /landscape|horizontal|16x9|backdrop|banner|still|thumb/i), 'backdrop');

  const captionFiles = list(get('captions')).map((c) => named(files, c)).filter(Boolean);
  const captions = [];
  for (const file of captionFiles.length ? captionFiles : files.filter((f) => CAPTION.includes(ext(f)))) {
    const { lang, label } = captionLang(file);
    const out = `captions-${lang}${captions.some((c) => c.lang === lang) ? '-' + captions.length : ''}.vtt`;
    if (ext(file) === '.srt') fs.writeFileSync(path.join(dest, out), srtToVtt(fs.readFileSync(file, 'utf8')));
    else if (ext(file) === '.vtt') fs.copyFileSync(file, path.join(dest, out));
    else { console.warn(`  skipped ${path.basename(file)}: convert ${ext(file)} captions to .srt or .vtt first`); continue; }
    captions.push({ lang, label, url: publicUrl(id, out) });
  }

  const offlineValue = get('offline');
  const daysValue = Number(get('offlineDays'));
  const year = (String(get('year')).match(/\d{4}/) || [''])[0];
  return {
    id,
    title,
    year: Number(year) || '',
    minutes: minutes(get('runtime')) || 90,
    maturity: maturity(get('rating')),
    genres: list(get('genres')).slice(0, 3),
    blurb: String(get('synopsis')).trim().slice(0, 300),
    studio: String(get('studio')).trim(),
    filmhub: {
      video: { url: publicUrl(id, videoFile), mime },
      poster,
      backdrop,
      captions,
      licence: {
        start: isoDate(get('licenceStart')),
        end: isoDate(get('licenceEnd')),
        territories: list(get('territories')),
        offline: offlineValue === '' ? !!args['allow-offline'] : yes(offlineValue),
        offlineDays: Number.isFinite(daysValue) && daysValue > 0 ? daysValue : offlineDays,
      },
    },
  };
}

// ---- run --------------------------------------------------------------------

const hasMeta = (d) => fs.readdirSync(d).some((f) => META.includes(ext(f)));
const packages = hasMeta(inDir)
  ? [inDir]
  : fs.readdirSync(inDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => path.join(inDir, e.name));

const imported = [];
let failed = 0;
for (const dir of packages) {
  try {
    const t = importPackage(dir);
    imported.push(t);
    const l = t.filmhub.licence;
    console.log(`✓ ${t.title} (${t.id}) ${l.offline ? 'downloads allowed' + (l.offlineDays ? ` for ${l.offlineDays} days` : '') : 'streaming only'}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${path.basename(dir)}: ${e.message}`);
  }
}

let previous = [];
if (!args.replace && fs.existsSync(outFile)) {
  try { previous = JSON.parse(fs.readFileSync(outFile, 'utf8')).titles || []; } catch { /* start fresh */ }
}
const byId = new Map(previous.map((t) => [t.id, t]));
for (const t of imported) byId.set(t.id, t);
const titles = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ source: 'filmhub', updated: new Date().toISOString(), titles }, null, 2) + '\n');
console.log(`\n${imported.length} imported, ${failed} failed, ${titles.length} titles in ${path.relative(process.cwd(), outFile)}`);
if (imported.length) console.log(`Upload ${path.relative(process.cwd(), mediaOut)}/ to ${baseUrl || 'the same server as the feed'} (with CORS and Range requests enabled).`);
process.exit(failed && !imported.length ? 1 : 0);
