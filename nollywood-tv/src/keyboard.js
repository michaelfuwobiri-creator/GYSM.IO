// On-screen keyboard for search, email and sign-in codes. The text field is a
// plain element, not an <input>, so the Fire TV system keyboard never opens.

const LAYOUTS = {
  search: ["abcdef", "ghijkl", "mnopqr", "stuvwx", "yz1234", "567890"],
  email: ["abcdefg", "hijklmn", "opqrstu", "vwxyz12", "3456789", "0@._-+"],
  digits: ["123", "456", "789"],
};

const EXTRA = {
  search: [["space", "Space", 3], ["del", "⌫", 2], ["clear", "Clear", 1]],
  email: [[".com", ".com", 2], ["del", "⌫", 2], ["clear", "Clear", 3]],
  digits: [["del", "⌫", 1], ["0", "0", 1], ["clear", "Clear", 1]],
};

let active = null;

export function keyboard(container, { layout = "search", value = "", max = 64, onChange = () => {} }) {
  const cols = LAYOUTS[layout][0].length;
  container.classList.add("kb", `kb--${layout}`);
  container.style.setProperty("--cols", cols);
  const keys = LAYOUTS[layout].flatMap((row) => [...row].map((c) => [c, c, 1]));
  container.innerHTML = [...keys, ...EXTRA[layout]]
    .map(([k, label, span], i) => `<button class="kb__key" style="grid-column:span ${span}" data-nav data-group="kb-${layout}" data-key="${k}"${i ? "" : " data-autofocus"}>${label}</button>`)
    .join("");

  const api = {
    value,
    has: (k) => keys.some(([c]) => c === k) || (k === "space" && layout === "search"),
    press(k) {
      if (k === "del") api.value = api.value.slice(0, -1);
      else if (k === "clear") api.value = "";
      else if (k === "space") api.value += " ";
      else if (api.value.length < max) api.value += k;
      api.value = api.value.slice(0, max);
      onChange(api.value);
    },
  };

  container.addEventListener("click", (e) => {
    const key = e.target.closest("[data-key]");
    if (key) api.press(key.dataset.key);
  });
  active = api;
  return api;
}

// Lets a hardware keyboard type into the on-screen keyboard that is showing.
export function typeKey(e) {
  if (!active || !document.querySelector(".kb")?.offsetParent) return false;
  if (e.key === "Backspace") { active.press("del"); return true; }
  const k = e.key === " " ? "space" : e.key.toLowerCase();
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && active.has(k)) { active.press(k); return true; }
  return false;
}
