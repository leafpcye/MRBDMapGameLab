# Phase 1B.5 v0.2.6 Standalone Location Runtime Observation

Reported on 2026-07-30 from a user-run MRBD real-device session.

## Positive standalone evidence

- Plugin-style one-shot:
  - latitude field present: yes;
  - longitude field present: yes;
  - accuracy: `8.855656623840332 m` in the reported run;
  - error code, name, and message: none.
- Plugin-style no-options watch:
  - callback count: `9`;
  - first callback: approximately `163 ms`;
  - latitude and longitude fields present: yes;
  - no error;
  - accuracy varied between callbacks.
- Compact option matrix: `PASS 7/7`.
- After Location succeeded in the standalone document, the Runtime-owned Permissions menu showed Location enabled without the user manually toggling it.

No exact latitude or longitude values were displayed or retained by the Probe.

## Main-document comparison

- After MRBD Restart, the original `00 Permissions` Location request still returned code `1`, `PERMISSION_DENIED`, `User denied Geolocation`, after approximately `3096 ms`.
- `Verify Location After Menu Change` still returned the same error after approximately `3011 ms`.
- The attempted main-document `Balanced` comparison is not treated as reliable evidence because the focus router skipped the visible preset controls, so the user could not verify or change the active options.

Version `0.2.7` fixes that focus-routing defect and moves Home `07 Location` to the successful standalone document. The old main-document page remains available as a labelled Legacy A/B control.

## Interpretation boundary

These observations establish that foreground W3C Geolocation worked in the standalone document on the tested MRBD setup and that all seven tested option combinations worked there. They also establish a repeatable difference from the original main application document. They do not reveal which private Host registration, navigation, document, permission, firmware, or rollout mechanism causes that difference.
