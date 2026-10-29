// Full-screen player driven by the remote.
// Select / Play-Pause toggles, Left / Right and Rewind / Fast-forward seek,
// Up / Down show the controls, Back saves the position and closes.
// A downloaded title plays from local storage; the bytes it would have
// streamed are added to the "data saved" total.

import { byId } from './catalog.js';
import { setProgress, progress, addSaved } from './store.js';
import { offlineUrl, records } from './downloads.js';
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
  const p = progress[id];
  video.addEventListener('loadedmetadata', function resume() {
    video.removeEventListener('loadedmetadata', resume);
    if (p && p.t && p.d && p.t / p.d < 0.95) video.currentTime = p.t;
  });
  video.play().catch(() => showOsd(true));
  clearInterval(saveTimer);
  saveTimer = setInterval(save, 5000);
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
  video.load();
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
    case 'up': case 'down': case 'menu': showOsd(); return true;
    case 'back': close(); return true;
  }
  return true;
}

