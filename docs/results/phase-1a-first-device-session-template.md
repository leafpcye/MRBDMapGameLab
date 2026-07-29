# Phase 1A First MRBD Device Session — Recorded Results

This document contains user-observed Meta Ray-Ban Display results. Blank or `Not tested` fields were not inferred from desktop checks or API-object presence.

## Device environment

```text
Test date: Not recorded
Tester: User
MRBD version: Not recorded
Meta AI App version: Not recorded
iPhone/iOS: Not recorded
Neural Band connected: Observed in use
Network: Online
Deployed URL: https://leafpcye.github.io/MRBDMapGameLab/
Displayed app version: 0.1.0
Displayed git commit: f241cb0
Session ID: Not recorded
```

Observed Runtime fields:

```text
platform: linux aarch64
isSecureContext: true
User Agent: Android 14 WebView / Greatwhite style
```

The exact User Agent string was not recorded. Environment values marked `Present but not tested` establish object presence only, not an operational result.

## Test results

### Test 1 — Web App open and Environment

```text
Result: Pass
Actual behavior: Public URL opened and the page ran normally.
Six module entries visible: Pass
Displayed version: 0.1.0
Displayed commit: f241cb0
Environment Probe completed: Observed
Readability: Text was noticeably too small on the glasses.
Screenshot or log file: Not recorded
Error: None reported
Retest needed: Yes — verify Phase 1A.1 Large Text
```

### Test 2 — Neural Band basic input

Observed action mappings:

```text
Swipe up: ArrowUp observed
Swipe down: ArrowDown observed
Swipe left: ArrowLeft observed
Swipe right: ArrowRight observed
Index-finger pinch: Enter observed
Middle-finger pinch: Opened the MRBD system menu
```

Session-level observations:

```text
keydown: Observed
keyup: Observed
click: Some click events observed
focus movement: Observed
Prevent Default enabled: Focus did not move
```

The exact per-action `key` and `code` fields were not recorded and are intentionally left unclaimed. Middle pinch was not identified as Escape and is not treated as a reliable application Cancel action. A restart, resume, or other lifecycle transition may have occurred after opening the system menu, but the first session did not distinguish the mechanism.

| Input action | Mapping observed | Per-action keydown/keyup | key field | code field | click | focus movement | system behavior |
|---|---|---|---|---|---|---|---|
| Swipe up | ArrowUp | Not recorded | Not recorded | Not recorded | Not recorded | Observed in session | — |
| Swipe down | ArrowDown | Not recorded | Not recorded | Not recorded | Not recorded | Observed in session | — |
| Swipe left | ArrowLeft | Not recorded | Not recorded | Not recorded | Not recorded | Observed in session | — |
| Swipe right | ArrowRight | Not recorded | Not recorded | Not recorded | Not recorded | Observed in session | — |
| Index-finger pinch | Enter | Not recorded | Not recorded | Not recorded | Some clicks observed in session | Observed in session | — |
| Middle-finger pinch | Not mapped to an app key | Not recorded | Not recorded | Not recorded | Not recorded | Not recorded | Opened MRBD system menu |

### Test 3 — localStorage close and reopen

```text
Result: Pass for normal close/reopen only
Actual behavior: launch count increased after normally closing and reopening the Web App.
Persistence interpretation: localStorage persisted for this observed normal close/reopen scenario.
Value before/after: Exact value not recorded
Launch counts: Exact counts not recorded
MRBD full restart: Not tested
Web App removal/re-add: Not tested
Offline open: Not tested
Error: None reported
Retest needed: Yes — use the Phase 1A.1 Storage Summary
```

### Test 4 — Log export path

| Method | Operation result | Final destination | Notes |
|---|---|---|---|
| Web Share | Not tested | Not tested | API presence is not an operation result |
| Clipboard | Not tested | Not tested | API presence is not an operation result |
| JSON Blob Download | Not tested | Not tested | — |
| Text Fallback | Not tested | Not tested | — |

## API operation summary

| API | Object present | Operation tested | Operation result | Notes |
|---|---|---|---|---|
| localStorage | Observed as accessible | Yes, normal close/reopen | Pass for this scenario | launch count increased |
| sessionStorage | Not recorded | Not tested | Not tested | — |
| IndexedDB | Presence may have been displayed | Not tested | Not tested | presence is not capability |
| Cache Storage | Presence may have been displayed | Not tested | Not tested | presence is not capability |
| Service Worker | Presence may have been displayed | Offline cold-start not tested | Not tested | — |
| Web Share | Presence may have been displayed | Not tested | Not tested | destination unknown |
| Clipboard | Presence may have been displayed | Not tested | Not tested | — |
| Blob Download | Not recorded | Not tested | Not tested | — |

## Next evidence

Run [../mrbd-phase-1a-1-retest.md](../mrbd-phase-1a-1-retest.md) after version `0.1.1` is deployed. Preserve the direct Last Event fields, Pair Summary, lifecycle interpretation, and any exported log.
