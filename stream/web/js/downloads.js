// Offline downloads and the smart auto-download engine.
//
// Films are saved in Cache Storage in 4 MB pieces fetched with HTTP Range
// requests, so an interrupted download resumes where it stopped. For playback
// the pieces are joined into one Blob (no copy in memory: cached blobs are
// file-backed) and handed to <video> as an object URL.
//
// Smart downloads: when the network is unmetered and there is room under the
// storage limit, the engine keeps `keepCount` titles ready offline, picked
// from Continue Watching, then My List, then featured titles. A title that
// has been watched to the end is deleted and the next one is fetched.

import { TITLES, byId } from './catalog.js';
import {
  settings, load, save, myList, progress, isFinished, estimateBytes,
} from './store.js';
import { resolve } from './sources.js';
import { isMetered } from './platform.js';

const CACHE = 'gysm-films-v1';
const CHUNK = 4 * 1024 * 1024;
const MAX_TRIES = 5;

export const supported = typeof caches !== 'undefined' && window.isSecureContext;
export const records = load('downloads', {});
const blobUrls = new Map();
const posterUrls = new Map();
const listeners = new Set();
let active = null; // { id, controller }
let blocker = null; // why the queue is not moving: 'offline' | 'metered' | null
let retryTimer = 0;

// A download cut off by closing the app resumes on the next start.
for (const r of Object.values(records)) if (r.status === 'downloading') r.status = 'queued';

const persist = () => save('downloads', records);
const emit = (kind, id) => listeners.forEach((fn) => fn(kind, id));
const keyFor = (id, part) => new URL(`offline/${id}/${part}`, location.href).href;

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// Failed smart downloads stay out of sight; the user never asked for them.
export function isHiddenFailure(r) { return r && r.reason === 'auto' && r.status === 'error'; }
export function isDownloaded(id) { return records[id] && records[id].status === 'done'; }
export function status() { return { active: active && active.id, blocker }; }

export function usedBytes() {
  return Object.values(records).reduce((sum, r) => sum + (r.done || 0), 0);
}

function reservedBytes() {
  return Object.entries(records).reduce((sum, [id, r]) => {
    if (r.status === 'error') return sum;
    const t = byId.get(id);
    return sum + (r.size || (t ? estimateBytes(t) : 0));
  }, 0);
}

export function enqueue(id, reason = 'manual') {
  if (!supported) return;
  const r = records[id];
  if (r && r.status !== 'error') {
    if (reason === 'manual' && r.reason !== 'manual') { r.reason = 'manual'; persist(); emit('change', id); }
    return;
  }
  records[id] = { status: 'queued', reason, addedAt: Date.now(), done: 0, next: 0, tries: 0 };
  persist();
  emit('change', id);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  pump();
}

export async function remove(id) {
  if (active && active.id === id) active.controller.abort();
  delete records[id];
  persist();
  for (const map of [blobUrls, posterUrls]) {
    if (map.has(id)) { URL.revokeObjectURL(map.get(id)); map.delete(id); }
  }
  if (supported) {
    const cache = await caches.open(CACHE);
    const prefix = keyFor(id, '');
    for (const req of await cache.keys()) if (req.url.startsWith(prefix)) await cache.delete(req);
  }
  emit('change', id);
  plan();
}

// ---- the download queue -----------------------------------------------

function nextQueued() {
  const now = Date.now();
  return Object.entries(records)
    .filter(([, r]) => r.status === 'queued' && !(r.retryAt > now))
    .sort(([, a], [, b]) => (a.reason === b.reason ? a.addedAt - b.addedAt : a.reason === 'manual' ? -1 : 1))
    .map(([id]) => id)[0];
}

export function pump() {
  if (active || !supported) return;
  if (!navigator.onLine) return setBlocker('offline');
  if (settings.unmeteredOnly && isMetered()) return setBlocker('metered');
  setBlocker(null);
  const id = nextQueued();
  if (!id) return scheduleRetry();
  const controller = new AbortController();
  active = { id, controller };
  run(id, controller.signal)
    .catch((err) => {
      const r = records[id];
      if (!r) return;
      if (controller.signal.aborted) { r.status = 'queued'; return; }
      r.tries = (r.tries || 0) + 1;
      if (err.permanent || r.tries >= MAX_TRIES) {
        r.status = 'error';
        r.error = err.message;
      } else {
        r.status = 'queued';
        r.retryAt = Date.now() + 15000 * r.tries;
      }
    })
    .finally(() => {
      active = null;
      persist();
      emit('change', id);
      pump();
    });
}

function setBlocker(value) {
  if (blocker !== value) { blocker = value; emit('status'); }
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const waits = Object.values(records).filter((r) => r.status === 'queued' && r.retryAt).map((r) => r.retryAt);
  if (waits.length) retryTimer = setTimeout(pump, Math.max(1000, Math.min(...waits) - Date.now()));
}

class PermanentError extends Error {
  constructor(msg) { super(msg); this.permanent = true; }
}

