// Small persistent state: settings, My List, watch progress, data-saved stats.
// localStorage can throw (private mode, full disk), so every access is guarded.

const PREFIX = 'gysm:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export const GB = 1024 ** 3;

export const DEFAULT_SETTINGS = {
  autoDownload: true,     // the headline feature: download in the background
  unmeteredOnly: true,    // only on Wi-Fi / Ethernet, never on a metered link
  storageLimit: 2 * GB,   // Fire TV sticks have ~5 GB free, so stay modest
  keepCount: 5,           // how many titles smart downloads keep ready
  quality: 480,           // 360 data saver, 480 standard, 720 HD
  deleteWatched: true,    // remove an auto-download once it has been watched
  hideMature: false,      // hide 16+ titles
};

export const settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };
export function saveSettings() { save('settings', settings); }

export const myList = new Set(load('mylist', []));
export function toggleMyList(id) {
  if (myList.has(id)) myList.delete(id); else myList.add(id);
  save('mylist', [...myList]);
  return myList.has(id);
}

// progress[id] = { t: seconds watched, d: duration, at: timestamp }
export const progress = load('progress', {});
export function setProgress(id, t, d) {
  progress[id] = { t, d, at: Date.now() };
  save('progress', progress);
}
export function progressOf(id) {
  const p = progress[id];
  return p && p.d ? Math.min(1, p.t / p.d) : 0;
}
export function isFinished(id) { return progressOf(id) >= 0.95; }
export function isInProgress(id) {
  const f = progressOf(id);
  return f > 0.02 && f < 0.95;
}

// Bytes watched from local storage instead of the network.
export const stats = { savedBytes: 0, offlineSeconds: 0, ...load('stats', {}) };
export function addSaved(bytes, seconds) {
  stats.savedBytes += bytes;
  stats.offlineSeconds += seconds;
  save('stats', stats);
}

export function formatBytes(n) {
  if (!n) return '0 MB';
  if (n >= GB) return (n / GB).toFixed(n >= 10 * GB ? 0 : 1) + ' GB';
  return Math.max(1, Math.round(n / 1024 ** 2)) + ' MB';
}

export function formatMinutes(m) {
  if (m < 1) return Math.round(m * 60) + ' sec';
  if (m < 60) return Math.round(m) + ' min';
  return Math.floor(m / 60) + ' h ' + Math.round(m % 60) + ' min';
}

// Rough size before the real one is known, by quality (bits per second).
const BITRATE = { 360: 700e3, 480: 1.2e6, 720: 2.5e6 };
export function estimateBytes(title, quality = settings.quality) {
  return Math.round((title.minutes * 60 * (BITRATE[quality] || BITRATE[480])) / 8);
}
