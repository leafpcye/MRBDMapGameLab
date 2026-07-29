# Phase 1B.1 MRBD Geolocation Attempt 2 — Recorded Results

These are user-observed real-device facts. No precise coordinate is recorded and no automatic-watch result is inferred.

## Native reference

- Meta native Map displays the user's current position.
- This confirms the phone's location service, Meta AI App permission, and native glasses application path were functioning.
- It does not establish that a third-party MRBD Web App receives the same permission bridge.

## MRBD Web App Quick Test

- Input received: yes
- Input trusted: `true`
- `navigator.userActivation.isActive`: `true`
- `navigator.userActivation.hasBeenActive`: `true`
- Geolocation call entered its standard error callback.
- Error code/name: `PERMISSION_DENIED`
- Original message: `user denied Geolocation`
- Visible website-location permission prompt: none
- Deleting and re-adding the Web App produced the same result.

The iPhone Meta AI location permission was set to Always. Precise Location was enabled or remains a user-side setting to confirm.

## Desktop comparison

- The same website in a computer browser displayed a standard website-location permission prompt.
- After permission, the computer browser obtained a position.
- This is standard-browser evidence only, not an MRBD success result.

## Current conclusion

```text
Trusted manual getCurrentPosition invocation is confirmed.
MRBD host returns PERMISSION_DENIED without a visible prompt.
The leading unknown is the MRBD Web Runtime host permission bridge.
Automatic watchPosition at document startup has not been tested.
```

The Phase 1B.2 parity experiment must remain `Not tested` until the user opens the isolated page on MRBD.
