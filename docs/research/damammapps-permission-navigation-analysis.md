# DamammApps Permission and Navigation Analysis

## 1. Executive Summary

The public implementation does not support the hypothesis that the DamammApps **Hub page automatically requests all permissions on page load**. The active Hub scripts do not load the shared Splash permission code and contain no active Geolocation or microphone request.

The strongest code-backed sequence is instead:

```text
DamammApps Hub
→ user opens DamamMap (full same-origin document navigation)
→ user activates DamamMap Start
→ shared splash.js requests Orientation, Motion, then low-accuracy Geolocation
→ DamamMap starts its app immediately
→ after external map libraries load, DamamMap issues a high-accuracy one-shot
→ DamamMap issues a low-accuracy warm-up one-shot and a high-accuracy watch
```

The first Geolocation request is `getCurrentPosition`, made from the Start click path with low accuracy, a 3-second timeout, and a 60-second cache allowance. It is not a page-load request and it is not `watchPosition`.

The user-observed native-style location prompt is classified as **High confidence system UI**. Its full text and buttons are absent from the downloaded public HTML, JavaScript, CSS, manifest, and explicitly loaded translation JSON, while the code directly calls the browser Geolocation API.

DamamMap is an independent HTML child at the same origin, opened with `window.location.href`. No iframe or SPA/history API router was found. The most likely explanation for middle pinch is therefore that the MRBD Runtime consumes it as browser Back when a back entry exists, and opens the universal menu at the installed root. This remains a high-confidence inference, not a proven web event mapping.

## 2. User-observed MRBD facts

These observations take priority over static analysis:

- MRBDMapGameLab startup `watchPosition` was issued in a secure context without a Service Worker controller.
- Its first callback was `TIMEOUT` after about 30,098 ms; a later callback was `PERMISSION_DENIED` with `user denied Geolocation`.
- No visible permission prompt appeared.
- A separate trusted Enter/manual `getCurrentPosition` path also returned `PERMISSION_DENIED` without a prompt.
- Deleting and re-adding MRBDMapGameLab did not reset this result.
- MRBDMapGameLab's root universal menu showed Restart and Resume, but no Permissions entry.
- The native Meta Map showed the user's current position.
- On the same device and Runtime, DamamMap displayed a native-style location permission request with Deny, Allow once, and Allow.
- DamammApps' root universal menu showed Restart, Resume, and Permissions; its permission manager listed Microphone, Sensors, and Location.
- Middle pinch in a DamammApps child returned to the parent; middle pinch at the Hub root opened the universal menu.

Static code cannot override or retroactively reproduce these real-device facts.

## 3. DamammApps architecture

The Hub root is `https://www.damamme.com/damammapps/index.html`; `/damammapps/` returns the same body. It builds an app registry in JavaScript. DamamMap is registered as:

```js
InstallBouton('damammap', 'DamamMap', 'appDamamMap',
  'index.html', 'navigation', false);
```

`InstallBouton` derives `/damammapps/apps/damammap/index.html`. `openApp` appends a timestamp query and assigns the URL to `window.location.href`.

Consequences:

- Hub and DamamMap share origin `https://www.damamme.com`.
- DamamMap is not hosted at `/damammap/`; both proposed URLs there returned 404.
- DamamMap is an independent document, not an iframe.
- Entry is normal document navigation, not an SPA or hash route.
- The Hub also has internal DOM screens for account UI, but those are separate from child app navigation.
- Ordinary document navigation normally adds a browser history entry. The public code does not replace that entry.

The Hub active scripts do not include `splash.js` or `main.js`; their tags are inside an HTML comment. Therefore the shared sensor/location bootstrap does not execute merely because the Hub root loads.

## 4. DamamMap geolocation flow

```text
DamamMap document load
→ shared scripts and app scripts execute
→ shared main initializer creates Splash
→ no Geolocation request yet
→ user activates #btn-start
→ splash handleStart()
→ requestSensorPermissions() starts (not awaited by handleStart)
→ if required by platform: await Orientation requestPermission()
→ if required by platform: await Motion requestPermission()
→ getCurrentPosition(low accuracy, timeout 3 s, maximumAge 60 s)
→ handleStart concurrently invokes app _appStart()
→ IMU listeners attach
→ external Leaflet and rotate libraries load
→ map initializes
→ getCurrentPosition(preference accuracy, timeout 10 s, maximumAge 0)
→ startGPS()
→ getCurrentPosition(low accuracy warm-up, timeout 5 s, maximumAge 30 s)
→ watchPosition(preference accuracy, timeout 15 s, maximumAge 2 s)
→ success updates map/status OR watch error maps code 1/2/3 to status text
```

The `requestSensorPermissions()` function is `async`, but `handleStart()` does not await it. On platforms without the Device Orientation/Motion static `requestPermission` methods, the low-accuracy Geolocation call is reached synchronously within the trusted Start click. If either sensor permission method exists, its awaited result precedes the Geolocation call.

