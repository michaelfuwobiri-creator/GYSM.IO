import "@fontsource-variable/outfit";
import "@fontsource-variable/inter";
import "./styles.css";
import qrcode from "qrcode-generator";
import { TITLES, ROWS, FEATURED, byId } from "./catalog.js";
import * as nav from "./nav.js";
import * as player from "./player.js";
import * as store from "./store.js";
import * as web3 from "./web3.js";
import { keyboard, typeKey } from "./keyboard.js";
import { CONFIG } from "./config.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const app = $("#app");
const screen = $("#screen");
const overlays = $("#overlays");
const stage = $("#stage");
const rail = $("#rail");

let route = "home";
let overlayStack = []; // { el, close }

// ---------- Poster art -------------------------------------------------------
// Posters are drawn in CSS from each title's hue and motif, so the app ships
// with no image files. Swap in real key art by giving a title an `image`.

function artStyle(t) {
  if (t.image) return `--h:${t.hue};background-image:url('${t.image}')`;
  return `--h:${t.hue}`;
}

function art(t, { big = false } = {}) {
  return `<div class="art art--${t.motif}${big ? " art--big" : ""}" style="${artStyle(t)}">
    ${t.image ? "" : `<span class="art__title">${esc(t.title)}</span>`}
  </div>`;
}

const badges = (t) =>
  (t.premium ? `<span class="badge badge--pass">PASS</span>` : "") +
  (t.kind === "series" ? `<span class="badge">SERIES</span>` : "");

function card(t, group, { rank = 0 } = {}) {
  const p = store.progressOf(t.id);
  return `<button class="card${rank ? " card--rank" : ""}" data-nav data-group="${group}" data-id="${t.id}" aria-label="${esc(t.title)}">
    ${rank ? `<span class="card__rank">${rank}</span>` : ""}
    <span class="card__frame">
      ${art(t)}
      <span class="card__badges">${badges(t)}</span>
      ${p ? `<span class="card__progress"><i style="width:${(p.t / p.d) * 100}%"></i></span>` : ""}
    </span>
  </button>`;
}

function row(title, items, id, opts = {}) {
  if (!items.length) return "";
  return `<section class="row${opts.top10 ? " row--top10" : ""}" data-scroll-anchor>
    <h2 class="row__title">${esc(title)}${opts.premium ? ` <span class="badge badge--pass">PASS</span>` : ""}</h2>
    <div class="row__viewport"><div class="row__track" data-track>
      ${items.map((t, i) => card(t, `row-${id}`, { rank: opts.top10 ? i + 1 : 0 })).join("")}
    </div></div>
  </section>`;
}

const meta = (t) => `
  <span class="meta__match">${t.match}% match</span>
  <span>${t.year}</span>
  <span class="meta__pill">${t.rating}</span>
  <span>${t.kind === "series" ? `${t.seasons} season${t.seasons > 1 ? "s" : ""}` : t.runtime}</span>
  <span class="meta__pill">4K</span>
  <span>${t.genres.join(" · ")}</span>`;

// The blurred backdrop behind every screen follows the focused title.
let stageId = null;
function setStage(t) {
  if (!t || t.id === stageId) return;
  stageId = t.id;
  const layer = document.createElement("div");
  layer.className = "stage__layer";
  layer.innerHTML = art(t, { big: true });
  stage.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add("is-in"));
  setTimeout(() => [...stage.children].slice(0, -1).forEach((n) => n.remove()), 900);
}

// ---------- Screens ----------------------------------------------------------

