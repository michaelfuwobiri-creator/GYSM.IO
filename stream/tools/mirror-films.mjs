#!/usr/bin/env node
// Copies GYSM's free films into our own storage, so the app streams and saves
// them from GYSM's servers instead of a third-party site.
//
// Each film in mirror-films.json is fetched once from Wikimedia Commons,
// checked for a licence that allows redistribution (CC BY, CC BY-SA, CC0 or
// public domain; never NC or ND), converted to H.264 MP4 at the listed heights
// and given a poster. .github/workflows/mirror-films.yml runs this for every
// film and publishes the files as downloads of the repository's "films"
// release. File names are flat (<id>-480.mp4, <id>-poster.jpg) because
// release downloads have no folders.
//
//   node mirror-films.mjs list                       ids, as a JSON array
//   node mirror-films.mjs film <id> --out DIR        make DIR/<id>/{<id>-*.mp4,<id>-poster.jpg,<id>.meta.json}
//        [--from-file video] [--licence "CC0"]       use a local file (for testing)
//   node mirror-films.mjs manifest --in DIR --out F  merge every *.meta.json under DIR into the manifest
//
// Needs Node 18+ and ffmpeg/ffprobe on PATH.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const { films } = JSON.parse(fs.readFileSync(path.join(here, 'mirror-films.json'), 'utf8'));
const API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia asks automated clients to identify themselves.
const UA = 'GYSMStreamMirror/1.0 (https://github.com/michaelfuwobiri-creator/GYSM.IO)';
const MAXRATE = { 360: '800k', 480: '1400k', 720: '2800k', 1080: '5000k' };

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf('--' + name); return i >= 0 ? rest[i + 1] : undefined; };
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function run(bin, args) {
  const r = spawnSync(bin, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${bin} failed`);
  return r.stdout;
}

// Only licences that allow copying and format conversion.
export function licenceAllowed(name) {
  const n = String(name).toUpperCase();
  if (/\bNC\b|NON-?COMMERCIAL|\bND\b|NO ?DERIV/.test(n)) return false;
  return /CC[ -]?BY|CC0|PUBLIC DOMAIN|^PD\b|\bPD-/.test(n);
}

async function query(params) {
  const url = new URL(API);
  const base = {
    action: 'query', format: 'json', formatversion: '2',
    prop: 'videoinfo', viprop: 'url|size|mime|derivatives|extmetadata|metadata',
  };
  for (const [k, v] of Object.entries({ ...base, ...params })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Commons API ' + res.status);
  const data = await res.json();
  return (data.query && data.query.pages) || [];
}

const lengthOf = (info) => {
  const m = (info.metadata || []).find((x) => x.name === 'length' || x.name === 'playtime_seconds');
  return m ? Number(m.value) || 0 : 0;
};

// A hit must name the film and run close to its known length; otherwise a
// search can return a different video under the right title.
export function isRightFilm(film, pageTitle, seconds) {
  const name = String(pageTitle).toLowerCase();
  if (!(film.match || []).every((w) => name.includes(w.toLowerCase()))) return false;
  if (!seconds) return false;
  const expected = film.minutes * 60;
  return seconds >= expected * 0.6 && seconds <= expected * 1.6;
}

async function findOnCommons(film) {
  const exact = (await query({ titles: film.commons })).filter((p) => !p.missing && p.videoinfo);
  if (exact.length && isRightFilm(film, exact[0].title, lengthOf(exact[0].videoinfo[0]))) return exact[0];
  // Renamed file: the matching search hit closest to the expected length.
  const expected = film.minutes * 60;
  const hits = (await query({ generator: 'search', gsrnamespace: '6', gsrlimit: '10', gsrsearch: film.search + ' filetype:video' }))
    .filter((p) => p.videoinfo && isRightFilm(film, p.title, lengthOf(p.videoinfo[0])))
    .sort((a, b) => Math.abs(lengthOf(a.videoinfo[0]) - expected) - Math.abs(lengthOf(b.videoinfo[0]) - expected));
  return hits[0] || null;
}

// The smallest Commons transcode that is still at least as tall as our largest
// variant (saves downloading 4K masters), else the original file.
function pickSource(info, maxHeight) {
  const options = (info.derivatives || [])
    .filter((d) => /^video\//.test(d.type || ''))
    .map((d) => ({ url: d.src, height: Number(d.height) || parseInt(d.transcodekey, 10) || 0 }))
    .filter((d) => d.height >= maxHeight)
    .sort((a, b) => a.height - b.height);
  return options[0] ? options[0].url : info.url;
}

async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error('download ' + res.status);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
}

function probeSeconds(file) {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim()) || 0;
}

async function mirrorFilm(id) {
  const film = films.find((f) => f.id === id);
  if (!film) throw new Error('unknown film ' + id);
  const out = path.resolve(opt('out') || 'mirror-out', id);
  fs.mkdirSync(out, { recursive: true });

  let source = opt('from-file');
  let licence = opt('licence') || '';
  let credit = opt('credit') || '';
  let page = '';
  if (!source) {
    const hit = await findOnCommons(film);
    if (!hit) throw new Error(`${id}: no Commons video with the right name and length; left out`);
    const info = hit.videoinfo[0];
    const meta = info.extmetadata || {};
    licence = stripHtml(meta.LicenseShortName && meta.LicenseShortName.value);
    credit = film.credit || stripHtml(meta.Artist && meta.Artist.value).split(/[;(]/)[0].trim().slice(0, 120);
    page = info.descriptionurl || '';
    console.log(`${id}: ${hit.title} (${licence})`);
    if (!licenceAllowed(licence)) throw new Error(`${id}: licence "${licence}" does not allow redistribution`);
    source = path.join(out, 'source' + (path.extname(new URL(pickSource(info, Math.max(...film.heights))).pathname) || '.webm'));
    await download(pickSource(info, Math.max(...film.heights)), source);
  } else if (!licenceAllowed(licence)) {
    throw new Error(`${id}: pass --licence with a licence that allows redistribution`);
  }

  const seconds = probeSeconds(source);
  const videos = [];
  for (const h of film.heights) {
    const file = `${id}-${h}.mp4`;
    console.log(`${id}: encoding ${h}p`);
    run('ffmpeg', [
      '-y', '-v', 'error', '-i', source, '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', `scale=-2:'min(${h},ih)',format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
      '-preset', 'medium', '-crf', '23', '-maxrate', MAXRATE[h] || '2000k', '-bufsize', String(parseInt(MAXRATE[h] || '2000k', 10) * 2) + 'k',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', path.join(out, file),
    ]);
    videos.push({ height: h, file, size: fs.statSync(path.join(out, file)).size });
  }
  run('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(1, seconds * 0.1)), '-i', source,
    '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', path.join(out, `${id}-poster.jpg`)]);
  if (!opt('from-file')) fs.rmSync(source);

  const meta = { id, rev: film.rev || 1, mime: 'video/mp4', seconds: Math.round(seconds), videos, poster: `${id}-poster.jpg`, licence, credit, source: page };
  fs.writeFileSync(path.join(out, `${id}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`${id}: done, ${videos.map((v) => `${v.height}p ${(v.size / 1e6).toFixed(0)} MB`).join(', ')}`);
}

function buildManifest() {
  const dir = path.resolve(opt('in') || 'mirror-out');
  const result = { updated: new Date().toISOString(), films: {} };
  const wanted = new Map(films.map((f) => [f.id, f.rev || 1]));
  const metas = fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.meta.json'));
  for (const rel of metas) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
    // Only films still in the list, at their current revision, with an allowed licence.
    if (!wanted.has(m.id) || (m.rev || 1) !== wanted.get(m.id) || !licenceAllowed(m.licence)) continue;
    const { id: _, ...entry } = m;
    result.films[m.id] = entry;
  }
  fs.writeFileSync(path.resolve(opt('out') || 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`manifest: ${Object.keys(result.films).length} films`);
}

if (cmd === 'list') console.log(JSON.stringify(films.map((f) => f.id)));
else if (cmd === 'rev') console.log((films.find((f) => f.id === rest[0]) || {}).rev || 1);
else if (cmd === 'film') mirrorFilm(rest[0]).catch((e) => { console.error(e.message); process.exit(1); });
else if (cmd === 'manifest') buildManifest();
else { console.error('usage: mirror-films.mjs list | film <id> --out DIR | manifest --in DIR --out FILE'); process.exit(1); }
