#!/usr/bin/env bash
# Assembles the public website in _site/ for static hosts such as
# Cloudflare Pages: the app at the root and the privacy policy at /privacy/.
# Cloudflare Pages settings: build command "bash stream/build-site.sh",
# build output directory "_site".
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/privacy
cp -r stream/web/. _site/
cp privacy/index.html _site/privacy/index.html
# Never publish media from a local sample import.
rm -rf _site/filmhub-media
echo "Site ready in _site/ ($(find _site -type f | wc -l) files)"
