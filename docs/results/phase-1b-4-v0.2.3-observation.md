# Phase 1B.4 v0.2.3 MRBD Observation

Reported on 2026-07-30 from a user-run MRBD real-device session.

## Observed

- The Universal Menu did not contain Permissions before the Bootstrap.
- `00 Permissions` produced:
  - Orientation: `granted`;
  - Motion: `granted`;
  - initial Location: `error`;
  - first callback: approximately `2876 ms`;
  - error name: `GeolocationPositionError`;
  - error message: `User denied Geolocation`;
  - options: `enableHighAccuracy:false`, `timeout:3000`, `maximumAge:60000`.
- After the Bootstrap, the Runtime-owned Permissions menu appeared.
- Its initial rows showed Sensors enabled, Location disabled, and Microphone disabled.
- The user enabled all three rows and resumed.
- `07 Location` still returned code `1`, `PERMISSION_DENIED`, `User denied Geolocation`.
- Restart did not change the callback result; the menu rows remained enabled.
- iOS Location Services was enabled.
- Meta AI App Location was `Always` with Precise Location enabled.
- A fresh HTTPS origin returned the same Location error.

## Evidence boundary

The initial low-accuracy Location request completed before the newly created menu could be changed. The later `07 Location` request used the page's default high-accuracy preset, so v0.2.3 did not perform an identical low-accuracy post-menu comparison.

Version `0.2.4` adds that missing one-shot comparison. Its result is pending MRBD real-device test.
