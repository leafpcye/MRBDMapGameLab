# MRBD Phase 1A.2 — 3–5 Minute Retest

Use:

```text
https://leafpcye.github.io/MRBDMapGameLab/
```

Confirm the header shows version `0.1.2` before testing. Record only visible real-device evidence.

## Test 1 — Home navigation

1. Focus entry 01.
2. ArrowDown: confirm focus moves to 02.
3. ArrowDown again: confirm focus moves to 03.
4. ArrowUp: confirm focus returns to 02.
5. Record Left/Right behavior; in the single-column layout they should not move focus.

Result:

## Test 2 — Input summaries

1. Open Input, select Observe Only, and press Start.
2. Swipe up once.
3. Confirm Last Keydown shows `keydown` and `ArrowUp`.
4. Confirm Last Keyup shows `keyup` and `ArrowUp`.
5. If Runtime code is empty, confirm the UI shows `(empty)`.
6. Confirm Raw keyboard events increases by 2 and Completed key pairs increases by 1.

Result:

## Test 3 — App Navigation

1. Select App Navigation.
2. Reach the Single Button and Vertical List without passing through Raw Events.
3. Move Up/Down in the Vertical List.
4. Reach the Horizontal Selector and move Left/Right.
5. Use Enter to activate the focused option.

Result:

## Test 4 — Middle pinch trace

1. Open Lifecycle and record pageInstanceId and Document boot count.
2. Select Mark Before Middle Pinch.
3. Perform middle pinch, open the MRBD system menu, then return.
4. Record the new pageInstanceId, Document boot count, Lifecycle trace, and evidence interpretation.

Before:  
After:  
Trace:  
Interpretation:

## Test 5 — Runtime consistency

Confirm:

```text
Storage pageInstanceId
=
Lifecycle pageInstanceId
=
Runtime Context pageInstanceId
```

Both Storage and Lifecycle should display:

```text
Runtime context consistency: OK
```

Result:

## Stop point

Stop after Test 5 and return the observations. Do not continue to GPS, IMU, Audio, maps, games, offline cold-start, or full MRBD restart.
