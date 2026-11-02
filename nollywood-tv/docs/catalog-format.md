# Catalogue API

By default the app shows built-in sample titles. Set `VITE_CATALOG_URL` and it loads the catalogue from your API instead. `public/catalog.example.json` is a working example.

## How it behaves

- The app asks for the catalogue each time it starts and waits up to 3.5 seconds. The screen stays hidden meanwhile.
- A good response is saved on the device. If the API is down later, the saved copy is used.
- With no API, no saved copy, or an unusable response, the built-in sample is shown. The app always opens.
- The response is treated as untrusted. Bad titles are skipped (a warning is printed in the console), not the whole catalogue. A response with no valid titles is rejected.

## Response format

A JSON object:

| Field | Required | Notes |
| --- | --- | --- |
| `titles` | yes | Array, up to 500 titles |
| `featured` | no | Title IDs for the rotating banner (max 6). Default: the first 4 titles |
| `rows` | no | Up to 30 rows. Default: "Watch now", a Pass row, and one row per genre with at least 3 titles |

A title:

| Field | Required | Rule |
| --- | --- | --- |
| `id` | yes | Lowercase letters, digits and dashes, up to 80 characters, unique |
| `title` | yes | Up to 120 characters |
| `stream` | yes | An **https** URL to an `.m3u8` (HLS) or `.mp4` file |
| `kind` | no | `movie` (default) or `series` |
| `year` | no | Whole number, 1900 to 2100 |
| `rating` | no | Up to 8 letters, digits, `+` or spaces. Default `NR` |
| `runtime` | no | For example `1h 52m`, or `8 episodes` for series |
| `seasons` | no | Series only, 1 to 50 |
| `genres` | no | Up to 6 |
| `cast` | no | Up to 8 |
| `logline` | no | Up to 600 characters |
| `image` | no | An https poster URL. Without it, a coloured poster is drawn from the title |
| `premium` | no | `true` locks it behind the Nollywood Pass |
| `match` | no | 0 to 100 |
| `hue`, `motif` | no | Colour (0 to 360) and pattern (`grid`, `dots`, `lines`, `sun`, `adire`, `waves`) for drawn posters |

A row: `{ "id": "trending", "title": "Trending in Nigeria", "ids": ["..."], "top10": false, "premium": false }`. `id` is lowercase letters, digits and dashes. Unknown title IDs are ignored.

Image and stream addresses must be `https` and must not contain quotes, brackets, backslashes or spaces; the app refuses them.

## API key

If your API needs a key, set it in your shell before building. It is added to the app at build time:

```bash
export VITE_CATALOG_URL=https://api.example.com/v1/catalog
export VITE_CATALOG_API_KEY=<your read-only key>
npm run build
```

Or put the same lines in `.env` (it is not committed). By default the key is sent as `Authorization: Bearer <key>`. For another header name, set `VITE_CATALOG_API_KEY_HEADER`, for example `x-api-key` or `apikey`; then the key is sent as is.

**The key ends up inside the app.** Anyone with the app can read it, so use a key that can only read the catalogue, and that you can revoke. Never use a key that can write data or reach anything private. If the API needs a real secret, put a small server in front of it that holds the secret and give the app that server's address instead.

The API must also allow cross-origin requests (CORS) from the app, including the `Authorization` header, or the browser blocks the call.
