# Phase 1B.1 MRBD Geolocation Retest — 2–3 Minutes

Use:

```text
https://leafpcye.github.io/MRBDMapGameLab/
```

1. Confirm the header shows version `0.2.1` and record the commit.
2. Open Location and confirm Preset uses three ordinary buttons, not a native popup.
3. Keep Page 1 `Request` visible and focus **MRBD Geolocation Quick Test**.
4. Perform one index-finger pinch.
5. Copy the one-screen evidence:
   - Last input and `isTrusted`;
   - user activation active / has-been-active;
   - handler entered;
   - Geolocation call issued;
   - permission before and after;
   - request ID, state, transition, and elapsed time;
   - success, standard error, or `client-timeout`.
6. If successful, record only accuracy and whether latitude/longitude fields exist. Do not put precise coordinates in public documentation.
7. Return Home, open Network, and select **Run Same-Origin Live Fetch** once. Record Runtime `navigator.onLine`, live-fetch result, interpretation, HTTP status, and error if present.
8. Stop. Do not start Watch, walk, run Combined, background the app, turn off the screen, or lock the phone.

The retest succeeds as a diagnostic if it clearly distinguishes the trusted input, handler entry, API call, and terminal or waiting state. It does not require Geolocation itself to succeed.
