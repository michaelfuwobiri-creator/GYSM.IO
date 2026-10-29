# Sample delivery packages

Two made-up titles laid out like Filmhub delivery packages (film, artwork, captions, metadata), for testing `../filmhub-import.mjs`. They are not real Filmhub titles. The videos are generated colour gradients.

- `harbour-lights/` has CSV metadata and English captions. Downloads are allowed for 30 days.
- `night-market/` has YAML metadata and is streaming only (`offline_allowed: no`).

```bash
node tools/filmhub-import.mjs --in tools/sample-delivery --out /tmp/filmhub-test/filmhub.json --media-out /tmp/filmhub-test/media
```
