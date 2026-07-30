# DamammApps Public Asset Inventory

## Scope and collection time

- Inspection window: 2026-07-30 02:29–02:38 UTC
- Method: `curl -L -I`, followed by `curl -L --compressed -D ... -o ...`
- Temporary evidence directory: `/tmp/mrbd-damammapps-analysis`
- Scope: the five URLs named in the research task, same-origin resources referenced by their HTML, the DamamMap URL derived explicitly from the public Hub registry, and the shared `i18n.json` explicitly fetched by `i18n.js`
- Excluded: site-wide crawling, directory discovery, authenticated/account endpoints, hidden paths, and third-party library bodies
- Repository policy: no downloaded third-party source or binary is stored in this repository

The public pages can change after this capture. SHA-256 values identify the exact response bodies inspected.

## Requested pages

| URL | HTTP | Redirect | Bytes (decoded) | SHA-256 | Result |
|---|---:|---|---:|---|---|
| `https://www.damamme.com/damammapps/index.html` | 200 | None | 6,241 | `5aaa7a5071edba4362f64b7fe9562d7a9e3a7f4ac96e7b6327a2f51e20dae070` | Downloaded |
| `https://www.damamme.com/damammapps/` | 200 | None | 6,241 | `5aaa7a5071edba4362f64b7fe9562d7a9e3a7f4ac96e7b6327a2f51e20dae070` | Downloaded; body identical to explicit `index.html` |
| `https://www.damamme.com/damammapps/install.html` | 200 | None | 5,143 | `fa9c0945d85e3388a75ddba8ea5ff963415f7a64e05b5786305ffd2f8e39a81a` | Downloaded |
| `https://www.damamme.com/damammap/` | 404 | None | 236 | `9448f8a1159c9b14e3e1b9d8eab1a6ddf88d26e1f888a34cef430c756e4e6e1e` | Apache 404 body |
| `https://www.damamme.com/damammap/index.html` | 404 | None | 236 | `9448f8a1159c9b14e3e1b9d8eab1a6ddf88d26e1f888a34cef430c756e4e6e1e` | Apache 404 body |
| `https://www.damamme.com/damammapps/apps/damammap/index.html` | 200 | None | 2,561 | `ffe4175aad55009905a0ba893a6e065e8fa6fb6e0e8c77a48fba274591e756a8` | Downloaded; path derived from the Hub's public `InstallBouton` registry |

The two `/damammap/` URLs supplied as possible entry points do not host the app. The active Hub code resolves DamamMap to `/damammapps/apps/damammap/index.html`.

## Response headers

Successful HTML and the explicitly fetched JSON showed:

- `server: Apache`
- `access-control-allow-origin: *`
- `cache-control: no-cache, no-store, must-revalidate`
- `pragma: no-cache`
- `expires: 0`
- normal content types (`text/html`, `application/json`)
- a host cookie with `HttpOnly; SameSite=Strict`

The captured responses did **not** include:

- `Permissions-Policy`
- `Content-Security-Policy`
- `Feature-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Embedder-Policy`

No successful requested page redirected. DamamMap contains client-side code that replaces the bare `damamme.com` hostname with `www.damamme.com`, but the inspected URLs already used `www`.

## DamammApps Hub assets

| Public resource | Role at Hub root | Bytes | SHA-256 | Downloaded |
|---|---|---:|---|---|
| `/damammapps/css/app.css` | Active stylesheet | 19,519 | `9bea5178b9394ae37e4487cd52553c9545f42e9b588b1be685034e020a42d217` | Yes |
| `/damammapps/js/config.js` | Active Hub config | 1,644 | `87700a41c35d82bbad4008c7305d9567034f031312e9be32415ed6456b895eea` | Yes |
| `/damammapps/js/app.js` | Active Hub registry/navigation/account UI | 58,436 | `df9db70c2bb07eb9782f309bacc51ca15dbe10a5b23912c6ad811d0e6cfdafe9` | Yes |
| `/damammapps/lib/utils.js` | Active shared utility | 11,680 | `5b4c51d4739cd89201b1b76bf2466aeeeb2a8141a6ea9e579397ea7bda181831` | Yes |
| `/damammapps/lib/i18n.js` | Active translation loader | 4,552 | `da1b61cccac51f22e8b57f72c8ffd655e749b5184df3732289093c4e82bfad6e` | Yes |
| `/damammapps/i18n.json` | Explicit fetch target of `i18n.js` | 510,612 | `84954653b2462394abc4c15021785940c392c851b360dae71a3732faceda25e1` | Yes |
| `/damammapps/lib/title.js` | Active title/focus/quit UI | 26,001 | `259a2d6d826e02a7abf71636edbdbb6e05977273571262197f66d4c26d56f680` | Yes |
| `/damammapps/lib/keyboard.js` | Active virtual keyboard | 17,278 | `761c39988f0333446ec0e2c23d62c8435b8fa9f4baea386dc72e7ef0aab585fa` | Yes |

The root HTML contains the following library tags inside an HTML comment, so they are **not active at the Hub root**: `splash.js`, `storage.js`, `screen.js`, `bottomnav.js`, `navigation.js`, `input.js`, `settings.js`, and `main.js`.

The Hub also publicly references Google Fonts. The install page references Google Fonts and `qrcodejs` from cdnjs. These third-party bodies were not downloaded because they are not part of the same-origin permission or navigation implementation.

## DamamMap assets