DamamMap's default `gpsHighAccuracy` preference is true. Thus the later one-shot and watch normally request high accuracy, while the shared bootstrap and warm-up explicitly request low accuracy.

## 5. Location permission trigger

### Proven by code

- Trigger: click listener on `#btn-start` through `handleStart`.
- First API: `navigator.geolocation.getCurrentPosition`.
- First options: `enableHighAccuracy: false`, `timeout: 3000`, `maximumAge: 60000`.
- First success/error callbacks: both intentionally empty.
- No preceding `navigator.permissions.query`.
- No userActivation check.
- No page-load, `DOMContentLoaded`, `pageshow`, or timer-based first request.
- Later APIs: high-accuracy one-shot, low-accuracy warm-up one-shot, then `watchPosition`.
- Watch options: `enableHighAccuracy: !!highAccuracy`, `timeout: 15000`, `maximumAge: 2000`.
- No non-standard Meta location API was found.

### Retry behavior

There is no error-driven timer retry. There are multiple distinct startup requests, which can look retry-like:

1. shared low-accuracy permission/bootstrap request;
2. app initial request after libraries load;
3. low-accuracy warm-up request;
4. continuous watch.

Changing GPS-related settings can stop and restart the watch. This is user/config-driven restart, not automatic recovery from a permission error.

### Error handling

- Shared bootstrap: success and error callbacks are empty.
- App one-shots: error callbacks are empty.
- Watch: code 1, 2, and 3 map to localized denied, unavailable, and timeout status.
- No permission-state query or special recovery branch follows `PERMISSION_DENIED`.

## 6. Microphone/Sensors permission flow

The shared child Splash code systematically attempts:

1. `DeviceOrientationEvent.requestPermission()` if that static function exists;
2. `DeviceMotionEvent.requestPermission()` if that static function exists;
3. a low-accuracy Geolocation one-shot.

This is a centralized **Sensors + Location** bootstrap used by child apps that load `splash.js`. It is not active in the Hub root as captured.

No `navigator.mediaDevices`, `getUserMedia`, or microphone request was found in the downloaded active public resources. Therefore the public code inspected cannot explain the Microphone row in the user's MRBD permission manager. Plausible explanations include a generic Runtime capability row, another child app or prior origin state, or code outside the explicitly referenced resources inspected here. These remain hypotheses.

## 7. Universal menu and Permissions

### Code evidence

- The website does not implement the MRBD universal menu.
- No web UI matching “Manage permissions” was found.
- Shared child code requests Sensors and Location on Start.
- No microphone request was found.

### True device observation

- DamammApps root: Restart, Resume, Permissions.
- Permissions manager: Microphone, Sensors, Location.
- MRBDMapGameLab root: Restart and Resume only.

### Inference

The Location and Sensors rows plausibly correspond to permission types registered for the shared `www.damamme.com` origin by child Start flows. Same-origin children can plausibly reuse origin permission state. The public code and URL structure are consistent with this, but static assets cannot inspect MRBD's permission database.

### Unknown

It is not known whether the Permissions menu:

- appears only after at least one permission has been requested;
- appears only after a permission has been granted;
- uses an installed-root capability inventory;
- is populated generically by the Runtime;
- aggregates requests made by any same-origin child;
- retains prior state across app deletion/reinstallation.

A controlled before/after permission timeline is required.

## 8. Child app navigation

The Hub and child relationship is:

```text
/damammapps/index.html
→ window.location.href
→ /damammapps/apps/damammap/index.html?t=<timestamp>
```

Findings:

- URL changes: yes.
- Independent HTML document: yes.
- Same origin: yes.
- Browser history entry: expected from normal `location.href` navigation; not directly observable from static code.
- iframe: no.
- SPA route/hash route: no.
- `pushState`/`replaceState`: no.
- `popstate`/`hashchange`: no.
- explicit child Quit UI: `window.location.href = '/damammapps/index.html'`.
- global webpage handling of middle pinch: none found.

The shared `screen.js` has an internal array named `_history`, but it only manages in-document screen IDs. It is not the browser History API and does not explain returning from an independent child document.

## 9. Middle-pinch/back hypothesis

### Mode A — ordinary browser history

**High confidence inference.** Hub-to-child uses normal document navigation, so a browser back entry should exist. No webpage code handles a special middle-pinch event or invokes `history.back()`. The observed child-to-parent behavior is therefore consistent with the Runtime consuming middle pinch as Back when back navigation is possible.

### Mode B — webpage event handling

**Low confidence.** No matching handler was found. `Escape` only cancels a custom confirmation overlay; Backspace belongs to the virtual keyboard. Input handlers cover arrows and Enter, not a system Back gesture.

### Mode C — Runtime-installed root boundary

**Plausible and compatible with Mode A.** The install deep link explicitly declares `/damammapps/index.html` as `appUrl`. The Runtime may recognize that as the app root: at a deeper same-origin document it can go Back, while at the installed root it opens the universal menu. Public web code cannot prove this host rule.

