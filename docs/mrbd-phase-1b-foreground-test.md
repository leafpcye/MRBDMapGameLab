# MRBD Phase 1B Foreground Test — 15–20 Minutes

Use [https://leafpcye.github.io/MRBDMapGameLab/](https://leafpcye.github.io/MRBDMapGameLab/) and confirm version `0.2.1`. Complete the short Phase 1B.1 Geolocation retest before this longer test. Keep the Web App visible. Do not lock the phone, background the app, or infer capability from API presence.

## Test 0. Environment — 1 minute

Record version `0.2.1`, commit, MRBD version, Meta AI App version, iPhone/iOS model/version, Neural Band, network, test time, weather, and a general location type such as “open park.” Do not record an exact home address in public Git documentation.

Open Environment, run the probe, and record page ID, session ID, document boot count, and API presence for geolocation, DeviceMotionEvent, and DeviceOrientationEvent.

Success: identity fields and presence states are visible.
Failure: page cannot open, controls cannot be focused, or an uncaught error appears.

## Test 1. One-shot location — 1 minute

1. Open Location.
2. Leave High Accuracy selected.
3. Select Get One Position and respond to the permission prompt.
4. Record whether it succeeded, latency, accuracy, whether latitude/longitude exist, speed, heading, altitude, timestamp, receive time, flags, or the exact error. Keep precise coordinates only in the private exported log.
5. Add marker `one-shot complete`.

Success: a position or a named code 1/2/3 error is logged.
Failure: no position, error, or visible status is produced.

## Test 2. Stationary location — 2–3 minutes

1. Start Watch while stationary.
2. Remain still for 2–3 minutes with the page visible.
3. Review sample count, interval, accuracy, cumulative distance, flagged distance, and flags.
4. Add marker `stationary end`, then Stop Watch.

Success: samples or explicit errors are recorded and the watch stops.
Failure: unbounded UI growth, freeze, or no observable response.

## Test 3. Foreground walk — 5–10 minutes

1. Add marker `walk start`; Start Watch.
2. Walk for about 5–10 minutes while the Web App remains foreground.
3. Add marker `walk end`; Stop Watch.
4. Export Location JSON.

Observe raw distance separately from flagged-distance impact. Diagnostic flags are not automatic rejection criteria.

## Test 4. Sensor source comparison — about 2 minutes

1. Open Motion / Orientation.
2. Select Request Sensor Permission once and record both results.
3. Start Both, then apply these markers for 5–10 seconds each: `Baseline — both still`, `Move head only`, `Move phone only`, `Rotate head left/right`, and `Nod head up/down`.
4. Stop All and record which fields visibly changed for each marker.

Record alpha/beta/gamma as rotation values; compass meaning is unvalidated. Do not infer which physical device supplies the sensor.

## Test 5. Combined — 2–3 minutes

1. Open Combined and select Start Location + IMU.
2. Walk for about 2–3 minutes while keeping the Web App foreground.
3. Add a combined marker, confirm all three callback families continue, sample ages update, the page does not stall, and errors remain visible.
4. Stop and export Combined JSON.

Success: both probes reuse their existing controls/data and the combined evidence shares runtime identity.
Failure: one probe cannot stop, permissions are requested automatically, or data becomes unbounded.

## Preserve evidence

Export Location JSON, IMU JSON, Combined JSON, and the complete Phase 1A Export JSON. Record destinations and filenames in [the blank result template](results/phase-1b-first-device-session-template.md).

Stop after this foreground test. Do not continue into background lifecycle, Audio, maps, routes, or game work.
