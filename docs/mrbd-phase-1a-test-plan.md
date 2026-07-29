# MRBD Phase 1A — First Real-Device Session

Target duration: **15–25 minutes**.

Verified Phase 1A URL:

```text
https://leafpcye.github.io/MRBDMapGameLab/
```

The public static deployment was verified on **2026-07-29** at version `0.1.0`, commit `f241cb0`. The user subsequently completed two MRBD sessions; their facts are recorded in separate result documents. This longer plan is retained for coverage, while version `0.1.2` uses the focused [Phase 1A.2 retest](mrbd-phase-1a-2-retest.md). Do not guess device versions or unrecorded event fields.

Use [results/phase-1a-first-device-session-template.md](results/phase-1a-first-device-session-template.md) while testing. Export after important steps when possible.

## Test 0 — Record device environment · 2 minutes

Record:

- date and local time;
- MRBD system version;
- Meta AI App version;
- iPhone model and iOS version;
- whether Neural Band is connected;
- phone network condition;
- exact Web App URL.

Do not infer or auto-fill any version.

## Test 1 — Open the Web App · 3–5 minutes

1. In Meta AI App, add `https://leafpcye.github.io/MRBDMapGameLab/`.
2. Open it in MRBD.
3. Record whether the homepage is complete and all six module entries are visible.
4. Record displayed App version and Git commit.
5. Open Environment and run **Run Environment Probe**.
6. Export or preserve the Environment evidence.

Success means the page opens, at least one module can be entered, and it does not immediately crash or repeatedly reload. On failure, classify it as: cannot open, white screen, 404, partial display, input inoperable, repeated reload, or exact displayed error.

## Test 2 — Neural Band basic input · 7–10 minutes

Open Input and press **Start**. Leave at least about one second between actions:

1. swipe up;
2. swipe down;
3. swipe left;
4. swipe right;
5. index-finger pinch;
6. middle-finger pinch.

Repeat relevant actions on:

- Single Button;
- Vertical List;
- Horizontal Selector;
- Long List.

Record the actual event type, `key`, `code`, keydown/keyup presence, click, focus movement, system behavior, and the difference between **Observe Only**, **Browser Default**, and **App Navigation**. Do not assume middle-finger pinch maps to Escape or that a missing keyup means a long press.

Press **Stop** and preserve Input evidence.

## Test 3 — localStorage close and reopen · 3–5 minutes

1. Open Storage.
2. Enter `phase1a-reopen-test`.
3. Run the localStorage test.
4. Record the Document boot count and displayed value.
5. Close the Web App normally.
6. Reopen it.
7. Check the value and Document boot count again.
8. Export the available log.

This first session tests only normal close/reopen. Full MRBD restart, IndexedDB depth testing, and offline cold-start are deferred.

## Test 4 — Find a log export path · 3–5 minutes

Try in this order:

1. Web Share;
2. Clipboard;
3. JSON Blob Download;
4. Text Fallback.

For each, record button availability, share panel behavior, copy result, final file/text destination, no response, or exact error name/message.

Priority evidence is the complete JSON log. If that cannot be retrieved, preserve at least:

- Environment Summary;
- screenshot of recent Input events;
- screenshot of Storage status;
- Text Fallback text.

## Test 5 — End marker · 1 minute

1. Open Lifecycle.
2. Add marker:

   ```text
   End of Phase 1A first MRBD session
   ```

3. Attempt one final log export.
4. Return the completed template, logs, screenshots, and any error text.

## Stop point

Stop after Test 5. Do not perform MRBD restart, offline cold-start, Location, Motion/Orientation, Audio, maps, or game tests during this first session.
