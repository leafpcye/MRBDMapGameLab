# Phase 1A Capability Matrix

“Present” means an API object was observed. It does not mean the operation works. MRBD values remain **Not tested** until evidence is collected on the real device.

| Capability | Officially documented | Standard browser precheck | Desktop result | iPhone Safari result | MRBD real-device result | Status | Notes |
|---|---|---|---|---|---|---|---|
| Static page load | Not assessed here | Local HTTP smoke test | Passed: six requested resources returned 200; missing path returned 404 | Not tested | Not tested | Pending MRBD real-device test | Localhost only; deployment is outside Phase 1A |
| Runtime metadata | Not assessed here | Environment snapshot | Passed: 37 fields/rows rendered in desktop harness | Not tested | Not tested | Pending MRBD real-device test | API/object presence only |
| Keyboard/input events | Not assessed here | Physical keyboard may precheck logger | Harness passed with synthetic desktop ArrowDown key events | Not tested | Not tested | Pending MRBD real-device test | Synthetic desktop input is not Neural Band evidence |
| Focus navigation | Standard browser behavior | Direction/Enter/Escape harness | Passed at 600×600: Option 1 → Option 2; no horizontal overflow observed | Not tested | Not tested | Pending MRBD real-device test | Probe routing is logged |
| localStorage | Web standard; MRBD behavior not established | Explicit CRUD test | Not tested | Not tested | Not tested | Pending MRBD real-device test | Cross-close and reboot require device steps |
| sessionStorage | Web standard; MRBD behavior not established | Explicit CRUD/reload marker | Not tested | Not tested | Not tested | Pending MRBD real-device test | Session boundaries may vary |
| IndexedDB | Web standard; MRBD behavior not established | Open/write/read/delete/close | Not tested | Not tested | Not tested | Pending MRBD real-device test | Errors retained verbatim |
| Cache Storage | Web standard; MRBD behavior not established | Minimal same-origin response | Not tested | Not tested | Not tested | Pending MRBD real-device test | Test cache is deleted afterward |
| Service Worker | Web standard; MRBD behavior not established | Explicit registration/status | Not tested | Not tested | Not tested | Pending MRBD real-device test | Registration is not offline cold-start proof |
| Lifecycle events | Web event definitions exist | Hide/reload/back-forward precheck | Not tested | Not tested | Not tested | Pending MRBD real-device test | BFCache only from `persisted` evidence |
| Network state | Web standard; weak connectivity signal | `navigator.onLine` + same-origin fetch | Not tested | Not tested | Not tested | Pending MRBD real-device test | Online does not prove internet access |
| Blob download | Web APIs exist | User-triggered download | Not tested | Not tested | Not tested | Pending MRBD real-device test | Click does not confirm save |
| Web Share | Web API; availability varies | Presence + user-triggered call | Not tested | Not tested | Not tested | Pending MRBD real-device test | Final destination must be recorded |
| Clipboard | Web API; permission/context dependent | Explicit copy operation | Not tested | Not tested | Not tested | Pending MRBD real-device test | Errors must be retained |
| Text fallback | Standard DOM controls | Selectable segmented text | Not tested | Not tested | Not tested | Pending MRBD real-device test | Always exposed by app code |
