# Phase 1B.2 MRBD Geo Parity Test — 2–3 Minutes

## Preconditions

- Wait for the GitHub Pages workflow for version `0.2.2` to succeed.
- On a computer, confirm this exact page returns `MRBD GEO PARITY`:

```text
https://leafpcye.github.io/MRBDMapGameLab/geo-parity.html
```

- In Meta AI App, add that complete URL as an independent Web App entry.
- Do not use the main Probe URL for this test.

## One foreground test

1. Open the new **MRBD Geo Parity** Web App.
2. Do not click, pinch, or press anything.
3. Wait up to 35 seconds.
4. Record exactly what the page shows:
   - API;
   - Secure;
   - Network;
   - SW controller;
   - Call;
   - State;
   - Callbacks;
   - Time to first callback;
   - latitude present;
   - longitude present;
   - accuracy;
   - speed;
   - heading;
   - altitude;
   - error code;
   - error name;
   - complete error message.
5. Close the Web App and open it once more.
6. Record `Previous result`.
7. Stop.

Do not walk, background the app, run IMU/Combined probes, or repeat the request. Do not record exact latitude or longitude in the result document.

## Evidence boundary

This page starts one `watchPosition()` directly on `DOMContentLoaded`. It does not query Permissions API, wait for user activation, call `getCurrentPosition()`, import the existing Location Probe, or load a map.

The page does not register or depend on a Service Worker. Because it shares the main app's origin and scope, an existing project worker can still make `SW controller` show `yes`; that worker explicitly passes this page straight to the network. This is not a new-origin, no-worker test.

Use [the device result template](results/phase-1b-geo-parity-device-template.md). A desktop result is only a standard-browser precheck and is not MRBD evidence.
