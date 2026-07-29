# MRBD Capability Matrix — Phase 1A Evidence and Phase 1B Test Readiness

“Present” means an API object was observed, not that an operation works. Phase 1A MRBD claims below come only from the user-observed third device session. Location and IMU remain pending real-device test.

| Capability | Officially documented | Standard browser precheck | Desktop result | iPhone Safari result | MRBD real-device result | Status | Notes |
|---|---|---|---|---|---|---|---|
| Static page load | Not assessed here | Static build smoke | Passed | Not tested | Public app opened; six Phase 1A entries visible | Observed on MRBD | Version 0.1.2 session |
| Public HTTPS launch | Web platform | HTTPS response check | Confirmed deployed | Not tested | Confirmed | Observed on MRBD | GitHub Pages URL |
| Secure context | Web platform | `window.isSecureContext` | Confirmed on HTTPS deployment | Not tested | Confirmed by HTTPS app context | Observed on MRBD | Does not imply every privileged API works |
| Large Text | App behavior | Responsive layout | Passed at 600×600 | Not tested | Clear and readable | Observed on MRBD | User observation |
| Single-column home navigation | App behavior | Directional geometry tests | Passed | Not tested | Down 01→02→03; Up normal; Left/Right no move | Observed on MRBD | Boundaries correct |
| Neural Band directions | Not assessed here | Keyboard harness only | Desktop input is not Band evidence | Not tested | Four directions mapped to Arrow keys | Observed on MRBD | Use `event.key` |
| Neural Band index pinch | Not assessed here | Enter harness only | Desktop input is not Band evidence | Not tested | `Enter`; keydown+keyup; haptic observed | Observed on MRBD | Activation execution was not fully confirmed in 0.1.2 |
| Neural Band middle pinch | Not assessed here | Cannot precheck | Not applicable | Not tested | Opened MRBD system menu | Observed on MRBD | Treat as system-reserved |
| Keyboard event pairing | Web standard | Pair tracker tests | Passed | Not tested | Two raw events, one pair; 1–2 ms runtime interval | Observed on MRBD | Not physical hold duration |
| KeyboardEvent.code | Web standard | Raw display | Harness works | Not tested | Empty | Observed on MRBD | Prefer `event.key` |
| App Navigation | App behavior | Focus tests | Passed | Not tested | Vertical Up/Down, horizontal Left/Right, no wrap | Observed on MRBD | One item per action |
| Runtime Context | App behavior | Unit tests | Passed | Not tested | Module IDs consistent | Observed on MRBD | Page/session changed and boot 24→25 after app-home reopen |
| localStorage normal reopen | Web standard | Explicit CRUD | Harness available | Not tested | Persistence confirmed across normal reopen | Observed on MRBD | Full device restart boundary pending |
| IndexedDB | Web standard | Explicit CRUD | Harness available | Not tested | Not tested | Pending MRBD real-device test | Errors retained |
| Service Worker offline cold-start | Web standard | Desktop registration | Harness available | Not tested | Not tested | Pending MRBD real-device test | Registration is not cold-start proof |
| Lifecycle | Web standard | Trace/checkpoint tests | Passed | Not tested | New document identity after app-home reopen | Partially observed | Does not isolate middle pinch |
| Middle pinch application lifecycle | Runtime-specific | Cannot precheck | Not applicable | Not tested | Inconclusive | Pending isolated MRBD test | System menu opening is confirmed; document behavior is not |
| `navigator.geolocation` object | Official capability documented; operation still requires evidence | Presence + injected adapter | Present in desktop browser | Not tested | Present | Object confirmed / operation inconclusive | Object presence is not success |
| First MRBD Geolocation request | Official capability documented | Trusted-trigger harness | Desktop site can prompt and return coordinates | Not tested | `PERMISSION_DENIED` without visible prompt | Inconclusive | Meta AI iPhone permission was Always |
| Second MRBD Geolocation request | Official capability documented | Request state machine tests | Implemented for test | Not tested | No observable response with old instrumentation | Inconclusive | Cannot distinguish activation, call, waiting, rejection, or callback failure |
| Trusted Enter direct-call quick test | App diagnostic | Injected trusted-event tests | Passed | Not tested | Not tested | Next validation | Version 0.2.1 calls API in trusted keydown stack |
| Location diagnostic flags | App behavior | Haversine/threshold tests | Implemented for test | Not tested | Not tested | Implemented for test / MRBD result pending | Raw values retained |
| `navigator.onLine` | Web standard | Compared with live fetch | Instrumented | Not tested | Offline was observed during one concurrent WhatsApp failure; later online | Not reliable alone | Actual MRBD network-channel outage was observed once |
| Same-origin live fetch | Web standard | Timestamped `no-store` fetch | Implemented for test | Not tested | Not tested with revised probe | Pending revised probe | Separates Runtime report from fetch evidence |
| HTML select popup | Web standard; Runtime behavior varies | Native control | Desktop popup available | Not tested | Did not open in tested MRBD Runtime | Do not use for core MRBD interaction | Phase 1B presets now use buttons |
| DeviceOrientationEvent | Web standard; varies | Simulated event | Implemented for test | Not tested | Not tested | Implemented for test / MRBD result pending | Compass meaning unvalidated |
| DeviceMotionEvent | Web standard; varies | Simulated event | Implemented for test | Not tested | Not tested | Implemented for test / MRBD result pending | Sensor source not inferred |
| Combined Location + IMU | App behavior | Desktop harness | Implemented for test | Not tested | Not tested | Implemented for test / MRBD result pending | Foreground only |
| Phase 1B filtered export | Web APIs vary | JSON/download attempt | Implemented for test | Not tested | Not tested | Implemented for test / MRBD result pending | Destination must be observed |
