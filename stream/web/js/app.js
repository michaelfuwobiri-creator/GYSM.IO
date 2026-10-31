import { TITLES, COLLECTIONS, byId } from './catalog.js';
import {
  settings, saveSettings, myList, toggleMyList, progressOf, isInProgress, stats,
  formatBytes, formatMinutes, estimateBytes, GB, progress,
} from './store.js';
import { resolve, cachedSource, loadManifest } from './sources.js';
import * as dl from './downloads.js';
import * as focus from './focus.js';
import * as player from './player.js';
import { actionForKey, exitApp, isFireTV } from './platform.js';
import { loadCachedFeeds, refreshFeeds } from './feeds.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const state = {
  page: 'home',
  heroId: null,
  detailsId: null,
  online: navigator.onLine,
};

// ---- helpers -------------------------------------------------------------

// The bundled demo clips only show while no real film is available (first
// start with no connection), so the store build never looks like test content.
function hasRealFilms() {
  return TITLES.some((t) => !t.local && cachedSource(t));
}

// Our own films appear once their files are published in our media storage.
function available(t) {
  return t.local || t.filmhub || cachedSource(t) || dl.isDownloaded(t.id);
}

function visibleTitles() {
  const showDemos = !hasRealFilms();
  return TITLES.filter((t) => !(settings.hideMature && t.maturity === '16+') && available(t)
    && (showDemos || !t.local || dl.isDownloaded(t.id)));
}

function posterOf(t) {
  return dl.offlinePoster(t.id) || (t.local && t.local.poster) || (cachedSource(t) || {}).poster || '';
}

function playable(t) { return dl.isDownloaded(t.id) || state.online || (t.local && dl.localPackage); }

function art(t, cls = '') {
  const src = posterOf(t);
  const hue = [...t.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return `<div class="art ${cls}" style="--hue:${hue}">
    <span class="art__fallback">${esc(t.title)}</span>
    ${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
  </div>`;
}

function dlBadge(id) {
  const r = dl.records[id];
  if (!r || dl.isHiddenFailure(r)) return '';
  if (r.status === 'done') return '<span class="badge badge--ok">✓ Offline</span>';
  if (r.status === 'error') return '<span class="badge badge--err">Download failed</span>';
  const pct = r.size ? Math.floor((r.done / r.size) * 100) : 0;
  return `<span class="badge" data-pct-for="${id}">${r.status === 'downloading' ? pct + '%' : 'Queued'}</span>`;
}

function dlBar(id) {
  const r = dl.records[id];
  if (!r || r.status === 'done' || r.status === 'error') return '';
  const pct = r.size ? (r.done / r.size) * 100 : 0;
  return `<div class="dlbar"><i data-bar-for="${id}" style="width:${pct}%"></i></div>`;
}

function card(t, rowId) {
  const watched = progressOf(t.id);
  return `<button class="card focusable ${playable(t) ? '' : 'is-unavailable'}" data-key="card:${rowId}:${t.id}" data-id="${t.id}" data-act="details">
    ${art(t)}
    <div class="card__badges">${dlBadge(t.id)}</div>
    ${dlBar(t.id)}
    ${watched > 0.02 ? `<div class="watchbar"><i style="width:${watched * 100}%"></i></div>` : ''}
    <div class="card__label">${esc(t.title)}</div>
  </button>`;
}

function row(id, label, titles) {
  if (!titles.length) return '';
  return `<section class="row" data-row="${id}">
    <h2 class="row__title">${esc(label)}</h2>
    <div class="row__viewport"><div class="row__track">${titles.map((t) => card(t, id)).join('')}</div></div>
  </section>`;
}

function metaLine(t) {
  const parts = [t.year, formatMinutes(t.minutes), t.genres.join(' · ')];
  return `<span class="maturity">${esc(t.maturity)}</span> ${parts.map(esc).join(' · ')}`;
}

function dlButtonLabel(id) {
  const r = dl.records[id];
  if (!dl.supported) return 'Downloads not supported';
  if (byId.get(id)?.local && dl.localPackage) return 'Included in the app';
  if (!dl.canDownload(id) && !r) return 'Streaming only';
  if (!r || r.status === 'error') return r ? 'Retry download' : 'Download';
  if (r.status === 'done') return 'Delete download';
  return 'Cancel download';
}

// ---- pages ---------------------------------------------------------------

function heroHtml() {
  const list = visibleTitles();
  const t = list.find((x) => x.id === state.heroId && playable(x))
    || list.find((x) => x.featured && playable(x)) || list.find(playable) || list[0];
  if (!t) return '';
  state.heroId = t.id;
  const resume = isInProgress(t.id);
  return `<section class="hero" data-top>
    <div class="hero__art">${art(t, 'art--hero')}</div>
    <div class="hero__body">
      <h1 class="hero__title" id="hero-title">${esc(t.title)}</h1>
      <p class="hero__meta" id="hero-meta">${metaLine(t)}</p>
      <p class="hero__blurb" id="hero-blurb">${esc(t.blurb)}</p>
      <div class="actions">
        <button class="btn btn--primary focusable" data-key="hero:play" data-act="play" data-hero data-autofocus>▶ ${resume ? 'Resume' : 'Play'}</button>
        <button class="btn focusable" data-key="hero:info" data-act="details" data-hero>More info</button>
      </div>
    </div>
  </section>`;
}

function homeHtml() {
  const list = visibleTitles();
  const continueWatching = Object.entries(progress)
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([id]) => list.find((t) => t.id === id))
    .filter((t) => t && isInProgress(t.id));
  const offline = list.filter((t) => dl.isDownloaded(t.id));
  const mine = [...myList].map((id) => list.find((t) => t.id === id)).filter(Boolean);
  const offlineNotice = state.online ? '' : `<p class="notice">You are offline. ${offline.length ? 'Your downloads are ready to play.' : 'Nothing is downloaded yet.'}</p>`;
  return heroHtml() + offlineNotice
    + row('offline', state.online ? 'Ready offline' : 'Your downloads', offline)
    + row('continue', 'Continue watching', continueWatching)
    + row('mylist', 'My List', mine)
    + COLLECTIONS.map((c) => row(c.id, c.title, list.filter((t) => t.collections.includes(c.id)))).join('');
}

function myListHtml() {
  const mine = [...myList].map((id) => byId.get(id)).filter(Boolean);
  if (!mine.length) {
    return `<div class="empty"><h1>My List</h1><p>Press <b>Menu</b> on any title to add it here. Smart downloads saves titles from My List for offline viewing.</p></div>`;
  }
  return `<div class="page-head"><h1>My List</h1></div><div class="grid">${mine.map((t) => card(t, 'grid')).join('')}</div>`;
}

function blockerText() {
  const s = dl.status();
  if (!dl.supported) return 'Downloads need a secure (https) connection on this device.';
  if (!settings.autoDownload) return 'Smart downloads is off.';
  if (s.blocker === 'offline') return 'Waiting for an internet connection.';
  if (s.blocker === 'metered') return 'Waiting for Wi-Fi or Ethernet (metered network).';
  if (s.active) return `Downloading ${esc(byId.get(s.active)?.title)}…`;
  return 'Up to date. New titles download automatically.';
}

function downloadsHtml() {
  const used = dl.usedBytes();
  const pct = Math.min(100, (used / settings.storageLimit) * 100);
  const entries = Object.entries(dl.records)
    .map(([id, r]) => [byId.get(id), r])
    .filter(([t, r]) => t && !dl.isHiddenFailure(r))
    .sort(([, a], [, b]) => (b.completedAt || b.addedAt) - (a.completedAt || a.addedAt));
  const items = entries.map(([t, r]) => {
    const size = r.size || estimateBytes(t);
    const expiry = expiryText(t.id);
    const line = r.status === 'done' ? `${formatBytes(size)} · ${r.reason === 'auto' ? 'Smart download' : 'Downloaded by you'}${expiry ? ' · ' + expiry : ''}`
      : r.status === 'error' ? esc(r.error || 'Failed')
        : `<span data-text-for="${t.id}">${formatBytes(r.done)} of ${formatBytes(size)}</span> · ${r.status === 'downloading' ? 'Downloading' : 'Queued'}`;
    return `<div class="dl" data-row="dl-${t.id}">
      ${art(t, 'art--thumb')}
      <div class="dl__body"><h3>${esc(t.title)}</h3><p>${line}</p>${dlBar(t.id)}</div>
      <button class="btn focusable" data-key="dl:play:${t.id}" data-id="${t.id}" data-act="play" ${playable(t) ? '' : 'disabled'}>▶ Play</button>
      <button class="btn focusable" data-key="dl:del:${t.id}" data-id="${t.id}" data-act="dl">${r.status === 'done' ? 'Delete' : r.status === 'error' ? 'Retry' : 'Cancel'}</button>
    </div>`;
  }).join('');
  return `<div class="page-head"><h1>Downloads</h1></div>
    <div class="tiles">
      <div class="tile"><span class="tile__label">Storage used</span><span class="tile__value">${formatBytes(used)}</span>
        <span class="tile__sub">of your ${formatBytes(settings.storageLimit)} limit</span><div class="meter"><i style="width:${pct}%"></i></div></div>
      <div class="tile"><span class="tile__label">Data saved</span><span class="tile__value">${formatBytes(stats.savedBytes)}</span>
        <span class="tile__sub">${formatMinutes(stats.offlineSeconds / 60)} watched offline</span></div>
      <div class="tile tile--wide"><span class="tile__label">Smart downloads</span><span class="tile__status" id="dl-status">${blockerText()}</span>
        <span class="tile__sub">Keeps ${settings.keepCount} titles ready from Continue Watching, My List and top picks.</span></div>
    </div>
    ${items || '<div class="empty"><p>No downloads yet. Smart downloads will start on the next unmetered connection, or choose Download on any title.</p></div>'}`;
}

const SETTINGS = [
  { key: 'autoDownload', label: 'Smart downloads', help: 'Download titles in the background so they are ready offline.', values: [true, false] },
  { key: 'unmeteredOnly', label: 'Download on unmetered networks only', help: 'Never download on a metered or mobile hotspot connection.', values: [true, false] },
  { key: 'storageLimit', label: 'Storage limit', help: 'The most space downloads may use on this device.', values: [0.5, 1, 2, 4, 8].map((g) => g * GB), show: formatBytes },
  { key: 'keepCount', label: 'Titles to keep ready', help: 'How many titles smart downloads keeps offline.', values: [3, 5, 10], show: (v) => v + ' titles' },
  { key: 'quality', label: 'Download quality', help: 'Lower quality uses less data and storage.', values: [360, 480, 720], show: (v) => ({ 360: 'Data saver (360p)', 480: 'Standard (480p)', 720: 'HD (720p)' })[v] },
  { key: 'deleteWatched', label: 'Delete smart downloads after watching', help: 'Frees the space for the next title.', values: [true, false] },
  { key: 'hideMature', label: 'Hide 16+ titles', help: 'Hides titles rated 16+ and stops downloading them.', values: [false, true] },
];

function settingsHtml() {
  return `<div class="page-head"><h1>Settings</h1></div><div class="settings">
  <div class="setting setting--info">
    <span class="setting__text"><span class="setting__label">Account</span>
      <span class="setting__help">Not needed. GYSM Stream has no sign-in, no sign-up and no payments. Everything works straight away.</span></span>
    <span class="setting__value">None required</span>
  </div>${SETTINGS.map((s) => {
    const v = settings[s.key];
    const shown = s.show ? s.show(v) : v ? 'On' : 'Off';
    return `<button class="setting focusable" data-key="set:${s.key}" data-act="setting" data-setting="${s.key}">
      <span class="setting__text"><span class="setting__label">${esc(s.label)}</span><span class="setting__help">${esc(s.help)}</span></span>
      <span class="setting__value ${v === true ? 'is-on' : ''}">${esc(shown)}</span>
    </button>`;
  }).join('')}
  <p class="legal">All films are hosted by GYSM. They are Blender Foundation open movies under Creative Commons Attribution and silent classics in the public domain, which their licences allow us to stream and to save for offline viewing inside this app. Saved films can only be played in GYSM Stream. The licence and credit are shown on each title.</p></div>`;
}

function expiryText(id) {
  const at = dl.expiresAt(id);
  if (!at) return '';
  const days = Math.max(0, Math.ceil((at - Date.now()) / 864e5));
  return days <= 1 ? 'Expires today' : `Expires in ${days} days`;
}

function licenceText(t, src) {
  if (t.filmhub) {
    const l = t.filmhub.licence;
    const parts = ['Licensed film'];
    if (t.studio) parts.push(t.studio);
    if (!l.offline) parts.push('streaming only under its licence');
    else if (l.offlineDays) parts.push(`downloads are kept for ${l.offlineDays} days`);
    return parts.join(' · ');
  }
  const licence = src.licence || (t.local ? t.local.licence : 'Free licence');
  const artist = src.artist || (t.local && t.local.artist);
  return licence + (artist ? ' · ' + artist : '');
}

function detailsHtml(t) {
  const src = cachedSource(t) || {};
  const r = dl.records[t.id];
  const resume = isInProgress(t.id);
  const size = (r && r.size) || estimateBytes(t);
  const expiry = expiryText(t.id);
  const dlLine = !dl.canDownload(t.id) && !(r && r.status === 'done') ? 'Available to stream'
    : r && r.status === 'done' ? `Saved on this device · ${formatBytes(size)}${expiry ? ' · ' + expiry : ''}`
    : r && r.status !== 'error' ? `<span data-text-for="${t.id}">${formatBytes(r.done)} of ${formatBytes(size)}</span> downloaded`
      : `About ${formatBytes(size)} to download`;
  return `<div class="details__art">${art(t, 'art--hero')}</div>
    <div class="details__body">
      <button class="btn focusable pointer-only details__back" data-key="d:back" data-act="back">&#8249; Back</button>
      <h1>${esc(t.title)}</h1>
      <p class="hero__meta">${metaLine(t)}</p>
      <p class="hero__blurb">${esc(t.blurb)}</p>
      <div class="actions">
        <button class="btn btn--primary focusable" data-key="d:play" data-id="${t.id}" data-act="play" data-autofocus ${playable(t) ? '' : 'disabled'}>▶ ${resume ? 'Resume' : 'Play'}</button>
        ${resume ? `<button class="btn focusable" data-key="d:restart" data-id="${t.id}" data-act="restart">Start over</button>` : ''}
        <button class="btn focusable" data-key="d:dl" data-id="${t.id}" data-act="dl" ${dl.canDownload(t.id) || dl.records[t.id] ? '' : 'disabled'}>${dlButtonLabel(t.id)}</button>
        <button class="btn focusable" data-key="d:list" data-id="${t.id}" data-act="list">${myList.has(t.id) ? '✓ In My List' : '+ My List'}</button>
      </div>
      <div class="details__dl">${dlLine}${dlBar(t.id)}</div>
      <p class="details__licence">${esc(licenceText(t, src))}</p>
      ${playable(t) ? '' : '<p class="notice">Connect to the internet to watch, or download this title next time you are online.</p>'}
    </div>`;
}

// ---- rendering -----------------------------------------------------------

const PAGES = { home: homeHtml, mylist: myListHtml, downloads: downloadsHtml, settings: settingsHtml };
let renderQueued = false;

function render() {
  const focused = document.activeElement && document.activeElement.dataset.key;
  const scroller = $('#page');
  const top = scroller.scrollTop;
  const mems = {};
  scroller.querySelectorAll('[data-row]').forEach((r) => { if (r.dataset.mem) mems[r.dataset.row] = r.dataset.mem; });

  scroller.innerHTML = PAGES[state.page]();
  scroller.scrollTop = top;
  scroller.querySelectorAll('[data-row]').forEach((r) => { if (mems[r.dataset.row]) r.dataset.mem = mems[r.dataset.row]; });
  document.querySelectorAll('.nav .tab').forEach((b) => b.classList.toggle('is-active', b.dataset.page === state.page));
  if (state.detailsId) $('#details').innerHTML = detailsHtml(byId.get(state.detailsId));
  renderStatus();
  if (!player.isOpen()) focus.restore(focused);
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function renderStatus() {
  const pill = $('#status');
  const s = dl.status();
  const ready = Object.values(dl.records).filter((r) => r.status === 'done').length;
  let text;
  let cls = '';
  if (!state.online) { text = `Offline · ${ready} ready`; cls = 'is-offline'; }
  else if (s.active) {
    const r = dl.records[s.active];
    text = `↓ ${byId.get(s.active)?.title ?? ''} ${r && r.size ? Math.floor((r.done / r.size) * 100) + '%' : ''}`;
    cls = 'is-busy';
  } else if (s.blocker === 'metered') text = 'Downloads wait for Wi-Fi';
  else text = `${ready} ready offline`;
  pill.textContent = text;
  pill.className = 'status ' + cls;
}

function updateProgress(id) {
  const r = dl.records[id];
  if (!r) return;
  const size = r.size || estimateBytes(byId.get(id));
  const pct = size ? (r.done / size) * 100 : 0;
  document.querySelectorAll(`[data-bar-for="${id}"]`).forEach((el) => { el.style.width = pct + '%'; });
  document.querySelectorAll(`[data-pct-for="${id}"]`).forEach((el) => { el.textContent = Math.floor(pct) + '%'; });
  document.querySelectorAll(`[data-text-for="${id}"]`).forEach((el) => { el.textContent = `${formatBytes(r.done)} of ${formatBytes(size)}`; });
  renderStatus();
}

let heroTimer = 0;
function updateHero(id) {
  if (state.page !== 'home' || id === state.heroId) return;
  clearTimeout(heroTimer);
  heroTimer = setTimeout(() => {
    const t = byId.get(id);
    const hero = $('.hero');
    if (!t || !hero) return;
    state.heroId = id;
    $('.hero__art', hero).innerHTML = art(t, 'art--hero');
    $('#hero-title').textContent = t.title;
    $('#hero-meta').innerHTML = metaLine(t);
    $('#hero-blurb').textContent = t.blurb;
    $('[data-key="hero:play"]').textContent = (isInProgress(t.id) ? '▶ Resume' : '▶ Play');
  }, 180);
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3500);
}

