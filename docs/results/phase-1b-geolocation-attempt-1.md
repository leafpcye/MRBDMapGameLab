# Phase 1B MRBD Geolocation Attempt 1 — Recorded Results

These are user-observed MRBD real-device results from version `0.2.0`. No unobserved coordinate, permission, or callback value is inferred.

## Network observation

- MRBD once continued to show offline while WhatsApp also remained loading.
- After restarting or reopening, Network returned to online.
- This is evidence that an MRBD network-channel outage occurred once.
- The current network has recovered. Geolocation failure is not attributed to VPN.
- GPS itself is not assumed to require an overseas VPN.
- `navigator.onLine` remains only the Runtime-reported state; live same-origin fetch evidence was not separately available in the old probe.

## First Geolocation request

Visible result:

```text
PERMISSION_DENIED: user denied Geolocation
```

Observed context:

- No permission prompt was visible after selecting Get One Position.
- Meta AI location permission on the iPhone was set to Always.
- A desktop browser opening the same page could show website location permission and obtain coordinates.

## Attempt after network recovery

- The user selected Get One Position.
- No visible response, success data, error, or permission prompt appeared.
- Version `0.2.0` could not show whether input activation arrived, the handler was entered, the API call was issued, a request remained pending, or a callback silently failed.

## UI findings

- Important status appeared above controls, making result review difficult after reaching lower buttons.
- The native Preset `<select>` did not open a selectable popup after Enter in the tested MRBD Runtime.
- The long Location page made it difficult to move between controls and diagnostics.

## Conclusion

```text
MRBD Geolocation remains inconclusive.
The old probe cannot distinguish input activation, API call, pending request,
silent rejection, or callback failure.
```

This evidence does not establish that MRBD lacks Geolocation, that VPN is required, that permission was denied again, or that the second API call did not execute.
