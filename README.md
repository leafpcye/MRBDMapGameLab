# MRBD Capability Probe

A minimal, repeatable evidence harness for **Phase 1A** of Meta Ray-Ban Display (MRBD) web-runtime investigation. It records runtime/API presence, raw input events, storage operations, page lifecycle, same-origin network behavior, and log-export attempts.

This repository does **not** contain Location, Motion/Orientation, Audio, speech, AI, maps, routes, game content, accounts, a backend, remote logging, or a native companion. Phase 1B and Phase 1C are not implemented.

Repository: [leafpcye/MRBDMapGameLab](https://github.com/leafpcye/MRBDMapGameLab)

Verified Phase 1A URL: [https://leafpcye.github.io/MRBDMapGameLab/](https://leafpcye.github.io/MRBDMapGameLab/)

Public static deployment was verified on **2026-07-29**: the page and required resources returned the deployed `0.1.0` build at commit `f241cb0`. “Verified” here means only that the GitHub Pages artifact is publicly accessible. It does not establish MRBD Runtime compatibility, Neural Band input behavior, storage persistence, lifecycle behavior, or offline capability.

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
- `tests/`: Node built-in tests for Logger and injected storage adapters.
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

Desktop Chrome/Safari and iPhone Safari results are prechecks only. They must never be reported as MRBD Runtime or Neural Band results. Follow [docs/mrbd-phase-1a-test-plan.md](docs/mrbd-phase-1a-test-plan.md) on real hardware and preserve the exported logs.

The next action is for the user to add the verified URL in Meta AI App and complete the 15–25 minute first-device session. Phase 1B remains out of scope until real-device evidence is returned.
