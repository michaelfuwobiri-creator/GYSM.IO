import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths so the build also works from file:///android_asset/.
  base: "./",
  esbuild: { jsx: "automatic" },
  build: {
    target: "chrome87", // Fire OS 7 and later ship Chromium 87+ WebViews
    rollupOptions: {
      input: { tv: "index.html", pass: "pass.html" },
      // thirdweb's React files start with "use client", which Rollup ignores.
      onwarn(w, warn) { if (w.code !== "MODULE_LEVEL_DIRECTIVE") warn(w); },
    },
    chunkSizeWarningLimit: 900,
  },
});
