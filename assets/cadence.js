/* Cadence&co — marquee + small homepage interactions (no dependencies). */
(function () {
  "use strict";

  // Make each .cc-marquee loop seamlessly: clone its group once, then set the
  // animation duration from the group width so every row moves at the same
  // speed (data-speed, in px per second) regardless of how many items it has.
  function initMarquee(marquee) {
    var track = marquee.querySelector(".cc-marquee__track");
    var group = track && track.querySelector(".cc-marquee__group");
    if (!group || marquee.dataset.ccReady) return;
    marquee.dataset.ccReady = "true";

    // Short groups must still cover the viewport, or a gap shows mid-loop.
    var original = Array.prototype.slice.call(group.children);
    var guard = 0;
    while (group.scrollWidth < window.innerWidth && original.length && guard++ < 10) {
      original.forEach(function (item) {
        var copy = item.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        copy.querySelectorAll("a, button, input").forEach(function (el) { el.tabIndex = -1; });
        group.appendChild(copy);
      });
    }

    var clone = group.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a, button, input").forEach(function (el) { el.tabIndex = -1; });
    track.appendChild(clone);

    function setSpeed() {
      var pxPerSecond = parseFloat(marquee.dataset.speed) || 40;
      marquee.style.setProperty("--cc-speed", group.scrollWidth / pxPerSecond + "s");
    }
    setSpeed();
    window.addEventListener("resize", setSpeed);
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Hero pieces drift away from the pointer; --depth on each piece scales it.
  function initFloat(root) {
    var hero = root.querySelector(".cc-hero");
    if (!hero || !hero.querySelector(".cc-hero__float")) return;
    if (reducedMotion() || !window.matchMedia("(hover: hover)").matches) return;
    var tx = 0, ty = 0, raf = 0;
    function apply() {
      raf = 0;
      hero.style.setProperty("--mx", tx.toFixed(3));
      hero.style.setProperty("--my", ty.toFixed(3));
    }
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    hero.addEventListener("pointerleave", function () {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  // 3D ring of products. Scrolling through the (tall) section turns the ring
  // one full revolution; a slow drift keeps it alive while the page is still.
  function initOrbit(root) {
    var section = root.querySelector(".cc-orbit");
    var ring = section && section.querySelector(".cc-orbit__ring");
    if (!ring) return;
    var items = ring.querySelectorAll(".cc-orbit__item");
    if (!items.length) return;
    var step = 360 / items.length;
    ring.style.setProperty("--step", step + "deg");
    items.forEach(function (el, i) { el.style.setProperty("--i", i); });
    if (reducedMotion()) return;

    var labels = (ring.dataset.labels || "").split("|").filter(Boolean);
    var title = section.querySelector(".cc-orbit__title");
    var dots = section.querySelectorAll(".cc-orbit__dots span");
    var drift = 0, last = 0, running = false, group = -1;

    function frame(t) {
      if (!running) return;
      drift += (last ? Math.min(t - last, 64) : 0) * 0.004; // ~4°/s
      last = t;
      var rect = section.getBoundingClientRect();
      var span = rect.height - window.innerHeight;
      var p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      var rot = -p * 360 - drift;
      ring.style.setProperty("--rot", rot.toFixed(2) + "deg");

      items.forEach(function (el, i) {
        var c = Math.cos((i * step + rot) * Math.PI / 180);
        el.style.opacity = (0.15 + 0.85 * (c + 1) / 2).toFixed(3);
        el.style.pointerEvents = c > 0.8 ? "auto" : "none";
      });

      if (labels.length && title) {
        var front = ((Math.round(-rot / step) % items.length) + items.length) % items.length;
        var g = Math.floor(front * labels.length / items.length);
        if (g !== group) {
          group = g;
          title.textContent = labels[g];
          dots.forEach(function (d, i) { d.classList.toggle("is-on", i === g); });
        }
      }
      requestAnimationFrame(frame);
    }

    new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      if (visible && !running) { running = true; last = 0; requestAnimationFrame(frame); }
      if (!visible) running = false;
    }).observe(section);
  }

  // Fade/slide elements in as they enter the viewport. The hidden start state
  // only applies once .cc-js is set, so content stays visible without JS.
  function initReveal(root) {
    var els = root.querySelectorAll("[data-cc-reveal]");
    if (!els.length) return;
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    root.classList.add("cc-js");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  // data-cc-parallax="<factor>" shifts an element (via --py) as it scrolls past.
  function initParallax(root) {
    var els = root.querySelectorAll("[data-cc-parallax]");
    if (!els.length || reducedMotion()) return;
    var raf = 0;
    function update() {
      raf = 0;
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var offset = (r.top + r.height / 2 - vh / 2) * (parseFloat(el.dataset.ccParallax) || 0.1);
        el.style.setProperty("--py", offset.toFixed(1) + "px");
      });
    }
    window.addEventListener("scroll", function () {
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function initMenu(root) {
    var btn = root.querySelector(".cc-menu-btn");
    var nav = root.querySelector(".cc-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  // Preview-only "Add" feedback. In Shopify the button sits inside a real
  // product form (data-cc-form), so we leave its submit alone.
  function initAddButtons(root) {
    var count = root.querySelector(".cc-cart-count");
    root.addEventListener("click", function (e) {
      var btn = e.target.closest(".cc-card__add");
      if (!btn || btn.closest("[data-cc-form]")) return;
      e.preventDefault();
      if (count) count.textContent = String((parseInt(count.textContent, 10) || 0) + 1);
      btn.classList.add("is-added");
      btn.textContent = "Added ✓";
      setTimeout(function () {
        btn.classList.remove("is-added");
        btn.textContent = "Add";
      }, 1600);
    });
  }

  function initNewsletter(root) {
    var form = root.querySelector(".cc-news form[data-cc-demo]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = root.querySelector(".cc-news__msg");
      if (msg) msg.textContent = "Thank you — welcome to Cadence&co.";
      form.reset();
    });
  }

  function init() {
    document.querySelectorAll(".cc-marquee").forEach(initMarquee);
    document.querySelectorAll(".cc").forEach(function (root) {
      if (root.dataset.ccInit) return;
      root.dataset.ccInit = "true";
      initFloat(root);
      initOrbit(root);
      initReveal(root);
      initParallax(root);
      initMenu(root);
      initAddButtons(root);
      initNewsletter(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // Re-run when the Shopify theme editor re-renders the section.
  document.addEventListener("shopify:section:load", init);
})();
