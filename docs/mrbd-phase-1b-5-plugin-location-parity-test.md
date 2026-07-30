# Phase 1B.5 — Standalone Location Runtime Test

Use:

<https://leafpcye.github.io/MRBDMapGameLab/plugin-location-parity.html>

Open Home **07 Location**, or use the direct URL above. Confirm the page shows `runtime-v1 · 0.2.7`. This standalone document is now the official Location capability entry because it passed all seven controlled cases on MRBD. It remains based on the Meta Wearables plugin's public `navigator.geolocation` examples and does not request Sensors, query the Permissions API, register a Service Worker, load maps, or retain exact coordinates.

## Compact matrix — recommended

1. Fully close and reopen the Web App so the first case is as close to a cold request as practical.
2. Open this parity page.
3. Focus `Run All Location Cases`.
4. Activate it once with Neural Band Enter.
5. Wait until the summary says `Complete`.
6. Record only the final `PASS n/7 · FAIL n/7` line.
7. If any row is `FAIL`, its code, message, elapsed time, and exact options appear beneath that row.
8. Focus `Confirm First Failure` and activate it once. This reruns only the first failed case with a fresh trusted Enter.
9. Choose `Show Evidence JSON` only if the compact result needs to be preserved.

The first matrix request begins in the original trusted Enter stack. Later requests are intentionally sequential and may no longer have active user activation. The confirmation button separates a real option failure from a Host that requires every request to originate from a fresh gesture.

## Preconditions

- MRBD and the paired iPhone are connected.
- iOS Location Services is enabled.
- Meta AI App Location remains `Always` with Precise Location enabled.
- Open the Runtime-owned Permissions menu and record the visible Location state without changing it.
- Keep the page visible until the first callback.

## Test A — Plugin one-shot

1. Fully open the parity URL as the Web App page.
2. Record `API`, `Secure`, `SW controller`, and the current Runtime Location toggle.
3. Focus `1 · One-shot`.
4. Activate it once with Neural Band Enter.
5. Wait at least 17 seconds unless success or error appears sooner.
6. Record Input, Activation, State, callback count, first-callback time, and the complete error or success-presence fields.
7. Choose `Show Evidence JSON` and preserve the selectable text.

The exact request is:

```js
navigator.geolocation.getCurrentPosition(success, error, {
  timeout: 15000
});
```

Do not infer success from API presence or the Runtime menu toggle.

## Test B — Plugin watch

Use a full page reload before this test so no one-shot request remains in the document.

1. Focus `2 · Watch`.
2. Activate it once with Neural Band Enter.
3. Wait at least 20 seconds.
4. Record the same evidence fields.
5. If callbacks continue, observe for up to 60 seconds, then choose `Stop Watch`.
6. Show and preserve the Evidence JSON.

The exact request is:

```js
navigator.geolocation.watchPosition(success, error);
```

## Interpretation

- `PASS 7/7` confirms foreground W3C Geolocation worked in this standalone document during that MRBD session.
- A successful one-shot isolates the earlier failure to request ordering or options in the main Probe.
- A failed one-shot but successful watch means the Host treats the two W3C APIs differently.
- Code 3 indicates a standard timeout observation.
- Code 1 with `User denied Geolocation`, while the Runtime toggle remains enabled, is evidence that the Host-visible toggle and W3C callback state disagree.
- Failure of both exact plugin patterns is evidence against a missing project-side Geolocation option or Meta private API. It does not prove the exact Host, firmware, account, or rollout defect.
- A difference between this page and the retained Legacy main-document probe is evidence of a document/runtime-context boundary; it does not reveal the Host's internal registration rule.

## Result record

- Date/time:
- MRBD firmware:
- Meta AI App version:
- iPhone/iOS:
- Page version:
- Main deployed commit:
- Runtime Location before test:
- One-shot input/activation:
- One-shot result:
- One-shot callback time:
- Watch input/activation:
- Watch result:
- Watch callback time/count:
- Runtime Location after test:
- Evidence JSON saved at:
- Needs retest:
