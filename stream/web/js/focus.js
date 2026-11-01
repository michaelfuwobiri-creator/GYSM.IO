// Spatial navigation for the Fire TV remote. Every interactive element has
// the class `focusable` and a unique `data-key`. Arrow keys move to the
// nearest focusable element in that direction inside the top-most open layer
// ([data-layer]). Rows remember their last focused card, as on Fire TV home.

const stage = () => document.getElementById('stage');
export const scale = () => stage().getBoundingClientRect().width / 1920;

function scope() {
  const layers = [...document.querySelectorAll('[data-layer]:not([hidden])')];
  return layers.length ? layers[layers.length - 1] : document.getElementById('app');
}

function focusables(root = scope()) {
  return [...root.querySelectorAll('.focusable')].filter(
    (el) => !el.disabled && el.getClientRects().length && !el.closest('[hidden]'),
  );
}

export function current() {
  const el = document.activeElement;
  return el && el.classList.contains('focusable') && scope().contains(el) ? el : null;
}

export function focus(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  const row = el.closest('[data-row]');
  if (row) row.dataset.mem = el.dataset.key;
  reveal(el);
}

export function focusFirst(root) {
  const list = focusables(root);
  focus(list.find((el) => el.hasAttribute('data-autofocus')) || list[0]);
}

export function restore(key) {
  const el = key && scope().querySelector(`.focusable[data-key="${CSS.escape(key)}"]`);
  if (el) focus(el); else focusFirst();
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export function move(dir) {
  const from = current();
  if (!from) return focusFirst(), true;
  const a = from.getBoundingClientRect();
  const ac = center(a);
  const horizontal = dir === 'left' || dir === 'right';
  const fromRow = from.closest('[data-row]');
  let best = null;
  let bestScore = Infinity;
  for (const el of focusables()) {
    if (el === from) continue;
    // Left/right never leaves a row: the end of a row is the end.
    if (horizontal && fromRow && el.closest('[data-row]') !== fromRow) continue;
    const b = el.getBoundingClientRect();
    const bc = center(b);
    let main;
    let cross;
    if (dir === 'right') { main = b.left - a.right; if (bc.x <= ac.x + 1) continue; }
    if (dir === 'left') { main = a.left - b.right; if (bc.x >= ac.x - 1) continue; }
    if (dir === 'down') { main = b.top - a.bottom; if (bc.y <= ac.y + 1) continue; }
    if (dir === 'up') { main = a.top - b.bottom; if (bc.y >= ac.y - 1) continue; }
    if (horizontal) {
      const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      cross = overlap > 0 ? 0 : Math.abs(bc.y - ac.y);
    } else {
      const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      cross = overlap > 0 ? 0 : Math.abs(bc.x - ac.x);
    }
    // Vertical moves favour the nearest row over the closest column, so Up
    // from a row lands on the hero buttons rather than a far-away tab.
    const score = horizontal ? Math.max(0, main) + cross * 4 : Math.max(0, main) * 2 + cross * 0.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (!best) return false;
  // Entering another row vertically: go back to the card last used there.
  const row = best.closest('[data-row]');
  if (!horizontal && row && row !== fromRow && row.dataset.mem) {
    const mem = row.querySelector(`.focusable[data-key="${CSS.escape(row.dataset.mem)}"]`);
    if (mem) best = mem;
  }
  focus(best);
  return true;
}

// Keep the focused element on screen: rows slide sideways, pages scroll.
function reveal(el) {
  const s = scale();
  const track = el.closest('.row__track');
  if (track) {
    const viewport = track.parentElement.clientWidth;
    const max = Math.max(0, track.scrollWidth - viewport);
    const x = Math.min(max, Math.max(0, el.offsetLeft - track.firstElementChild.offsetLeft));
    track.style.transform = `translateX(${-x}px)`;
  }
  const scroller = el.closest('.scroll');
  if (!scroller) return;
  if (el.closest('[data-top]')) return scroller.scrollTo({ top: 0, behavior: 'smooth' });
  const block = el.closest('[data-row]') || el;
  const er = block.getBoundingClientRect();
  const sr = scroller.getBoundingClientRect();
  const top = (er.top - sr.top) / s + scroller.scrollTop;
  const bottom = top + er.height / s;
  const margin = 60;
  const view = scroller.clientHeight;
  let target = scroller.scrollTop;
  if (top - margin < target) target = top - margin;
  else if (bottom + margin > target + view) target = bottom + margin - view;
  if (target !== scroller.scrollTop) scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}