async function run(id, signal) {
  const r = records[id];
  const title = byId.get(id);
  if (!r || !title) throw new PermanentError('Unknown title');
  r.status = 'downloading';
  r.retryAt = 0;
  emit('change', id);

  const src = await resolve(title);
  if (!src) throw new PermanentError('Not available right now');
  if (r.url && r.url !== src.url) { r.next = 0; r.done = 0; } // source changed: start over
  Object.assign(r, { url: src.url, mime: src.mime || 'video/webm', poster: src.poster });

  if (!r.size) {
    let head;
    try {
      head = await fetch(src.url, { method: 'HEAD', signal });
    } catch (e) {
      if (signal.aborted) throw e;
      throw new PermanentError('This source only allows streaming');
    }
    r.size = Number(head.headers.get('Content-Length')) || 0;
  }
  if (r.size && usedBytes() - r.done + r.size > settings.storageLimit) {
    if (r.reason === 'auto') { delete records[id]; return; }
    throw new PermanentError('Over your storage limit');
  }

  const cache = await caches.open(CACHE);
  if (!r.size) await fetchWhole(cache, id, r, signal);
  else {
    r.chunks = Math.ceil(r.size / CHUNK);
    for (let i = r.next || 0; i < r.chunks; i++) {
      const start = i * CHUNK;
      const end = Math.min(r.size, start + CHUNK) - 1;
      const res = await fetch(src.url, { headers: { Range: `bytes=${start}-${end}` }, signal });
      if (res.status === 200 && i === 0) { await fetchWhole(cache, id, r, signal, res); break; }
      if (res.status !== 206) throw new Error('HTTP ' + res.status);
      const buf = await res.arrayBuffer();
      if (buf.byteLength !== end - start + 1) throw new Error('Short read');
      await cache.put(keyFor(id, i), new Response(buf, { headers: { 'Content-Type': r.mime } }));
      r.next = i + 1;
      r.done = Math.min(r.size, (i + 1) * CHUNK);
      persist();
      emit('progress', id);
    }
  }

  try {
    if (r.poster) {
      const p = await fetch(r.poster, { signal });
      if (p.ok) await cache.put(keyFor(id, 'poster'), p);
    }
  } catch { /* poster is optional */ }

  r.status = 'done';
  r.tries = 0;
  r.completedAt = Date.now();
  emit('done', id);
}

// Servers without Range support (and the bundled demo files) arrive in one go.
async function fetchWhole(cache, id, r, signal, res) {
  res = res || (await fetch(r.url, { signal }));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = Number(res.headers.get('Content-Length')) || r.size || 0;
  const reader = res.body.getReader();
  const parts = [];
  let done = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    parts.push(value);
    done += value.byteLength;
    r.done = done;
    if (total) r.size = total;
    emit('progress', id);
  }
  r.size = done;
  r.chunks = 1;
  r.next = 1;
  await cache.put(keyFor(id, 0), new Response(new Blob(parts, { type: r.mime }), { headers: { 'Content-Type': r.mime } }));
}

// ---- playback from local storage --------------------------------------

export async function offlineUrl(id) {
  if (!isDownloaded(id)) return null;
  if (blobUrls.has(id)) return blobUrls.get(id);
  const r = records[id];
  const cache = await caches.open(CACHE);
  const parts = [];
  for (let i = 0; i < r.chunks; i++) {
    const res = await cache.match(keyFor(id, i));
    if (!res) { r.status = 'queued'; r.next = i; r.done = i * CHUNK; persist(); pump(); return null; }
    parts.push(await res.blob());
  }
  const url = URL.createObjectURL(new Blob(parts, { type: r.mime }));
  blobUrls.set(id, url);
  return url;
}

export function offlinePoster(id) { return posterUrls.get(id) || null; }

async function loadPosters() {
  if (!supported) return;
  const cache = await caches.open(CACHE);
  for (const id of Object.keys(records)) {
    if (!isDownloaded(id) || posterUrls.has(id)) continue;
    const res = await cache.match(keyFor(id, 'poster'));
    if (res) posterUrls.set(id, URL.createObjectURL(await res.blob()));
  }
  emit('posters');
}

// ---- smart auto-download ------------------------------------------------

function candidates() {
  const allowed = (t) => !(settings.hideMature && t.maturity === '16+') && !isFinished(t.id);
  const inProgress = Object.entries(progress)
    .filter(([id]) => byId.has(id))
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([id]) => byId.get(id));
  const list = [...myList].map((id) => byId.get(id)).filter(Boolean);
  const featured = TITLES.filter((t) => t.featured);
  const seen = new Set();
  return [...inProgress, ...list, ...featured]
    .filter((t) => allowed(t) && !seen.has(t.id) && seen.add(t.id));
}

export function plan() {
  if (!supported) return;
  // Free the space taken by finished auto-downloads.
  if (settings.deleteWatched) {
    for (const [id, r] of Object.entries(records)) {
      if (r.reason === 'auto' && r.status === 'done' && isFinished(id)) { remove(id); return; }
    }
  }
  // A smart download that failed is retried after a day, not every minute.
  for (const [id, r] of Object.entries(records)) {
    if (r.reason === 'auto' && r.status === 'error' && Date.now() - r.addedAt > 864e5) delete records[id];
  }
  if (settings.autoDownload) {
    let count = Object.values(records).filter((r) => r.reason === 'auto' && r.status !== 'error').length;
    let reserved = reservedBytes();
    for (const t of candidates()) {
      if (count >= settings.keepCount) break;
      if (records[t.id]) continue;
      const size = estimateBytes(t);
      if (reserved + size > settings.storageLimit) continue;
      enqueue(t.id, 'auto');
      count++;
      reserved += size;
    }
  } else {
    // Turning the feature off cancels auto-downloads that have not started.
    for (const [id, r] of Object.entries(records)) {
      if (r.reason === 'auto' && r.status === 'queued' && !r.done) delete records[id];
    }
    persist();
    emit('change');
  }
  pump();
}

export function start() {
  loadPosters();
  addEventListener('online', plan);
  addEventListener('offline', () => { if (active) active.controller.abort(); setBlocker('offline'); });
  if (navigator.connection) navigator.connection.addEventListener('change', plan);
  setInterval(plan, 60000);
  plan();
}
