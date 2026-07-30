# Phase 1B.5 — Plugin Location Parity Test

Use:

<https://leafpcye.github.io/MRBDMapGameLab/plugin-location-parity.html>

Confirm the page shows `parity-v1 · 0.2.5`. This is an isolated diagnostic page based on the Meta Wearables plugin's public `navigator.geolocation` examples. It does not request Sensors, query the Permissions API, register a Service Worker, load maps, or retain exact coordinates.

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

- A successful one-shot isolates the earlier failure to request ordering or options in the main Probe.
- A failed one-shot but successful watch means the Host treats the two W3C APIs differently.
- Code 3 indicates a standard timeout observation.
- Code 1 with `User denied Geolocation`, while the Runtime toggle remains enabled, is evidence that the Host-visible toggle and W3C callback state disagree.
- Failure of both exact plugin patterns is evidence against a missing project-side Geolocation option or Meta private API. It does not prove the exact Host, firmware, account, or rollout defect.

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