// ---- navigation ----------------------------------------------------------

function go(page) {
  state.page = page;
  $('#page').scrollTop = 0;
  render();
}

function openDetails(id) {
  state.detailsId = id;
  state.returnFocus = document.activeElement && document.activeElement.dataset.key;
  const layer = $('#details');
  layer.innerHTML = detailsHtml(byId.get(id));
  layer.hidden = false;
  focus.focusFirst(layer);
  resolve(byId.get(id)).then(() => { if (state.detailsId === id) scheduleRender(); });
}

function closeDetails() {
  state.detailsId = null;
  $('#details').hidden = true;
  focus.restore(state.returnFocus);
}

function play(id, { restart = false } = {}) {
  if (restart) delete progress[id];
  player.open(id);
}

function activate(el) {
  if (!el || el.disabled) return;
  const id = el.dataset.hero !== undefined ? state.heroId : el.dataset.id;
  switch (el.dataset.act) {
    case 'nav': go(el.dataset.page); break;
    case 'details': openDetails(id); break;
    case 'back': handle('back'); break;
    case 'play': play(id); break;
    case 'restart': play(id, { restart: true }); break;
    case 'list': {
      const added = toggleMyList(id);
      toast(added ? `Added to My List${settings.autoDownload ? ' · it will download automatically' : ''}` : 'Removed from My List');
      dl.plan();
      scheduleRender();
      break;
    }
    case 'dl': {
      const r = dl.records[id];
      if (r && r.status !== 'error') dl.remove(id, true);
      else dl.enqueue(id, 'manual');
      break;
    }
    case 'setting': {
      const s = SETTINGS.find((x) => x.key === el.dataset.setting);
      const i = s.values.indexOf(settings[s.key]);
      settings[s.key] = s.values[(i + 1) % s.values.length];
      saveSettings();
      dl.plan();
      render();
      break;
    }
  }
}

// One entry point for the remote. Returns false only when Back should exit.
function handle(action) {
  if (player.isOpen()) return player.handle(action);
  const el = focus.current();
  switch (action) {
    case 'up': case 'down': case 'left': case 'right':
      focus.move(action);
      return true;
    case 'select': activate(el); return true;
    case 'playpause': case 'play':
      if (el && (el.dataset.id || el.dataset.hero !== undefined)) play(el.dataset.hero !== undefined ? state.heroId : el.dataset.id);
      return true;
    case 'menu':
      if (el && el.dataset.id) activate({ dataset: { act: 'list', id: el.dataset.id } });
      return true;
    case 'back':
      if (state.detailsId) { closeDetails(); return true; }
      if (state.page !== 'home') { go('home'); focus.restore('nav:home'); return true; }
      if (el && !el.closest('[data-top]') && !el.closest('.top')) {
        $('#page').scrollTo({ top: 0, behavior: 'smooth' });
        focus.restore('hero:play');
        return true;
      }
      exitApp();
      return false;
  }
  return false;
}

// ---- start ---------------------------------------------------------------

function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('#stage').style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}

function start() {
  fit();
  addEventListener('resize', fit);
  player.init(() => { dl.plan(); render(); });

  document.addEventListener('keydown', (e) => {
    const action = actionForKey(e);
    if (!action) return;
    e.preventDefault();
    handle(action);
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.focusable');
    if (el) { focus.focus(el); activate(el); }
  });
  document.addEventListener('focusin', (e) => {
    const id = e.target.dataset && e.target.dataset.id;
    if (id && e.target.classList.contains('card')) updateHero(id);
  });

  // Called by the Fire TV wrapper (see android/.../MainActivity.kt).
  window.GYSM = {
    remote: (action) => handle(action),
    onPause: () => player.pause(),
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });

  const onNet = () => {
    state.online = navigator.onLine;
    if (state.online) refreshFeeds().then((added) => { if (added) dl.plan(); });
    scheduleRender();
  };
  addEventListener('online', onNet);
  addEventListener('offline', onNet);

  dl.subscribe((kind, id) => {
    if (kind === 'progress') return updateProgress(id);
    if (kind === 'done') toast(`${byId.get(id)?.title} is ready to watch offline`);
    scheduleRender();
  });

  loadCachedFeeds(); // before downloads start, so saved licensed films resolve
  render();
  focus.restore('hero:play');
  dl.start();
  refreshFeeds().then((added) => { if (added) { dl.plan(); scheduleRender(); } });

  loadManifest().then(() => { dl.plan(); scheduleRender(); });

  if ('serviceWorker' in navigator && !isFireTV && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
