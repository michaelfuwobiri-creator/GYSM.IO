// Full-screen player. HLS streams play through hls.js (the Fire TV WebView has
// Media Source Extensions but no native HLS); MP4 plays directly.

import { isKey, pushLayer, popLayer, focus } from "./nav.js";
import { saveProgress, progressOf } from "./store.js";

const fmt = (s) => {
  if (!isFinite(s)) return "0:00";
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

let active = null;

// Keeps the TV from dimming during playback (Android wrapper only).
const keepAwake = (on) => window.NollywoodAndroid?.keepAwake(on);

export const isPlaying = () => !!active;

export function play(title, root) {
  close();
  const el = document.createElement("section");
  el.className = "player";
  el.innerHTML = `
    <video class="player__video" playsinline preload="auto"></video>
    <div class="player__spinner" aria-hidden="true"></div>
    <div class="player__ui">
      <div class="player__top">
        <div class="player__brand">NOLLYWOOD</div>
        <div>
          <div class="player__title">${title.title}</div>
          <div class="player__sub">${title.kind === "series" ? "S1 · E1" : title.year} · ${title.rating}</div>
        </div>
      </div>
      <div class="player__bottom">
        <div class="player__bar"><div class="player__buffer"></div><div class="player__fill"><span class="player__knob"></span></div></div>
        <div class="player__row">
          <span class="player__time" data-t="cur">0:00</span>
          <div class="player__controls">
            <button class="pbtn" data-nav data-group="pctl" data-act="back10" aria-label="Back 10 seconds">${icon("back10")}</button>
            <button class="pbtn pbtn--main" data-nav data-group="pctl" data-act="toggle" data-autofocus aria-label="Play or pause">${icon("pause")}</button>
            <button class="pbtn" data-nav data-group="pctl" data-act="fwd10" aria-label="Forward 10 seconds">${icon("fwd10")}</button>
          </div>
          <span class="player__time" data-t="dur">0:00</span>
        </div>
      </div>
    </div>`;
  root.appendChild(el);

  const video = el.querySelector("video");
  const fill = el.querySelector(".player__fill");
  const buffer = el.querySelector(".player__buffer");
  const cur = el.querySelector('[data-t="cur"]');
  const dur = el.querySelector('[data-t="dur"]');
  const toggleBtn = el.querySelector('[data-act="toggle"]');
  let hls = null;
  let hideTimer = 0;

  let closed = false;
  if (title.stream.includes(".m3u8") && !video.canPlayType("application/vnd.apple.mpegurl")) {
    // hls.js is loaded on first play to keep app start-up fast.
    import("hls.js").then(({ default: Hls }) => {
      if (closed) return;
      hls = new Hls({ maxBufferLength: 30, capLevelToPlayerSize: true });
      hls.loadSource(title.stream);
      hls.attachMedia(video);
      video.play().catch(() => el.classList.add("is-paused"));
    });
  } else {
    video.src = title.stream;
  }

  const resume = progressOf(title.id);
  video.addEventListener("loadedmetadata", () => {
    if (resume && resume.t < video.duration - 5) video.currentTime = resume.t;
    dur.textContent = fmt(video.duration);
  }, { once: true });

  video.addEventListener("timeupdate", () => {
    const p = video.duration ? video.currentTime / video.duration : 0;
    fill.style.width = `${p * 100}%`;
    cur.textContent = fmt(video.currentTime);
  });
  video.addEventListener("progress", () => {
    if (video.buffered.length && video.duration) buffer.style.width = `${(video.buffered.end(video.buffered.length - 1) / video.duration) * 100}%`;
  });
  video.addEventListener("waiting", () => el.classList.add("is-loading"));
  video.addEventListener("playing", () => el.classList.remove("is-loading"));
  video.addEventListener("playing", () => keepAwake(true));
  video.addEventListener("pause", () => keepAwake(false));
  video.addEventListener("play", () => { toggleBtn.innerHTML = icon("pause"); el.classList.remove("is-paused"); wake(); });
  video.addEventListener("pause", () => { toggleBtn.innerHTML = icon("play"); el.classList.add("is-paused"); wake(); });
  video.addEventListener("ended", () => close());

  const save = () => saveProgress(title.id, video.currentTime, video.duration);
  const saver = setInterval(save, 5000);

  function wake() {
    el.classList.add("show-ui");
    clearTimeout(hideTimer);
    if (!video.paused) hideTimer = setTimeout(() => el.classList.remove("show-ui"), 4000);
  }

  const seek = (by) => { video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + by)); wake(); };
  const toggle = () => (video.paused ? video.play() : video.pause());

  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "toggle") toggle();
    if (act === "back10") seek(-10);
    if (act === "fwd10") seek(10);
    wake();
  });
  el.addEventListener("mousemove", wake);

  active = {
    // Media keys work whatever is focused; any other key just shows the UI
    // first, so the first press doesn't also trigger an action unseen.
    key(e) {
      const code = e.keyCode;
      if (isKey(code, "PLAY_PAUSE")) { toggle(); return true; }
      if (isKey(code, "REWIND")) { seek(-30); return true; }
      if (isKey(code, "FORWARD")) { seek(30); return true; }
      if (isKey(code, "BACK")) return false;
      if (!el.classList.contains("show-ui")) { wake(); return true; }
      wake();
      return false;
    },
    destroy() {
      closed = true;
      keepAwake(false);
      save();
      clearInterval(saver);
      clearTimeout(hideTimer);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      el.remove();
    },
  };

  pushLayer(el);
  focus(toggleBtn);
  wake();
  video.play().catch(() => el.classList.add("is-paused"));
}

export function handleKey(e) { return active ? active.key(e) : false; }

export function close() {
  if (!active) return false;
  active.destroy();
  active = null;
  popLayer();
  document.dispatchEvent(new CustomEvent("player:closed"));
  return true;
}

function icon(name) {
  const paths = {
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>',
    back10: '<path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="12" y="16.5" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-weight="700">10</text>',
    fwd10: '<path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="12" y="16.5" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-weight="700">10</text>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}