const screens = {
  home() {
    const cw = store.continueWatching().map(byId).filter(Boolean);
    const list = store.myList().map(byId).filter(Boolean);
    screen.innerHTML = `
      <section class="hero" data-scroll-anchor="top">
        <div class="hero__copy"></div>
        <div class="hero__dots">${FEATURED.map((_, i) => `<i data-dot="${i}"></i>`).join("")}</div>
      </section>
      ${row("Continue watching", cw, "cw")}
      ${row("My List", list, "list")}
      ${ROWS.map((r) => row(r.title, r.items, r.id, r)).join("")}
      <footer class="foot">Nollywood · Stories from home, on every screen</footer>`;
    startHero();
  },
  series() { gridScreen("Series", TITLES.filter((t) => t.kind === "series")); },
  movies() { gridScreen("Movies", TITLES.filter((t) => t.kind === "movie")); },
  list() {
    const items = store.myList().map(byId).filter(Boolean);
    gridScreen("My List", items, "Titles you add with “My List” appear here.");
  },
  search() {
    screen.innerHTML = `
      <div class="search">
        <div class="search__side">
          <h1 class="page-title">Search</h1>
          <div class="field" id="q"><span class="field__ph">Titles, genres, cast</span></div>
          <div id="kb"></div>
        </div>
        <div class="search__results">
          <h2 class="row__title" id="results-title">Popular searches</h2>
          <div class="grid grid--4" id="results"></div>
        </div>
      </div>`;
    const draw = (q) => {
      const field = $("#q");
      field.innerHTML = q ? `${esc(q)}<span class="caret"></span>` : `<span class="field__ph">Titles, genres, cast</span>`;
      const needle = q.trim().toLowerCase();
      const hits = needle
        ? TITLES.filter((t) => [t.title, ...t.genres, ...t.cast].join(" ").toLowerCase().includes(needle))
        : ROWS[0].items;
      $("#results-title").textContent = needle ? (hits.length ? `Results for “${q.trim()}”` : `No results for “${q.trim()}”`) : "Popular searches";
      $("#results").innerHTML = hits.map((t) => card(t, "results")).join("");
    };
    keyboard($("#kb"), { layout: "search", onChange: draw });
    draw("");
  },
  account() {
    const s = web3.state();
    if (!s.address) return signInScreen();
    screen.innerHTML = `
      <div class="account">
        <h1 class="page-title">Account</h1>
        <div class="account__grid">
          <div class="panel">
            <div class="panel__label">Signed in</div>
            <div class="panel__big">${esc(s.email || "Wallet")}</div>
            <div class="wallet-chip"><span class="dot"></span>${web3.short(s.address)} · ${chainName()}</div>
            <p class="muted">Your thirdweb wallet was created when you signed in. No seed phrase to keep, it is tied to your email.</p>
            <div class="actions"><button class="btn btn--ghost" data-nav data-group="acct" data-action="signout">Sign out</button></div>
          </div>
          <div class="panel panel--pass ${s.hasPass ? "is-active" : ""}">
            <div class="pass-card">${passCard(s.hasPass)}</div>
            ${s.hasPass
              ? `<p>Your Nollywood Pass is active. Every title is unlocked on this TV and any device you sign in on.</p>
                 <div class="actions"><button class="btn" data-nav data-group="acct" data-action="browse-pass" data-autofocus>Watch Pass titles</button></div>`
              : `<p>Unlock ${TITLES.filter((t) => t.premium).length} premium films and series, early premieres and 4K. The pass is an on-chain membership you own and can cancel or resell any time.</p>
                 <div class="actions"><button class="btn btn--gold" data-nav data-group="acct" data-action="get-pass" data-autofocus>Get Nollywood Pass · ${esc(CONFIG.passPrice)}</button></div>`}
          </div>
        </div>
        ${s.demo ? `<p class="demo-note">Demo mode: add a thirdweb client ID to <code>.env</code> to use real wallets.</p>` : ""}
      </div>`;
  },
};

function gridScreen(title, items, empty = "") {
  screen.innerHTML = `
    <div class="page">
      <h1 class="page-title">${title}</h1>
      ${items.length ? `<div class="grid">${items.map((t) => card(t, "grid")).join("")}</div>` : `<p class="muted big-empty">${empty}</p>`}
    </div>`;
}

const chainName = () => ({ 1: "Ethereum", 8453: "Base", 84532: "Base Sepolia", 137: "Polygon", 42161: "Arbitrum" }[CONFIG.chainId] || `Chain ${CONFIG.chainId}`);

const passCard = (active) => `
  <div class="pass ${active ? "pass--on" : ""}">
    <div class="pass__shine"></div>
    <div class="pass__logo">N</div>
    <div class="pass__name">NOLLYWOOD PASS</div>
    <div class="pass__status">${active ? "ACTIVE" : "MEMBERSHIP"}</div>
  </div>`;

// ---------- Sign in with thirdweb in-app wallet ----------------------------

