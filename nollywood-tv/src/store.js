// Watch progress and My List, kept on the device.

const KEY = "nollywood.v1";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

const data = Object.assign({ list: [], progress: {} }, read());

// The backend registers hooks so changes are uploaded when the viewer is signed in.
let hooks = {};
export function setHooks(h) { hooks = h; }

export const inList = (id) => data.list.includes(id);

export function toggleList(id) {
  data.list = inList(id) ? data.list.filter((x) => x !== id) : [id, ...data.list];
  write(data);
  hooks.list?.(id, inList(id));
  return inList(id);
}

/**
 * Merges data from the server. Titles on the list are kept from both sides; for progress the
 * most recently watched copy wins. Returns what only the device had, so it can be uploaded.
 */
export function merge(remoteList, remoteProgress) {
  const newList = data.list.filter((id) => !remoteList.includes(id));
  const list = [...data.list, ...remoteList.filter((id) => !data.list.includes(id))];
  const newProgress = [];
  const progress = { ...remoteProgress };
  for (const [id, local] of Object.entries(data.progress)) {
    const remote = remoteProgress[id];
    if (!remote || local.at > remote.at) { progress[id] = local; newProgress.push([id, local]); }
  }
  const changed = JSON.stringify(list) !== JSON.stringify(data.list) || JSON.stringify(progress) !== JSON.stringify(data.progress);
  data.list = list;
  data.progress = progress;
  write(data);
  return { newList, newProgress, changed };
}

export const myList = () => [...data.list];

// progress[id] = { t: seconds watched, d: duration, at: last watched }
export function saveProgress(id, t, d) {
  if (!d || !isFinite(d)) return;
  if (t / d > 0.95) {
    if (!data.progress[id]) return;
    delete data.progress[id];
    hooks.progress?.(id, null);
  } else if (t > 10) {
    data.progress[id] = { t, d, at: Date.now() };
    hooks.progress?.(id, data.progress[id]);
  }
  write(data);
}

export const progressOf = (id) => data.progress[id] || null;

export const continueWatching = () =>
  Object.entries(data.progress).sort((a, b) => b[1].at - a[1].at).map(([id]) => id);
