# Phase 1A.1 Second MRBD Device Session — Recorded Results

These are user-observed Meta Ray-Ban Display results from Probe version `0.1.1`. They are not desktop simulations. Unobserved fields remain unclaimed.

## Large Text and Home navigation

```text
Large Text defaulted on: Yes
Readability: Clear and readable
Home visual layout: Single column
Observed ArrowDown from 01: Focus moved to 03
Expected visual neighbor: 02
Left/Right behavior: Continued to follow the old grid relationship
```

Conclusion:

```text
Visual layout and focus navigation graph were inconsistent in version 0.1.1.
```

## Input

| Action | key observed | keydown/keyup pair | latest displayed interval |
|---|---|---|---|
| Swipe up | ArrowUp | Matched | approximately 2 ms |
| Swipe down | ArrowDown | Matched | approximately 2 ms |
| Swipe left | ArrowLeft | Matched | approximately 2 ms |
| Swipe right | ArrowRight | Matched | approximately 2 ms |
| Index-finger pinch | Enter | Matched | approximately 2 ms |

Additional observations:

```text
Last Event Type: Displayed keyup after each tested action
code: No clear code value was visible in the UI
Focus label: Displayed a generic button label
Raw event increase per gesture: 2
Reason visible from evidence: one keydown plus one keyup
```

The approximately 2 ms value is recorded only as the Runtime event interval between observed keydown and keyup. It is not interpreted as the user’s physical hold duration.

Recent Raw Events appeared before the App Navigation controls and kept moving those controls farther down as evidence was rendered. The user could not reach the required controls, so App Navigation was **not completed on MRBD** in this session.

## Middle pinch and lifecycle

Before middle pinch:

```text
Lifecycle current page instance:
page-3c90cb04-c8c2-48db-8523-7137700b07a5

launch count shown by version 0.1.1:
14
```

After middle pinch opened the MRBD system menu and the user returned:

```text
Lifecycle page instance: Observed by the user as unchanged
launch count shown: 15
last lifecycle event: focus
visibility: visible
```

Storage Summary subsequently displayed:

```text
page-f70bde74-b6b1-48f1-b22d-f18b8ac0a21e
```

Result:

```text
Inconclusive because instrumentation identifiers are inconsistent.
```

This evidence does not establish resume, restart, reload, or creation of a new WebView.

## Storage

```text
Existing test value: Still present; user described it as phase-1a
launch count shown by version 0.1.1: 15
previousLaunchAt: 2026-07-29T03:13:25.592Z
Timestamp interpretation: The trailing Z identifies UTC
```

The exact device-local rendering of that UTC instant was not available in version `0.1.1`.

## Required correction

Version `0.1.2` must be retested for responsive focus navigation, separated keydown/keyup summaries, fixed-height Raw Events, App Navigation reachability, shared Runtime Context identity, Document boot count, local/UTC boot time, and persisted lifecycle trace.
