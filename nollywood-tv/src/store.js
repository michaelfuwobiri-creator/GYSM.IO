// Watch progress and My List, kept on the device.

const KEY = "nollywood.v1";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

const data = Object.assign({ list: [], progress: {} }, read());

export const inList = (id) => data.list.includes(id);

export function toggleList(id) {
  data.list = inList(id) ? data.list.filter((x) => x !== id) : [id, ...data.list];
  write(data);
  return inList(id);
}

export const myList = () => [...data.list];

// progress[id] = { t: seconds watched, d: duration, at: last watched }
export function saveProgress(id, t, d) {
  if (!d || !isFinite(d)) return;
  if (t / d > 0.95) delete data.progress[id];
  else if (t > 10) data.progress[id] = { t, d, at: Date.now() };
  write(data);
}

export const progressOf = (id) => data.progress[id] || null;

export const continueWatching = () =>
  Object.entries(data.progress).sort((a, b) => b[1].at - a[1].at).map(([id]) => id);
