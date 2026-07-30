# Phase 1B.4 MRBD Permissions Bootstrap Test

## Purpose

Determine whether a trusted, root-document Sensors + Location request causes MRBD Runtime to register permission categories and add its own **Permissions** item to the Universal Web App menu.

The webpage cannot create that menu item. A missing menu is a valid experimental result.

## Implementation basis and evidence boundary

Version `0.2.3` combines:

- the installed Meta Wearables Webapp plugin v125.0.0 recommendation to include `<meta name="mrbd-web-app-capable" content="yes">`;
- its standard Device Orientation, Motion, and Geolocation API patterns;
- the public DamammApps sequence: trusted Start, sensor permission methods when present, then low-accuracy `getCurrentPosition`;
- the explicit installed-root deep-link pattern.

The plugin says the host handles Geolocation permission, but prior MRBDMapGameLab real-device results returned `PERMISSION_DENIED` without a prompt. Treat the plugin as an implementation pattern, not proof of Runtime behavior. DamammApps itself worked without the MRBD meta tag, so that tag is also not assumed necessary or sufficient.

The Probe does not call `navigator.permissions.query`, `watchPosition`, microphone APIs, a map SDK, or a Meta private API.

## Preconditions

1. Wait for GitHub Pages version `0.2.3` to deploy.
2. Open `https://leafpcye.github.io/MRBDMapGameLab/build-info.js` and record the deployed commit.
3. From the phone, install or re-add the explicit root URL using:

```text
fb-viewapp://web_app_deep_link?appName=MRBDPermissionProbe&appUrl=https%3A%2F%2Fleafpcye.github.io%2FMRBDMapGameLab%2Findex.html
```

4. Confirm the Web App header shows version `0.2.3` and the expected commit.
5. Do not open Location, Motion, or Combined before completing this test.
6. Do not request Microphone.

## Test A — before request

1. Remain on Home.
2. Perform middle pinch.
3. Record whether the Universal Menu contains:
   - Restart;
   - Resume;
   - Permissions.
4. If Permissions already exists, open it and record visible categories and states.
5. Resume the Web App.

## Test B — trusted bootstrap

1. Focus `00 Permissions`.
2. Enter the Probe.
3. Focus **Enable Location + Sensors**.
4. Use Neural Band Enter exactly once.
5. Record any system prompt in exact order:
   - Sensors/Orientation prompt;
   - Motion prompt;
   - Location prompt;
   - no prompt.
6. If a Location prompt appears, run one test per installation/state:
   - Deny;
   - Allow once;
   - Allow.
7. Record the visible Probe fields:
   - Bootstrap;
   - Orientation;
   - Motion;
   - Location;
   - First callback;
   - error code, name, and complete message.
8. Do not press the disabled button again and do not reload before checking the menu.

## Test C — Universal Menu after request

1. Stay on the Permissions Probe internal page; its URL remains root `index.html`.
2. Perform middle pinch.
3. Record whether the Universal Menu now contains Permissions.
4. If present, open it and record:
   - Location row and state;
   - Sensors row and state;
   - Microphone row and state, if shown;
   - any other row.
5. Resume and export the full JSON log.

## Test D — persistence

1. Use Restart, then inspect the Universal Menu again.
2. Close to the MRBD app home and reopen; inspect again.
3. Fully restart MRBD only after the preceding observations are saved; inspect again.
4. Record whether the permission prompt or menu state changed at each boundary.

## Interpretation rules

- Permissions present before request: the test cannot attribute its creation to this run.
- Permissions absent before and present after: strong evidence that the Runtime registered at least one requested category.
- Standard callback success without menu: operation and menu exposure are separate behaviors.
- `PERMISSION_DENIED` without prompt and no menu: the existing origin may remain in a host-level denied state; do not claim the meta tag failed.
- Sensors rows appearing does not prove IMU events work.
- A Microphone row does not prove this Probe requested Microphone.
- Desktop browser prompts are prechecks only.

Complete [the result template](results/phase-1b-permissions-menu-template.md) and stop before changing origin or request semantics.
