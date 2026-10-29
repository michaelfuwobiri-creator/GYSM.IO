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
