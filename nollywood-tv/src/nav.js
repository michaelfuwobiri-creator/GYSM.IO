// D-pad navigation for the Fire TV remote.
//
// Anything with [data-nav] can take focus. Arrow keys move to the nearest
// element in that direction inside the top layer (a screen or an overlay).
// Elements that share [data-group] (a row of posters, the side menu) remember
// which item was focused last, so coming back to a row lands where you left.

// Key codes as the Fire TV WebView reports them, plus keyboard equivalents
// for testing in a desktop browser (Escape/Backspace = Back, Space = play).
export const KEY = {
  LEFT: [37], UP: [38], RIGHT: [39], DOWN: [40],
  OK: [13],
  BACK: [8, 27, 461],
  PLAY_PAUSE: [179, 32, 415, 19],
  REWIND: [227, 412],
  FORWARD: [228, 417],
};

const is = (code, name) => KEY[name].includes(code);

const layers = [];
const memory = new Map();
let current = null;
let handlers = { back: () => false, key: () => false };

export function onBack(fn) { handlers.back = fn; }
export function onKey(fn) { handlers.key = fn; }

export function pushLayer(el) {
  layers.push({ el, restore: current });
  const first = el.querySelector("[data-autofocus]") || el.querySelector("[data-nav]");
  if (first) focus(first);
}

export function popLayer() {
  const layer = layers.pop();
  if (layer?.restore?.isConnected) focus(layer.restore);
  else focusFirst();
}

export function resetLayers(root) {
  layers.length = 0;
  layers.push({ el: root, restore: null });
}

const topLayer = () => layers[layers.length - 1]?.el || document.body;

export function focusFirst(scope = topLayer()) {
  const el = scope.querySelector("[data-autofocus]") || scope.querySelector("[data-nav]");
  if (el) focus(el);
}

export function focused() { return current; }

export function focus(el, { scroll = true } = {}) {
  if (!el) return;
  if (current && current !== el) current.classList.remove("is-focused");
  current = el;
  el.classList.add("is-focused");
  el.focus({ preventScroll: true });
  const group = el.dataset.group;
  if (group) memory.set(group, el);
  if (scroll) keepVisible(el);
  el.dispatchEvent(new CustomEvent("navfocus", { bubbles: true }));
}

// Slide a row so the focused card sits at the left edge, and scroll the page
// so the row is in view. Transforms are cheaper than scrollLeft on Fire TV.
function keepVisible(el) {
  const track = el.closest("[data-track]");
  if (track) {
    const viewport = track.parentElement;
    const max = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const x = Math.min(max, Math.max(0, el.offsetLeft - track.firstElementChild.offsetLeft));
    track.style.transform = `translate3d(${-x}px,0,0)`;
  }
  const scroller = el.closest("[data-scroller]");
  if (scroller) {
    const anchor = el.closest("[data-scroll-anchor]") || el;
    const top = anchor.dataset.scrollAnchor === "top" ? 0 : offsetWithin(anchor, scroller) - scroller.clientHeight * 0.38;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
}

function offsetWithin(el, ancestor) {
  let y = 0;
  for (let n = el; n && n !== ancestor; n = n.offsetParent) y += n.offsetTop;
  return y;
}

function candidates() {
  return [...topLayer().querySelectorAll("[data-nav]")].filter(
    (el) => el !== current && el.offsetParent !== null && !el.disabled,
  );
}

// Rects use the element's layout position, ignoring the row transform, so a
// card that has slid off screen is still "to the right" of the focused one.
function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

export function move(dir) {
  if (!current || !current.isConnected) return focusFirst();
  const from = rectOf(current);
  let best = null;
  let bestScore = Infinity;
  for (const el of candidates()) {
    const to = rectOf(el);
    let main, cross;
    if (dir === "left") { main = from.l - to.r; cross = Math.abs(from.cy - to.cy); if (to.cx >= from.cx) continue; }
    if (dir === "right") { main = to.l - from.r; cross = Math.abs(from.cy - to.cy); if (to.cx <= from.cx) continue; }
    if (dir === "up") { main = from.t - to.b; cross = Math.abs(from.cx - to.cx); if (to.cy >= from.cy) continue; }
    if (dir === "down") { main = to.t - from.b; cross = Math.abs(from.cx - to.cx); if (to.cy <= from.cy) continue; }
    // Overlapping elements count as distance 0; sideways offset costs more
    // than distance so we stay in the same row or column when we can.
    const score = Math.max(0, main) + cross * (dir === "left" || dir === "right" ? 4 : 1.2);
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (!best) return false;
  const group = best.dataset.group;
  if (group && group !== current.dataset.group) {
    const remembered = memory.get(group);
    if (remembered?.isConnected && remembered.offsetParent !== null) best = remembered;
  }
  focus(best);
  return true;
}

export function start() {
  document.addEventListener("keydown", (e) => {
    const code = e.keyCode;
    const typing = e.target.tagName === "INPUT" && !is(code, "UP") && !is(code, "DOWN") && !is(code, "BACK");
    if (typing && !(code === 27)) return;
    if (handlers.key(e)) return e.preventDefault();
    if (is(code, "LEFT")) { e.preventDefault(); move("left"); }
    else if (is(code, "RIGHT")) { e.preventDefault(); move("right"); }
    else if (is(code, "UP")) { e.preventDefault(); move("up"); }
    else if (is(code, "DOWN")) { e.preventDefault(); move("down"); }
    else if (is(code, "OK")) { e.preventDefault(); current?.click(); }
    else if (is(code, "BACK")) { e.preventDefault(); goBack(); }
  });

  // Pointer support for the browser preview and Fire TV tablets.
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-nav]");
    if (el && el !== current && topLayer().contains(el)) focus(el, { scroll: false });
  });
}

// Called by the Android wrapper when the remote's Back button is pressed.
// Returns false when there is nothing to go back to, so the app can exit.
export function goBack() {
  return handlers.back() === true;
}

export const isKey = is;