function signInScreen(step = "email", email = "") {
  screen.innerHTML = `
    <div class="signin">
      <div class="signin__copy">
        <h1 class="page-title">${step === "email" ? "Sign in" : "Check your email"}</h1>
        <p class="lead">${step === "email"
          ? "Use your email to sign in. We create a secure thirdweb wallet for you automatically. No app, no seed phrase."
          : `We sent a 6-digit code to <b>${esc(email)}</b>.`}</p>
        <div class="field field--xl" id="field"><span class="field__ph">${step === "email" ? "you@example.com" : "• • • • • •"}</span></div>
        <div class="signin__msg" id="msg">${web3.isDemo ? "Demo mode: any email and any 6 digits will work." : ""}</div>
        <div class="actions">
          <button class="btn" data-nav data-group="si-act" data-action="${step === "email" ? "send-code" : "verify"}">${step === "email" ? "Send code" : "Sign in"}</button>
          ${step === "code" ? `<button class="btn btn--ghost" data-nav data-group="si-act" data-action="restart-signin">Use another email</button>` : ""}
        </div>
      </div>
      <div id="kb" class="signin__kb"></div>
    </div>`;
  let value = "";
  keyboard($("#kb"), {
    layout: step === "email" ? "email" : "digits",
    max: step === "email" ? 64 : 6,
    onChange(v) {
      value = v;
      $("#field").innerHTML = v ? `${esc(step === "code" ? v.split("").join(" ") : v)}<span class="caret"></span>` : `<span class="field__ph">${step === "email" ? "you@example.com" : "• • • • • •"}</span>`;
    },
  });
  const btn = $(`[data-action="${step === "email" ? "send-code" : "verify"}"]`);
  btn.onclick = async (e) => {
    e.stopPropagation();
    const msg = $("#msg");
    msg.classList.remove("is-error");
    try {
      btn.disabled = true;
      if (step === "email") {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new Error("Enter a valid email address.");
        msg.textContent = "Sending code…";
        await web3.sendCode(value);
        signInScreen("code", value);
        nav.focusFirst(screen);
      } else {
        msg.textContent = "Signing in…";
        await web3.verifyCode(email, value);
        toast("Signed in");
        go("account");
      }
    } catch (err) {
      btn.disabled = false;
      msg.textContent = err.message || "Something went wrong. Try again.";
      msg.classList.add("is-error");
    }
  };
}

// ---------- Hero -------------------------------------------------------------

let heroTimer = 0;
let heroIndex = 0;

function startHero() {
  clearInterval(heroTimer);
  heroIndex = 0;
  drawHero();
  heroTimer = setInterval(() => {
    // Only rotate while the viewer is looking at the hero, not mid-row.
    const f = nav.focused();
    if (route !== "home" || overlayStack.length || (f && !f.closest(".hero") && !f.closest(".rail"))) return;
    heroIndex = (heroIndex + 1) % FEATURED.length;
    drawHero(true);
  }, 9000);
}

function drawHero(keepFocus) {
  const t = FEATURED[heroIndex];
  const copy = $(".hero__copy");
  if (!copy) return;
  const hadFocus = nav.focused()?.closest(".hero")?.dataset.action;
  const inList = store.inList(t.id);
  copy.innerHTML = `
    <div class="hero__eyebrow"><span class="n-mark">N</span> ${t.kind === "series" ? "ORIGINAL SERIES" : "ORIGINAL FILM"} ${t.premium ? `<span class="badge badge--pass">PASS</span>` : ""}</div>
    <h1 class="hero__title">${esc(t.title)}</h1>
    <div class="meta">${meta(t)}</div>
    <p class="hero__logline">${esc(t.logline)}</p>
    <div class="actions">
      <button class="btn btn--play" data-nav data-group="hero" data-action="play" data-id="${t.id}" ${keepFocus ? "" : "data-autofocus"}>${ico("play")} ${store.progressOf(t.id) ? "Resume" : "Play"}</button>
      <button class="btn btn--glass" data-nav data-group="hero" data-action="list" data-id="${t.id}">${ico(inList ? "check" : "plus")} My List</button>
      <button class="btn btn--glass" data-nav data-group="hero" data-action="info" data-id="${t.id}">${ico("info")} Details</button>
    </div>`;
  copy.classList.remove("is-in");
  requestAnimationFrame(() => copy.classList.add("is-in"));
  document.querySelectorAll(".hero__dots i").forEach((d, i) => d.classList.toggle("is-on", i === heroIndex));
  setStage(t);
  if (keepFocus && hadFocus) nav.focus($(`.hero [data-action="${hadFocus}"]`), { scroll: false });
}

// ---------- Details overlay --------------------------------------------------

function openDetails(t) {
  const locked = t.premium && !web3.state().hasPass;
  const p = store.progressOf(t.id);
  const el = document.createElement("section");
  el.className = "details";
  el.innerHTML = `
    <div class="details__bg">${art(t, { big: true })}</div>
    <div class="details__body" data-scroller>
      <div class="details__head" data-scroll-anchor="top">
        <div class="hero__eyebrow"><span class="n-mark">N</span> ${t.kind === "series" ? "ORIGINAL SERIES" : "ORIGINAL FILM"} ${badges(t)}</div>
        <h1 class="hero__title">${esc(t.title)}</h1>
        <div class="meta">${meta(t)}</div>
        <p class="hero__logline">${esc(t.logline)}</p>
        <p class="muted">Starring ${t.cast.map(esc).join(", ")}</p>
        ${p ? `<div class="resume"><span class="card__progress"><i style="width:${(p.t / p.d) * 100}%"></i></span> ${Math.round((p.d - p.t) / 60)} min left</div>` : ""}
        <div class="actions">
          ${locked
            ? `<button class="btn btn--gold" data-nav data-group="det" data-action="get-pass" data-autofocus>${ico("lock")} Unlock with Nollywood Pass</button>
               <button class="btn btn--glass" data-nav data-group="det" data-action="trailer" data-id="${t.id}">${ico("play")} Trailer</button>`
            : `<button class="btn btn--play" data-nav data-group="det" data-action="play" data-id="${t.id}" data-autofocus>${ico("play")} ${p ? "Resume" : "Play"}</button>`}
          <button class="btn btn--glass" data-nav data-group="det" data-action="list" data-id="${t.id}">${ico(store.inList(t.id) ? "check" : "plus")} My List</button>
        </div>
      </div>
      ${t.kind === "series" ? episodes(t, locked) : ""}
      ${row("More like this", TITLES.filter((x) => x !== t && x.genres.some((g) => t.genres.includes(g))).slice(0, 10), "similar")}
    </div>`;
  openOverlay(el);
}

function episodes(t, locked) {
  const names = ["Pilot", "The Offer", "Crossroads", "No Going Back", "Blood & Bloodline", "Homecoming", "The Reckoning", "Last Light", "Aftermath", "Finale"];
  const count = parseInt(t.runtime) || 6;
  return `<section class="row" data-scroll-anchor>
    <h2 class="row__title">Season 1 · Episodes</h2>
    <div class="row__viewport"><div class="row__track" data-track>
      ${Array.from({ length: Math.min(count, 10) }, (_, i) => `
        <button class="ep" data-nav data-group="eps" data-action="${locked && i > 0 ? "get-pass" : "play"}" data-id="${t.id}">
          <span class="ep__thumb">${art({ ...t, hue: t.hue + i * 9 })}<span class="ep__num">${i + 1}</span>${locked && i > 0 ? `<span class="ep__lock">${ico("lock")}</span>` : ""}</span>
          <span class="ep__name">${i + 1}. ${names[i]}</span>
          <span class="ep__len">${42 + ((i * 7) % 15)} min${locked && i === 0 ? " · Free episode" : ""}</span>
        </button>`).join("")}
    </div></div>
  </section>`;
}

// ---------- Pass checkout (QR to phone) -------------------------------------

function openPassModal() {
  const s = web3.state();
  if (!s.address) {
    toast("Sign in first. Your pass is sent to your wallet.");
    closeAllOverlays();
    return go("account");
  }
  const url = web3.passUrl();
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const el = document.createElement("section");
  el.className = "modal";
  el.innerHTML = `
    <div class="modal__card">
      <div class="modal__pass">${passCard(false)}</div>
      <div class="modal__body">
        <h2>Get Nollywood Pass</h2>
        <ol class="steps">
          <li>Scan the code with your phone camera.</li>
          <li>Pay with card, Apple Pay or crypto through thirdweb.</li>
          <li>Your pass arrives in <b>${web3.short(s.address)}</b> and this TV unlocks by itself.</li>
        </ol>
        <div class="waiting"><span class="pulse"></span> Waiting for your purchase…</div>
        <div class="actions">
          ${s.demo ? `<button class="btn btn--gold" data-nav data-action="demo-buy" data-autofocus>Simulate purchase (demo)</button>` : ""}
          <button class="btn btn--ghost" data-nav data-action="close" ${s.demo ? "" : "data-autofocus"}>Not now</button>
        </div>
      </div>
      <div class="modal__qr">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}<div class="muted small">${esc(CONFIG.passPrice)}</div></div>
    </div>`;
  const stop = s.demo ? () => {} : web3.watchPass(() => unlocked());
  const unlocked = () => {
    stop();
    closeOverlay();
    celebrate();
  };
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]")?.dataset.action;
    if (a === "demo-buy") { web3.demoGrantPass(); unlocked(); }
    if (a === "close") closeOverlay();
    e.stopPropagation();
  });
  openOverlay(el, stop);
}