| Public resource | Role | Bytes | SHA-256 | Downloaded |
|---|---|---:|---|---|
| `/damammapps/apps/damammap/index.html` | Independent child document | 2,561 | `ffe4175aad55009905a0ba893a6e065e8fa6fb6e0e8c77a48fba274591e756a8` | Yes |
| `/damammapps/apps/damammap/manifest.webmanifest` | Manifest | 417 | `c7decd6faa85de7fc509f1b1ad7e65e363063ae1b452dd4b905c23494dbed745` | Yes |
| `/damammapps/apps/damammap/css/app.css` | App stylesheet | 14,224 | `0a51cb7dc1232da7baf7e90c6073e2aaa456ba24b96b76bc395c8247a133856a` | Yes |
| `/damammapps/apps/damammap/js/config.js` | App config | 466 | `66b8b7f969bc0df24ba537380f176fb137e4bcad50efa0113715aefcc968bee9` | Yes |
| `/damammapps/apps/damammap/js/app.js` | Map/GPS/IMU product logic | 67,808 | `f5a66edc5ff22ecca2a9263c01a7ea2f464e10ddbf0564269ce474e3929763e2` | Yes |
| `/damammapps/lib/splash.js` | Shared Start and permission bootstrap | 11,260 | `22e1d19d8f338642fa396e2861c4d66839eb763681724009f11adbf9e76577f3` | Yes |
| `/damammapps/lib/storage.js` | Shared storage | 2,242 | `93b181ab2889760bdf0a7782249079c6bfe89783747a03ef37b94c16e0da7aac` | Yes |
| `/damammapps/lib/screen.js` | Shared in-document screen stack | 6,241 | `ceb7d43f2a46ba3ef06062d2b225e0508c7011093cd9befffbd3faaf99a3d9c5` | Yes |
| `/damammapps/lib/bottomnav.js` | Shared bottom controls | 12,500 | `c69b81c7f42a071b2254b1ea5293d6f890784d1ff2bd11494ad70d49a18ebb0a` | Yes |
| `/damammapps/lib/navigation.js` | Shared focus navigation | 920 | `930c679d635f87fe34b0f60893fa68d2c4e06319de660a5f5b352f52fb2fed44` | Yes |
| `/damammapps/lib/input.js` | Shared keyboard/input routing | 14,457 | `4d71deca4a4e9c171e2512ca1b0d1cbe978666d4e10d8cbf281500a8a0fb56fb` | Yes |
| `/damammapps/lib/settings.js` | Shared settings | 8,884 | `ca4dbc339e81d459a9db003c34e367318013335dac93e272db32dce05c1cbe08` | Yes |
| `/damammapps/lib/main.js` | Shared child-app initializer | 5,107 | `f16a4491ddfeea6f42e748cfafe855e4ab292a1bc04f4a08c2e8a9b89ebb3e5d` | Yes |

DamamMap dynamically loads Leaflet from cdnjs and `leaflet-rotate` from jsdelivr after Start. Their bodies were not downloaded: the Geolocation request bootstrap is already present in the same-origin shared `splash.js`, before those libraries finish loading.

## Manifest, Service Worker, iframe, and routing inventory

- **Hub manifest:** no `<link rel="manifest">` in the active Hub HTML.
- **DamamMap manifest:** present; standard metadata only (`name`, `short_name`, relative `start_url`, `display`, colors, orientation, icons). It contains no permission or capability declaration and no explicit `scope`.
- **Service Worker:** no registration or Service Worker script reference was found in the downloaded active public text resources.
- **iframe:** no iframe element or iframe creation was found.
- **`allow` attribute:** no iframe exists, therefore no iframe permission delegation was found.
- **SPA/browser history API:** no `history.pushState`, `history.replaceState`, `history.back`, `popstate`, or `hashchange` was found.
- **Child launch:** Hub JavaScript sets `window.location.href` to an independent child HTML URL with a timestamp query parameter.
- **Child quit control:** shared title code navigates explicitly to `/damammapps/index.html`.

## Install deep link

The install button and QR code both use:

```text
https://facebook.com/fb_viewapp/web_app_deep_link
  ?appName=DamammApps
  &appUrl=https%3A%2F%2Fwww.damamme.com%2Fdamammapps%2Findex.html
```

Only `appName` and `appUrl` are present. No `permissions`, `capabilities`, `scopes`, `manifest`, `appId`, `category`, or `trusted` parameter was found. The installed root is the explicit `/damammapps/index.html` URL.

## Permission UI string search

Across downloaded HTML, JavaScript, CSS, manifests, and `i18n.json`, the exact strings below were not found:

- `Permission request`
- `This web app wants to access your location`
- `Allow once`
- `Manage permissions`

`i18n.json` does include app-facing status or instruction strings such as `gpsDenied` and sensor/GPS guidance for other apps. Those are not the complete native-style prompt observed by the user, and no matching Deny/Allow button DOM or CSS implementation was found.

## Search interpretation

Search hits were treated as evidence of text presence, not automatic evidence of execution. In particular:

- Geolocation calls occur in shared `splash.js` and DamamMap `js/app.js`.
- `requestPermission` occurs for Device Orientation/Motion.
- `Escape` occurs in a custom confirmation overlay only.
- `Backspace` occurs in the virtual keyboard only.
- No `navigator.permissions`, `permissions.query`, `mediaDevices`, `getUserMedia`, `serviceWorker`, browser History API handlers, iframe, or `postMessage` was found.
