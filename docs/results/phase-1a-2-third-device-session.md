# Phase 1A.2 Third MRBD Device Session — Recorded Results

These are user-observed real-device results from version `0.1.2`. They are not desktop simulations.

## Public app and navigation

- The public app opened; all six Phase 1A entries were visible.
- Large Text was clear and the header showed version `0.1.2`.
- In the single-column home list, Down moved 01 → 02 → 03 and Up moved normally. Left/Right did not move focus.

## Neural Band input

| Physical action | Runtime `event.key` |
|---|---|
| Up | `ArrowUp` |
| Down | `ArrowDown` |
| Left | `ArrowLeft` |
| Right | `ArrowRight` |
| Index pinch | `Enter` |

Each tested gesture produced one keydown and one keyup: two raw events and one completed pair. The displayed runtime interval was approximately 1–2 ms and is not interpreted as physical hold duration. `KeyboardEvent.code` was empty, so product logic should prefer `event.key`.

Focus descriptors were readable, for example:

```text
button#single-button-test "Activate test button"
```

App Navigation behaved as designed: vertical groups used Up/Down, the horizontal selector used Left/Right, each action moved one item, boundaries did not wrap, and focus was stable.

Index pinch produced Neural Band haptic feedback. Version `0.1.2` did not provide sufficiently explicit visual activation feedback, so click execution was not fully confirmed. No anomaly was observed.

Middle pinch opened the MRBD system menu. Treat it as system-reserved and do not assign it to Cancel.

## Runtime identity observation

Before the scenario:

```text
page: page-f7ad4931…
document boot count: 24
session: session-18416…
```

The user could not scroll back to the top, left to app home, then reopened the Web App. After reopening, page ID and session ID changed and document boot count became 25. Storage, Lifecycle, and Runtime Context identifiers were consistent.

Conclusion:

```text
A new document boot was observed after leaving to app home and reopening.
This test does not isolate middle pinch alone as the cause.
```

Product rule: persist important state frequently; do not use middle pinch as an application Cancel action.