The strongest current model is:

```text
if an in-app browser back entry exists:
    middle pinch is consumed as browser Back
else if current page is the installed app root:
    open the MRBD universal menu
```

This remains an inference until an isolated real-device history test records URL and lifecycle evidence.

## 10. Install deep-link analysis

The install URL uses:

```text
https://facebook.com/fb_viewapp/web_app_deep_link
```

Parameters:

- `appName=DamammApps`
- `appUrl=https://www.damamme.com/damammapps/index.html`

No permission, capability, scope, manifest, app ID, category, or trusted parameter was found. The install page duplicates the same link in a QR code. There was no HTTP redirect among the inspected successful site URLs.

The explicit root URL may be relevant to Runtime root/back behavior. There is no install-link evidence of privileged Geolocation treatment.

## 11. Service Worker, manifest, and headers

- Hub: no manifest link; no Service Worker registration found.
- DamamMap: standard Web App Manifest, relative `start_url: "index.html"`, `display: "standalone"`, icons and visual metadata.
- Manifest: no permission declarations and no explicit scope.
- Service Worker: no registration/reference found in downloaded public text.
- Headers: no Permissions Policy, CSP, Feature Policy, COOP, or COEP.
- iframe delegation: not applicable; no iframe found.

This architecture is not a Service Worker shell/router. DamamMap may qualify as manifest-enabled installable metadata in a general browser, but this capture provides no Service Worker and the DamammApps Hub itself is not manifest-linked.

## 12. What is proven

- The two supplied `/damammap/` URLs return 404; the public Hub's DamamMap path is `/damammapps/apps/damammap/index.html`.
- Hub and DamamMap are same-origin independent documents.
- Hub launches children using `window.location.href`.
- No iframe, SPA History API router, or Service Worker implementation was found.
- The active Hub root does not load the shared permission bootstrap.
- Child Start invokes shared Orientation/Motion permission methods when present, then low-accuracy `getCurrentPosition`.
- DamamMap later uses additional `getCurrentPosition` calls and `watchPosition`.
- No Permissions API preflight or Meta-specific Geolocation API was found.
- No microphone request was found.
- The install deep link contains only `appName` and `appUrl`.
- The exact native-style permission prompt text and button implementation were not found in the complete set of explicitly referenced public text assets inspected.

## 13. What is inferred

- The prompt is MRBD system UI: high confidence.
- The first low-accuracy call on trusted Start is the likely prompt trigger: high confidence.
- Same-origin child requests populate/share an origin-level permission state: medium confidence.
- Middle pinch is Runtime/browser Back in a child and universal-menu activation at the installed root: high confidence, but not directly proven.
- The explicit install root may help the Runtime identify the root navigation boundary: medium confidence.

## 14. What remains unknown

- The exact MRBD permission database state before DamammApps was first opened.
- Whether the user-visible prompt occurred on the Hub itself or after entering/starting a child.
- Whether low accuracy, Start timing, same-origin shell structure, install deep link, a fresh origin, or a combination caused the different MRBD result.
- Whether Orientation/Motion `requestPermission` methods exist in MRBD and affect ordering.
- Whether the universal Permissions menu is generic, request-derived, grant-derived, or installed-root-derived.
- Why Microphone appears despite no microphone request in the inspected active resources.
- Whether middle pinch maps to a browser API event before host consumption.
- Whether permission persists or shares exactly according to standard origin rules in this MRBD Runtime.

## 15. Short relevant code excerpts

Shared child Start permission bootstrap:

```js
requestSensorPermissions();
if (config.onStart) config.onStart();
```

```js
navigator.geolocation.getCurrentPosition(
  () => {}, () => {},
  { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
);
```

DamamMap tracking:

```js
var options = {
  enableHighAccuracy: !!highAccuracy,
  timeout: 15000,
  maximumAge: 2000
};
watchId = navigator.geolocation.watchPosition(
  _onPosition, _onGPSError, options
);
```

Hub-to-child navigation:

```js
url += separator + 't=' + Date.now();
window.location.href = url;
```

These excerpts are limited to the minimum needed to describe call semantics and are not copied into product code.

## 16. Evidence references

- Public asset inventory: `docs/research/damammapps-public-asset-inventory.md`
- DamammApps Hub: `https://www.damamme.com/damammapps/index.html`
- Install page: `https://www.damamme.com/damammapps/install.html`
- Actual DamamMap child: `https://www.damamme.com/damammapps/apps/damammap/index.html`
- Shared permission bootstrap: `https://www.damamme.com/damammapps/lib/splash.js`
- Shared translations: `https://www.damamme.com/damammapps/i18n.json`
- DamamMap app code: `https://www.damamme.com/damammapps/apps/damammap/js/app.js`
- Local device evidence: `docs/results/phase-1b-geolocation-attempt-1.md`, `docs/results/phase-1b-geolocation-attempt-2.md`, and `docs/results/phase-1b-geo-parity-device-template.md`

