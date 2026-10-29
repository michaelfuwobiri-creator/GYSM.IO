# Cadence&co — Shopify homepage

Homepage for the **Cadence&co** Shopify store: jewellery, perfumes and homeopathy, with products gliding across the page in infinite marquee rows.

| File | What it is |
| --- | --- |
| `index.html` | Standalone preview with sample products. Open it in a browser. |
| `assets/cadence.css` | All styles (light and dark mode). Used by both versions. |
| `assets/cadence.js` | Marquee loop, mobile menu, preview "Add" button. No dependencies. |
| `shopify/sections/cadence-home.liquid` | The same design as a Shopify theme section that shows your real products. |
| `shopify/snippets/cadence-orbit-item.liquid` | One card in the 3D orbit, used by the section. |
| `shopify/README.md` | How to install the section in your theme. |

## Preview locally

Open `index.html` in a browser, or run `python3 -m http.server` and go to http://localhost:8000.

## Motion effects

- **Floating hero products.** Product tiles float in the hero and drift away from the mouse; deeper tiles move more. Each piece is positioned with `--x`, `--y`, `--s` (size) and `--depth`.
- **3D orbit, driven by scroll.** A ring of 12 products stays pinned on screen while you scroll through its section. Scrolling turns the ring once, and the heading changes to the collection in front. To adjust it: change the ring radius with `--r` and the card width with `--ow` in `.cc-orbit__ring`, and the scroll length with the height of `.cc-orbit`.
- **Scroll reveal.** Any element with `data-cc-reveal` fades and slides in when it enters the screen; `--d` delays it. `data-cc-parallax="-0.12"` moves an element against the scroll (used on the category-tile icons).
- **Reduce motion.** Visitors who turn on "reduce motion" get no floating, no rotation and no reveal, and the orbit becomes a plain grid.

No animation library is used, only CSS 3D transforms and plain JavaScript.

## How the moving rows work

Each row is a `.cc-marquee`. On load, `cadence.js` duplicates the row's products so the CSS animation (`translateX(0 → -50%)`) loops without a seam, and sets the duration so every row moves at `data-speed` pixels per second. `data-direction="reverse"` makes a row move the other way. The rows pause on hover or keyboard focus, and visitors who turn on "reduce motion" get a still row they can scroll sideways.

## Plugins, apps and MCP servers

**Required:** none. The page is plain HTML, CSS and JavaScript, and the section is plain Liquid.

**Useful:**
- **Shopify CLI** (`npm i -g @shopify/cli`): preview the theme locally (`shopify theme dev`) and upload it (`shopify theme push`).
- **Shopify MCP** (connected in Claude): creates the Jewellery, Perfumes and Homeopathy collections and adds products from a chat.
- **Canva or Adobe Express MCP**: logo, product photos and banners, and background removal so products look cut out in the floating hero.
- **Shopify apps:** Judge.me for reviews; Shopify Email or Klaviyo for the newsletter.

## Note on homeopathy copy

In the EU, and in Germany under the HWG, homeopathic products are medicinal products. Keep product copy free of healing claims. The footer already says the products do not replace medical advice.
