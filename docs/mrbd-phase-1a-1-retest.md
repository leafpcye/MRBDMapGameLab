# MRBD Phase 1A.1 — 5–10 Minute Retest

Target URL:

```text
https://leafpcye.github.io/MRBDMapGameLab/
```

Before testing, confirm the header shows version `0.1.1` and the commit from the latest deployment. If it still shows `0.1.0`, stop and wait for the Pages deployment or Service Worker update. This retest records real-device evidence only; do not infer unobserved fields.

## Test 1 — Large Text · 1 minute

1. Open the Web App on MRBD.
2. Confirm **Large Text: On** is selected automatically.
3. Check the Home and Input pages.
4. Record whether text is readable or still too small.

Result:  
Observed version / commit:  
Large Text defaulted On:  
Home readable:  
Input readable:  
Notes:

## Test 2 — Input Raw Fields · 2 minutes

1. Open Input, select **Observe Only**, and press **Start**.
2. Perform Up, Down, Left, Right, then index pinch.
3. For each action, record the directly displayed event type, key, code, matched pair, and focused element.
4. Check the Recent Raw Events and Pair Summary.

| Action | type | key | code | pair | focus |
|---|---|---|---|---|---|
| Up |  |  |  |  |  |
| Down |  |  |  |  |  |
| Left |  |  |  |  |  |
| Right |  |  |  |  |  |
| Index pinch |  |  |  |  |  |

Notes:

## Test 3 — App Navigation · 2 minutes

1. Select **App Navigation**.
2. Focus the Vertical List and use Up/Down.
3. Focus the Horizontal Selector and use Left/Right.
4. Use Enter to activate the focused option.
5. Confirm focus still moves even though App Navigation calls `preventDefault()` for handled Arrow/Enter events.

Vertical movement:  
Horizontal movement:  
Enter activation:  
Focus moved after preventDefault:  
Errors:

## Test 4 — Middle Pinch Lifecycle · 2–3 minutes

1. Open Lifecycle.
2. Record current page instance, session, and launch count.
3. Select **Mark Before Middle Pinch**.
4. Perform middle pinch and open the MRBD system menu.
5. Return to the Web App.
6. Record page instance and launch-count changes, pagehide/pageshow, visibility, navigation type, and the displayed evidence-based interpretation.

Before page instance:  
After page instance:  
Before / after launch count:  
pagehide:  
pageshow and persisted:  
visibility evidence:  
navigation type:  
Evidence-based interpretation:  
Notes:

Do not relabel the observation as restart, resume, or reload unless the displayed evidence supports it.

## Test 5 — Storage Summary · 1 minute

1. Open Storage.
2. Confirm whether the current test value is still present.
3. Record launch count, previous launch time, and current page instance.
4. Do not restart MRBD during this short retest.

Current test value:  
Launch count:  
Previous launch time:  
Current page instance:  
Result / notes:

## Stop point

Stop after Test 5. Export a log if practical, then return these observations. Do not continue to GPS, IMU, Audio, maps, games, offline cold-start, or full MRBD restart.
