# MRBD Capability Probe

A minimal, repeatable evidence harness for **Phase 1A** of Meta Ray-Ban Display (MRBD) web-runtime investigation. It records runtime/API presence, raw input events, storage operations, page lifecycle, same-origin network behavior, and log-export attempts.

This repository does **not** contain Location, Motion/Orientation, Audio, speech, AI, maps, routes, game content, accounts, a backend, remote logging, or a native companion. Phase 1B and Phase 1C are not implemented.

## Run locally

Node.js is the only prerequisite. No package installation is required.

```bash
npm run dev
```

The server binds only to `127.0.0.1` and prints `http://localhost:4173`. Stop it with Ctrl+C.

```bash
npm test
npm run build-info
```

`npm run dev` automatically regenerates `build-info.js`. The generator reads the version from `package.json`; it records a short Git commit, `uncommitted` when the repository has no commit, or `unknown` when Git is unavailable.

## Project structure

- `index.html`, `styles.css`, `app.js`: 600×600-oriented probe UI and orchestration.
- `modules/`: logger and individual probe responsibilities.
- `sw.js`, `manifest.webmanifest`: minimal versioned app shell.
- `scripts/dev-server.mjs`: localhost-only static server with no-store responses and traversal protection.
- `scripts/generate-build-info.mjs`: reproducible build identity.
- `tests/`: Node built-in tests for Logger and injected storage adapters.
- `docs/`: capability matrix, test catalog, and real-device procedure.
- `docs/results/`: user-provided evidence outputs; no fabricated results.

## Service Worker

Registration is explicit on the Storage page. To remove it, use **Unregister SW**. In desktop browser developer tools, Application → Service Workers can be used to verify or remove the registration. Unregistering does not delete every browser cache; the probe deliberately avoids broad cache deletion.

Registration, activation, or a successful desktop offline fetch does not prove MRBD offline cold-start behavior.

## Export logs

Open **Export** and choose JSON, CSV, Web Share, Clipboard, or the always-available selectable text fallback. A download click only proves that the click was triggered; it does not prove where a file was saved. Large text fallback output is split into 50,000-character segments.

Every structured export includes an Environment snapshot, build version, Git commit, logical session ID, page instance ID, and the bounded in-memory event log.

## Evidence boundary

Desktop Chrome/Safari and iPhone Safari results are prechecks only. They must never be reported as MRBD Runtime or Neural Band results. Follow [docs/mrbd-phase-1a-test-plan.md](docs/mrbd-phase-1a-test-plan.md) on real hardware and preserve the exported logs.
