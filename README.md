# MRBD Capability Probe

A minimal, repeatable evidence harness for Meta Ray-Ban Display (MRBD) web-runtime investigation. Current Probe version: **0.2.5**. It retains the Phase 1A runtime, input, storage, lifecycle, network, and export probes and adds **Phase 1B foreground-only Location and Motion/Orientation probes**.

This repository does **not** contain background tracking, Audio, speech, AI, maps, routes, POI, game content, accounts, a backend, remote logging, or a native companion. Phase 1B Audio and all later phases are not implemented.

Repository: [leafpcye/MRBDMapGameLab](https://github.com/leafpcye/MRBDMapGameLab)

Verified Phase 1A URL: [https://leafpcye.github.io/MRBDMapGameLab/](https://leafpcye.github.io/MRBDMapGameLab/)

Public static deployment was verified on **2026-07-29**. Subsequent user-run MRBD sessions through version `0.1.2` confirmed that this URL opens on the device, all six Phase 1A entries are visible, four directional actions and index pinch map to Arrow/Enter keys, and keydown/keyup pairs occur. The exact middle-pinch lifecycle mechanism, complete restart persistence, remaining storage operations, and offline cold-start remain unverified.

Phase 1A.1 adds an automatically selected, persistent Large Text mode; paged Environment evidence; prominent raw Input fields and key-pair summaries; separate observation/browser/app-navigation modes; a compact lifecycle checkpoint; and a Storage quick summary. These changes require a second MRBD session and must not be treated as validated merely because desktop tests pass.

Phase 1A.2 corrected responsive focus navigation and lifecycle identity diagnostics. The third device session confirmed the Neural Band mappings, `event.key` evidence, single-column routing, and a new document boot after leaving to app home and reopening. See [the recorded session](docs/results/phase-1a-2-third-device-session.md); it does not isolate middle pinch as the cause of the new boot.

Phase 1B adds manual foreground Location, DeviceMotion, DeviceOrientation, and a combined timeline. It preserves raw measurements, applies editable diagnostic flags without discarding samples, limits UI/log rendering by a selectable sampler, and exports probe-filtered JSON. Object presence and desktop simulation are not MRBD capability results.

Phase 1B.1 addresses an inconclusive MRBD Geolocation attempt. A trusted `Enter` keydown now calls `getCurrentPosition()` directly in the same event stack, while native click remains a separate direct path. Every one-shot request has an ID, explicit state transitions, permission-before/after evidence, activation fields, and a diagnostic watchdog distinct from the standard Geolocation timeout. Location is a five-page instrument panel and no core Phase 1B control uses a native `<select>` popup. Network now reports `navigator.onLine` separately from a timestamped, same-origin `no-store` fetch.

Phase 1B.2 adds the isolated [MRBD Geo Parity page](https://leafpcye.github.io/MRBDMapGameLab/geo-parity.html). It is one self-contained HTML file that starts one high-accuracy `watchPosition()` on `DOMContentLoaded`, without Permissions API preflight, a button, user activation, `getCurrentPosition()`, the existing Location module, maps, or third-party resources. It displays and persists only presence/accuracy/error evidence, never precise latitude or longitude.

Phase 1B.4 adds a root-document **Permissions Bootstrap** Probe based on the installed Meta Wearables Webapp plugin and the public DamammApps comparison. A trusted Enter/click requests Device Orientation and Motion permission when those platform methods exist, then issues one low-accuracy `getCurrentPosition()` with fixed options. Version `0.2.4` preserves that initial result and adds a separate, one-shot, low-accuracy Location verification after the user changes the Runtime-owned menu and resumes. The second stage never repeats Sensors or overwrites the initial evidence. The page cannot create or imitate the system menu, does not request Microphone, and never stores exact coordinates.

Version `0.2.5` adds the isolated [Plugin Location Parity page](https://leafpcye.github.io/MRBDMapGameLab/plugin-location-parity.html). It reproduces the Meta Wearables plugin guidance without the main app, Sensors, Permissions API, Service Worker registration, external scripts, or maps. A trusted Enter/click can run either the plugin's timeout-only one-shot request (`{ timeout: 15000 }`) or its no-options `watchPosition()` pattern. The page records activation, timing, standard errors, coordinate-field presence, and accuracy, but never stores or displays exact coordinates.

## Local development

Node.js is the only prerequisite. No package installation is required.

```bash
npm run dev
```

The server binds only to `127.0.0.1` and prints `http://localhost:4173`. Stop it with Ctrl+C.

```bash
npm test
npm run build-info
npm run build
```

`npm run dev` automatically regenerates the ignored local `build-info.js`. `npm run build` creates a clean deployable `dist/`, including `.nojekyll`, `geo-parity.html`, and `plugin-location-parity.html`, without tests, documentation, or development scripts.

To preview the built site at the same project path used by GitHub Pages:

```bash
npm run preview
```

This serves both `/` and `/MRBDMapGameLab/` locally from `dist/`.

## Build identity

`build-info.js` and `dist/` are generated files and are not tracked by Git. The generator:

1. reads the version from `package.json`;
2. prefers the GitHub Actions `GITHUB_SHA`, shortened to seven characters;
3. otherwise reads the current local Git commit;
4. falls back to `uncommitted` or `unknown` without failing the build.

GitHub Actions generates `dist/build-info.js` from the commit being deployed. It never writes the result back to `main`, avoiding the commit-hash regeneration loop. To inspect the deployed identity, open `build-info.js` below the deployed application path or read VERSION and COMMIT in the app header.

## GitHub Pages deployment

Pushes to `main` and manual workflow dispatches run `.github/workflows/deploy-pages.yml`. The workflow tests, builds, configures Pages, uploads `dist/`, and deploys using only GitHub-maintained Actions.

The application uses relative HTML and module URLs. Its manifest scope, Service Worker registration, cache URLs, navigation fallback, and Network Probe are all contained under `/MRBDMapGameLab/`.

See [docs/deployment.md](docs/deployment.md) for activation, verification, rollback, and Meta AI App steps.

## Project structure

- `index.html`, `styles.css`, `app.js`: 600×600-oriented probe UI and orchestration.
- `geo-parity.html`: isolated, self-contained startup `watchPosition()` parity experiment.
- `plugin-location-parity.html`: isolated, user-activated reproduction of the Meta plugin's one-shot and watch patterns.
- `modules/`: logger, Phase 1A diagnostics, permission bootstrap, Location calculations/probe, IMU sampling/probe, activation feedback, and Runtime Snapshot helpers.
- `sw.js`, `manifest.webmanifest`: minimal versioned app shell.
- `scripts/dev-server.mjs`: localhost-only static server with no-store responses and traversal protection.
- `scripts/generate-build-info.mjs`: reproducible build identity.
- `scripts/build-site.mjs`: dependency-free `dist/` builder.
- `.github/workflows/deploy-pages.yml`: official GitHub Pages artifact deployment.
- `tests/`: Node built-in tests for Logger, injected storage adapters, responsive navigation, Runtime Context, input pairing, lifecycle trace, and evidence classification.
- `docs/`: capability matrix, test catalog, and real-device procedure.
- `docs/results/`: user-provided evidence outputs; no fabricated results.

## Service Worker

Registration is explicit on the Storage page. To remove it, use **Unregister SW**. In desktop browser developer tools, Application → Service Workers can be used to verify or remove the registration. Unregistering does not delete every browser cache; the probe deliberately avoids broad cache deletion.

The Service Worker URL includes the deployed version and commit. That value becomes the app-specific cache version; activation deletes only older caches carrying the `mrbd-map-game-lab-` prefix. It never deletes caches belonging to other applications.

Registration, activation, or a successful desktop offline fetch does not prove MRBD offline cold-start behavior.

The two parity pages do not register or depend on the Service Worker and are not in the app-shell cache. Because they share the main app's origin and scope, an already-registered worker may still control their documents. The worker explicitly passes both pages, including query-string variants, directly to the network without cache storage or `index.html` fallback.

## Export logs

Open **Export** and choose JSON, CSV, Web Share, Clipboard, or the always-available selectable text fallback. A download click only proves that the click was triggered; it does not prove where a file was saved. Large text fallback output is split into 50,000-character segments.

Every structured export includes an Environment snapshot, build version, Git commit, logical session ID, page instance ID, and the bounded in-memory event log. Phase 1B pages also provide filtered Location, IMU, and combined JSON with options, thresholds, sampling rate, markers, summaries, and runtime context.

## Evidence boundary

Desktop Chrome/Safari and iPhone Safari results are prechecks only. They must never be reported as MRBD Runtime or Neural Band results. User-run findings are recorded separately for the [first session](docs/results/phase-1a-first-device-session-template.md) and [second session](docs/results/phase-1a-1-second-device-session.md). Follow the short [Phase 1A.2 retest](docs/mrbd-phase-1a-2-retest.md) on real hardware and preserve the exported logs.

The next action is the controlled [Plugin Location Parity test](docs/mrbd-phase-1b-5-plugin-location-parity-test.md). Previous real-device runs caused the Runtime-owned Permissions menu to appear and retain Location as enabled, but initial, post-menu, restart, high-accuracy, and fresh-origin requests still returned code 1 `PERMISSION_DENIED` / `User denied Geolocation`. Version `0.2.5` isolates the exact Meta plugin call patterns from the existing permission bootstrap. Desktop checks do not establish MRBD permission behavior.
