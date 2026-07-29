# MRBD Capability Probe

A minimal, repeatable evidence harness for **Phase 1A.2** of Meta Ray-Ban Display (MRBD) web-runtime investigation. Current Probe version: **0.1.2**. It records runtime/API presence, raw input events, storage operations, page lifecycle, same-origin network behavior, and log-export attempts.

This repository does **not** contain Location, Motion/Orientation, Audio, speech, AI, maps, routes, game content, accounts, a backend, remote logging, or a native companion. Phase 1B and Phase 1C are not implemented.

Repository: [leafpcye/MRBDMapGameLab](https://github.com/leafpcye/MRBDMapGameLab)

Verified Phase 1A URL: [https://leafpcye.github.io/MRBDMapGameLab/](https://leafpcye.github.io/MRBDMapGameLab/)

Public static deployment was verified on **2026-07-29**: the page and required resources returned the deployed `0.1.0` build at commit `f241cb0`. A subsequent user-run MRBD session confirmed that this URL opens on the device, all six entries are visible, four directional actions and index pinch are observed as Arrow/Enter mappings, keydown/keyup and some click events occur, and localStorage survives a normal close/reopen. The exact per-event `key`/`code` evidence, middle-pinch lifecycle mechanism, complete restart persistence, API operations, and offline cold-start remain unverified.

Phase 1A.1 adds an automatically selected, persistent Large Text mode; paged Environment evidence; prominent raw Input fields and key-pair summaries; separate observation/browser/app-navigation modes; a compact lifecycle checkpoint; and a Storage quick summary. These changes require a second MRBD session and must not be treated as validated merely because desktop tests pass.

Phase 1A.2 corrects issues found in that second session. Home direction navigation now uses rendered element rectangles instead of a hard-coded two-column graph. In a visual single column, Up/Down follow DOM order and Left/Right do not move; in two columns, direction keys follow visual rows and columns. Input separates keydown from keyup, raw keyboard-event counts from completed pairs, and places all test controls before a fixed-height raw-event inspector. A single Runtime Context supplies page instance, session, and Document boot count to every module. A bounded, persisted lifecycle trace supports conservative evidence classification across document boots.

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

`npm run dev` automatically regenerates the ignored local `build-info.js`. `npm run build` creates a clean deployable `dist/`, including `.nojekyll`, without tests, documentation, or development scripts.

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
- `modules/`: logger and individual probe responsibilities.
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

## Export logs

Open **Export** and choose JSON, CSV, Web Share, Clipboard, or the always-available selectable text fallback. A download click only proves that the click was triggered; it does not prove where a file was saved. Large text fallback output is split into 50,000-character segments.

Every structured export includes an Environment snapshot, build version, Git commit, logical session ID, page instance ID, and the bounded in-memory event log.

## Evidence boundary

Desktop Chrome/Safari and iPhone Safari results are prechecks only. They must never be reported as MRBD Runtime or Neural Band results. User-run findings are recorded separately for the [first session](docs/results/phase-1a-first-device-session-template.md) and [second session](docs/results/phase-1a-1-second-device-session.md). Follow the short [Phase 1A.2 retest](docs/mrbd-phase-1a-2-retest.md) on real hardware and preserve the exported logs.

The next action is a 3–5 minute Phase 1A.2 MRBD retest. Phase 1B remains out of scope.
