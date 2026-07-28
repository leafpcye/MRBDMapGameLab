# MRBD Phase 1A — First Real-Device Test Plan

Do not fill expected event names from desktop assumptions. Before each test, record app version, Git commit, short session ID, tester, device/software versions, date/time, and network condition. Export after each test where possible.

**Deployment entry point:** `https://leafpcye.github.io/MRBDMapGameLab/`

Before using it on MRBD, confirm the URL returns the intended build. Until the GitHub Pages workflow is verified, record its status as `Pending GitHub Pages activation`.

## Test 1 — First open

**Preconditions:** MRBD and paired iPhone are online; the deployed Phase 1A URL above has been verified in a desktop precheck; no MRBD result has been assumed.

**Steps:**

1. From Meta AI App, attempt to open/add the Web App.
2. Record whether a page appears and where.
3. Open Environment and run the probe.
4. Review, but do not interpret API presence as working capability.
5. Export JSON; if unavailable, use Clipboard or Text fallback.

**Expected observations:** Load outcome, visible dimensions, runtime values, API presence labels, page/session/build identity, export behavior.

**Success criteria:** The page is operable and evidence can be read or extracted.  
**Failure criteria:** It does not open, becomes inoperable, or no evidence can be captured. Record the exact screen/error.  
**Actual result:** ______________________________  
**Log file/location:** __________________________  
**Retest needed:** Yes / No — reason: __________________

## Test 2 — Neural Band input

**Preconditions:** Input page visible; press Start. Run once with navigation-default prevention Off, then repeat selected actions with it On.

**Steps:**

1. Perform Up, Down, Left, Right separately.
2. Perform index-finger pinch, then middle-finger pinch.
3. Perform rapid repeated actions.
4. Repeat across A Single Button, B Vertical List, C Horizontal Selector, and D Long List.
5. Observe focus, selection, scroll, total events, raw fields, and keydown/keyup pairing.
6. Press Stop and export logs.

**Expected observations:** Whatever raw events actually occur; control and focus before/after; whether keyup pairs exist; boundary and scroll behavior. Do not preassign event names to gestures.

**Success criteria:** The observed event stream and focus effects are distinguishable and exportable.  
**Failure criteria:** Actions create no evidence, focus is lost without recovery, app locks, or logs cannot be exported. “No event” is still a meaningful device result.  
**Actual result:** ______________________________  
**Log file/location:** __________________________  
**Retest needed:** Yes / No — reason: __________________

## Test 3 — Close and reopen

**Preconditions:** Web App open; note current session, page instance, launch count.

**Steps:**

1. Storage → enter a unique value and run localStorage test.
2. Record the value and launch count.
3. Close the Web App using the normal MRBD flow.
4. Reopen it from the same entry point.
5. Run localStorage test without replacing the expected value first; inspect launch metadata.
6. Export Environment, Storage, and Lifecycle evidence.

**Expected observations:** Whether value, launch count, session, and page instance persist/change.  
**Success criteria:** Actual persistence behavior is unambiguously recorded.  
**Failure criteria:** App crashes, values cannot be inspected, or behavior cannot be distinguished.  
**Actual result:** ______________________________  
**Log file/location:** __________________________  
**Retest needed:** Yes / No — reason: __________________

## Test 4 — MRBD restart

**Preconditions:** Device charged; unique localStorage value recorded.

**Steps:**

1. Write the value using the localStorage test.
2. Lifecycle → enter and record `Before MRBD restart`.
3. Restart MRBD using its normal user procedure.
4. Reopen the same Web App.
5. Record build/session/page/launch identities and run localStorage test.
6. Export all available evidence.

**Expected observations:** Actual survival/loss of stored state and available lifecycle evidence; a pre-restart unload event is not assumed.  
**Success criteria:** Post-restart state is observed and labeled.  
**Failure criteria:** Reopen or evidence extraction is impossible.  
**Actual result:** ______________________________  
**Log file/location:** __________________________  
**Retest needed:** Yes / No — reason: __________________

## Test 5 — Service Worker and offline

**Preconditions:** Online; use the exact same origin/URL throughout.

**Steps:**

1. Storage → Register Service Worker.
2. Record scope, installing/waiting/active, and controller.
3. Close the page.
4. Disconnect the relevant network path.
5. Attempt to reopen from the normal MRBD entry point.
6. Record blank/error/content behavior and whether it was a warm or cold launch.
7. Reconnect and export logs; use Update/Unregister only if needed.

**Expected observations:** Actual registration states and actual offline reopen behavior. Offline success is not presumed and registration alone is not counted as success.

**Success criteria:** The offline outcome can be clearly classified with evidence.  
**Failure criteria:** Outcome is ambiguous or falsely inferred from registration.  
**Actual result:** ______________________________  
**Log file/location:** __________________________  
**Retest needed:** Yes / No — reason: __________________

## Test 6 — Log export routes

**Preconditions:** Generate Environment plus at least five Input/Lifecycle events.

**Steps:**

1. Try JSON download.
2. Try CSV download.
3. Try Web Share.
4. Try Copy Summary and Copy Full JSON.
5. Try Show Export Text and navigate segments if present.
6. For each, record where evidence appears: MRBD, iPhone, share panel, download directory, no response, or error.

**Expected observations:** API presence, click/invocation, resolved/rejected promise, exact error, and real final destination. A resolved action is not automatically a confirmed saved file.

**Success criteria:** At least one route produces retrievable evidence and every attempted route is honestly classified.  
**Failure criteria:** No route retrieves evidence or the final destination cannot be established.  
**Actual result:** JSON ______ CSV ______ Share ______ Clipboard ______ Text ______  
**Log file/location:** __________________________  
**Retest needed:** Yes / No — reason: __________________
