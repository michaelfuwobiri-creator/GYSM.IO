// Full-screen player driven by the remote.
// Select / Play-Pause toggles, Left / Right and Rewind / Fast-forward seek,
// Up / Down show the controls, Back saves the position and closes.
// A downloaded title plays from local storage; the bytes it would have
// streamed are added to the "data saved" total.

import { byId } from './catalog.js';
import { setProgress, progress, addSaved } from './store.js';
import { offlineUrl, offlineCaptions, records } from './downloads.js';
import { resolve } from './sources.js';
import { keepScreenOn } from './platform.js';

const $ = (sel) => document.querySelector(sel);
let video;
let layer;
let title = null;
let offline = false;
let hideTimer = 0;
let saveTimer = 0;
let lastTime = 0;
let onClose = () => {};
let captionUrls = [];
let retried = false;
let lastSrc = '';

export function isOpen() { return !!title; }

export function init(closeHandler) {
  onClose = closeHandler;
  layer = $('#player');
  video = $('#video');
  video.addEventListener('timeupdate', tick);
  video.addEventListener('play', () => { keepScreenOn(true); showOsd(); });
  video.addEventListener('pause', () => { keepScreenOn(false); showOsd(true); });
  video.addEventListener('waiting', () => layer.classList.add('is-buffering'));
  video.addEventListener('playing', () => layer.classList.remove('is-buffering'));
  video.addEventListener('ended', () => { save(); close(); });
  video.addEventListener('error', () => {
    // Streaming links to our film storage are signed for a limited time; after
    // a long pause, ask for a fresh one once and carry on from the same spot.
    if (title && !offline && !retried && lastSrc) {
      retried = true;
      const at = lastTime;
      video.src = lastSrc;
      video.addEventListener('loadedmetadata', () => { video.currentTime = at; video.play().catch(() => {}); }, { once: true });
      return;
    }
    $('#osd-state').textContent = navigator.onLine ? 'This film could not be played.' : 'You are offline and this film is not downloaded.';
    showOsd(true);
  });
}

export async function open(id) {
  const t = byId.get(id);
  if (!t) return;
  title = t;
  lastTime = 0;
  layer.hidden = false;
  layer.classList.add('is-buffering');
  $('#osd-title').textContent = t.title;
  $('#osd-state').textContent = '';

  let src = await offlineUrl(id);
  offline = !!src;
  if (!src) {
    const s = await resolve(t);
    src = s && (s.sameOrigin ? new URL(s.url, location.href).href : s.url);
  }
  if (title !== t) return; // closed while loading
  $('#osd-mode').textContent = offline ? 'Playing offline · no data used' : 'Streaming';
  $('#osd-mode').classList.toggle('is-offline', offline);
  if (!src) {
    $('#osd-state').textContent = 'You are offline and this film is not downloaded.';
    layer.classList.remove('is-buffering');
    showOsd(true);
    return;
  }
  video.src = src;
  lastSrc = src;
  retried = false;
  await addCaptions(id, offline);
  if (title !== t) return;
  const p = progress[id];
  video.addEventListener('loadedmetadata', function resume() {
    video.removeEventListener('loadedmetadata', resume);
    if (p && p.t && p.d && p.t / p.d < 0.95) video.currentTime = p.t;
  });
  video.play().catch(() => showOsd(true));
  clearInterval(saveTimer);
  saveTimer = setInterval(save, 5000);
}

// Subtitles are loaded as Blob URLs (saved copies when offline), so the
// video element never needs CORS mode for them.
async function addCaptions(id, fromDownload) {
  const src = await resolve(byId.get(id));
  const list = (src && src.captions) || [];
  let urls = [];
  if (fromDownload) urls = await offlineCaptions(id);
  else {
    urls = await Promise.all(list.map((c) => fetch(c.url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null)));
  }
  captionUrls = urls.filter(Boolean);
  list.forEach((c, i) => {
    if (!urls[i]) return;
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.srclang = c.lang;
    track.label = c.label;
    track.src = urls[i];
    track.track.addEventListener('cuechange', drawCues);
    video.appendChild(track);
  });
  $('#osd-cc').hidden = !captionUrls.length;
}

// Subtitles are drawn in #subs rather than by the browser, so they can be
// large enough for a TV and move above the controls while those are shown.
// The selected track is 'hidden': it still reports cues, but draws nothing.
function drawCues() {
  const track = [...video.textTracks].find((t) => t.mode === 'hidden');
  const cues = track && track.activeCues ? [...track.activeCues] : [];
  $('#subs').textContent = cues.map((c) => (c.text || '').replace(/<[^>]*>/g, '')).join('\n');
}

function toggleCaptions() {
  const tracks = [...video.textTracks];
  if (!tracks.length) return showOsd();
  const on = tracks.findIndex((t) => t.mode === 'hidden');
  tracks.forEach((t) => { t.mode = 'disabled'; });
  const next = on + 1 < tracks.length ? on + 1 : -1; // cycle: off, track 1, track 2, ..., off
  if (next >= 0) tracks[next].mode = 'hidden';
  drawCues();
  $('#osd-cc').textContent = next >= 0 ? `Subtitles: ${tracks[next].label}` : 'Subtitles: off (Menu)';
  showOsd();
}

function save() {
  if (!title || !video.duration) return;
  setProgress(title.id, video.currentTime, video.duration);
}

export function close() {
  if (!title) return;
  save();
  clearInterval(saveTimer);
  video.pause();
  video.removeAttribute('src');
  video.querySelectorAll('track').forEach((tr) => tr.remove());
  $('#subs').textContent = '';
  video.load();
  captionUrls.forEach((u) => URL.revokeObjectURL(u)); // made for this playback only
  captionUrls = [];
  keepScreenOn(false);
  layer.hidden = true;
  const id = title.id;
  title = null;
  onClose(id);
}

export function pause() { if (title) video.pause(); }

function tick() {
  const t = video.currentTime;
  const delta = t - lastTime;
  lastTime = t;
  if (offline && delta > 0 && delta < 2 && video.duration) {
    const r = records[title.id];
    if (r && r.size) addSaved((r.size / video.duration) * delta, delta);
  }
  const d = video.duration || 0;
  $('#osd-bar').style.width = d ? (t / d) * 100 + '%' : '0';
  $('#osd-time').textContent = clock(t) + ' / ' + clock(d);
}

const clock = (s) => {
  if (!isFinite(s)) return '0:00';
  s = Math.floor(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function showOsd(stay) {
  layer.classList.add('show-osd');
  clearTimeout(hideTimer);
  if (!stay && !video.paused) hideTimer = setTimeout(() => layer.classList.remove('show-osd'), 4000);
}

function seek(by) {
  if (!video.duration) return;
  video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + by));
  showOsd();
}

// Returns true when the player consumed the action.
export function handle(action) {
  if (!title) return false;
  switch (action) {
    case 'select': case 'playpause':
      if (video.paused) video.play().catch(() => {}); else video.pause();
      return true;
    case 'play': video.play().catch(() => {}); return true;
    case 'pause': video.pause(); return true;
    case 'left': case 'rewind': seek(-10); return true;
    case 'right': case 'forward': seek(30); return true;
    case 'menu': toggleCaptions(); return true;
    case 'up': case 'down': showOsd(); return true;
    case 'back': close(); return true;
  }
  return true;
}