function celebrate() {
  const el = document.createElement("div");
  el.className = "celebrate";
  el.innerHTML = `${passCard(true)}<h2>Welcome to Nollywood Pass</h2><p>Everything is unlocked. Enjoy the show.</p>`;
  app.appendChild(el);
  setTimeout(() => el.classList.add("is-out"), 2600);
  setTimeout(() => el.remove(), 3200);
  rerender();
}

// ---------- Overlays, routing, events ----------------------------------------

function openOverlay(el, onClose = () => {}) {
  overlays.appendChild(el);
  overlayStack.push({ el, onClose });
  requestAnimationFrame(() => el.classList.add("is-open"));
  nav.pushLayer(el);
}

function closeOverlay() {
  const o = overlayStack.pop();
  if (!o) return false;
  o.onClose();
  o.el.classList.remove("is-open");
  setTimeout(() => o.el.remove(), 300);
  nav.popLayer();
  return true;
}

function closeAllOverlays() { while (overlayStack.length) closeOverlay(); }

function go(name) {
  route = name;
  closeAllOverlays();
  clearInterval(heroTimer);
  rail.querySelectorAll("[data-route]").forEach((b) => b.classList.toggle("is-current", b.dataset.route === name));
  app.dataset.route = name;
  screen.scrollTop = 0;
  screens[name]();
  nav.resetLayers(app);
  nav.focusFirst(screen);
}

// Re-draw the current screen in place (after list or pass changes).
function rerender() {
  const f = nav.focused();
  const key = f && (f.dataset.id ? `[data-id="${f.dataset.id}"][data-group="${f.dataset.group}"]` : f.dataset.action ? `[data-action="${f.dataset.action}"]` : null);
  const top = screen.scrollTop;
  if (overlayStack.length) return;
  screens[route]();
  screen.scrollTop = top;
  const again = key && $(key, screen);
  if (again) nav.focus(again, { scroll: false });
  else nav.focusFirst(screen);
}

function playTitle(t, { trailer = false } = {}) {
  if (t.premium && !trailer && !web3.state().hasPass) return openPassModal();
  player.play(t, overlays);
}

document.addEventListener("player:closed", () => { if (!overlayStack.length) rerender(); });

app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action], [data-route], .card");
  if (!el) return;
  if (el.dataset.route) {
    if (el.dataset.route !== route) go(el.dataset.route);
    else nav.focusFirst(screen);
    return;
  }
  const t = byId(el.dataset.id);
  if (el.classList.contains("card")) return openDetails(t);
  switch (el.dataset.action) {
    case "play": return playTitle(t);
    case "trailer": return playTitle(t, { trailer: true });
    case "info": return openDetails(t);
    case "list": {
      const added = store.toggleList(t.id);
      el.innerHTML = `${ico(added ? "check" : "plus")} My List`;
      toast(added ? `Added “${t.title}” to My List` : `Removed from My List`);
      return;
    }
    case "get-pass": return openPassModal();
    case "browse-pass": go("home"); return nav.focus($('[data-group="row-pass"]'));
    case "signout": return web3.signOut().then(() => { toast("Signed out"); go("account"); });
    case "restart-signin": return signInScreen();
  }
});

app.addEventListener("navfocus", (e) => {
  const el = e.target;
  rail.classList.toggle("is-open", !!el.closest(".rail"));
  const id = el.dataset.id;
  if (id && !el.closest(".hero")) setStage(byId(id));
});

nav.onKey((e) => {
  if (player.isPlaying() && player.handleKey(e)) return true;
  if (!player.isPlaying() && typeKey(e)) return true;
  return false;
});

nav.onBack(() => {
  if (player.close()) return true;
  if (closeOverlay()) return true;
  if (rail.classList.contains("is-open")) { nav.focusFirst(screen); return true; }
  if (route !== "home") { go("home"); return true; }
  const f = nav.focused();
  if (f && !f.closest(".hero")) { nav.focusFirst(screen); return true; }
  return false; // let Android close the app
});

window.nollywoodBack = () => nav.goBack();

let toastTimer = 0;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
}

function ico(name) {
  const p = {
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${p[name]}</svg>`;
}

// ---------- Boot -------------------------------------------------------------

web3.onChange(() => {
  const s = web3.state();
  $("#rail-account-label").textContent = s.address ? (s.hasPass ? "Pass active" : web3.short(s.address)) : "Sign in";
  rail.classList.toggle("has-pass", s.hasPass);
  if (route === "account" && !screen.querySelector(".signin")) rerender();
});

nav.start();
go("home");
web3.restore();
setTimeout(() => app.classList.add("is-ready"), 50);
