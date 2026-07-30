# Phase 1A / 1B Test Catalog

Each run should record the environment, build identity, session/page IDs, and the requested module log. “Success” below means the harness produced observable evidence; it is not a claim of general MRBD support.

## Phase 1B foreground probes

| Test ID | Objective | Preconditions | Operation | Success criteria | Failure criteria | Exported evidence | Environments |
|---|---|---|---|---|---|---|---|
| LOC-01 | One-shot foreground position | User gesture available | Select preset; Get One Position | Position or named raw error | No observable result | Location JSON | Desktop precheck, iPhone, MRBD |
| LOC-02 | Watch/session statistics | Permission outcome known | Watch; stationary; marker; stop | Samples/errors and clean stop | Freeze or unbounded UI | Records, summary, markers | Desktop precheck, iPhone, MRBD |
| LOC-03 | Diagnostic flags | Thresholds visible | Short foreground walk | Raw and flagged distance retained | Raw data discarded | Options, thresholds, records | Desktop precheck, MRBD |
| IMU-01 | Orientation events | Explicit permission button | Request; rotate/tilt; marker | Samples or explicit absence/error | Silent failure | Orientation entries | Desktop simulation, iPhone, MRBD |
| IMU-02 | Motion events | Explicit permission button | Stationary/move/walk | Raw/emitted counts visible | Uncontrolled rendering | Motion entries/stats | Desktop simulation, iPhone, MRBD |
| IMU-03 | UI/log sampler | Events available | Repeat at 5/10/20 Hz | Rates/dropped count shown | Claims hardware frequency control | IMU JSON | Desktop simulation, MRBD |
| COM-01 | Shared timeline | Probes ready | Start; markers; stop | Common context and ages | Cannot stop | Combined JSON | Desktop simulation, MRBD |
| PERM-BOOT-01 | Determine whether trusted Sensors + Location requests register the MRBD Universal Menu Permissions item | Version 0.2.3 installed at explicit root `index.html`; request not yet run in this document | Open 00 Permissions; record menu before; Enter once; record prompt/callback; middle pinch and inspect menu | Exact request and terminal/waiting evidence is visible; menu result is recorded without assuming success | Silent stage, duplicate request, fabricated menu claim, or missing error details | Full JSON plus Phase 1B.4 result template | Desktop harness, MRBD |
| GEO-DIAG-01 | Distinguish trusted input from Geolocation callback | Version 0.2.1; Location Request page | Focus Quick Test; trusted Enter once | Request ID shows trusted input, handler entry, call issued, and terminal/waiting state | Any stage remains unobservable | Full JSON + one-screen transcription | Desktop harness, MRBD |
| GEO-PARITY-01 | Compare automatic startup `watchPosition` with the confirmed manual path | Version 0.2.2; direct parity-page URL; foreground | Open the independent Web App and wait up to 35 seconds without input | Page shows issued call plus success or an unmodified standard error callback | API missing, synchronous exception, or no callback after the observation window; retain the exact state | One-screen transcription and result template; no exact coordinates | Desktop precheck, MRBD |
| NET-DIAG-01 | Separate Runtime network state from live fetch | Network page open | Run timestamped same-origin live fetch | Both dimensions and interpretation are shown | `navigator.onLine` treated as sole conclusion | Network module entries | Desktop, MRBD |

## Phase 1A probes

| Test ID | Objective | Preconditions | Operation | Success criteria | Failure criteria | Exported evidence | Environments |
|---|---|---|---|---|---|---|---|
| ENV-01 | Capture runtime/page metadata | Page loaded | Environment → Run | All requested fields recorded without app crash | Missing snapshot or uncaught error | JSON Environment snapshot | Desktop, iPhone, MRBD |
| ENV-02 | Inventory API objects | ENV-01 | Review presence matrix | Each item says Present but not tested or Missing | “Supported” inferred from presence | JSON Environment snapshot | Desktop, iPhone, MRBD |
| INP-01 | Capture raw key events | Input page; Start pressed | Perform one control action | Raw event fields and target/focus recorded | No evidence or app crash | Input module JSON/CSV | Desktop precheck, MRBD |
| INP-02 | Assess keydown/keyup pairing | INP-01 | Press/release controls | Pair and duration shown only when matching keyup exists | Missing keyup mislabeled as long press | Input module JSON | Desktop precheck, MRBD |
| INP-03 | Exercise focus structures | Input running | Single, vertical, horizontal, long list | Focus/selection changes remain visible and logged | Focus disappears or wraps unexpectedly | Input + UI events | Desktop precheck, MRBD |
| STO-01 | localStorage CRUD/persistence marker | API accessible | Run localStorage test | Write/read/update/delete/JSON results recorded | Exception or mismatched value | Storage log + later reopen log | Desktop, iPhone, MRBD |
| STO-02 | sessionStorage CRUD/reload marker | API accessible | Run, reload, run again | Prior reload marker is observable if retained | Exception or unexpected loss | Storage + Lifecycle logs | Desktop, iPhone, MRBD |
| STO-03 | IndexedDB minimal transaction | API present | Run IndexedDB test | Open/store/write/read/delete/close recorded | Any step error; include name/message | Storage JSON | Desktop, iPhone, MRBD |
| STO-04 | Cache Storage minimal operation | API present | Run Cache Storage test | Create/write/read/delete recorded | Error or incorrect body | Storage JSON | Desktop, iPhone, MRBD |
| SW-01 | Register and inspect Service Worker | Secure context or localhost | Register SW | Scope/state/controller evidence shown | Registration exception | Storage + Lifecycle JSON | Desktop, iPhone, MRBD |
| SW-02 | Check update/unregister | SW-01 | Update, then explicit unregister | Real result booleans/states shown | Exception hidden or caches broadly cleared | Storage JSON | Desktop, iPhone, MRBD |
| LIFE-01 | Capture load/reload lifecycle | Fresh page load | Open/reload page | Available events logged with IDs/timing | IDs absent or sequence ambiguous | Lifecycle JSON | Desktop, iPhone, MRBD |
| LIFE-02 | Capture hide/restore/BFCache evidence | Lifecycle listeners active | Hide, switch, back/forward | Events and `persisted` flags retained | BFCache claimed without event evidence | Lifecycle JSON | Desktop, iPhone, MRBD |
| NET-01 | Same-origin static fetch | App server reachable | Run with Use cache | Start/end/status/error recorded | Third-party request or hidden error | Network JSON | Desktop, iPhone, MRBD |
| NET-02 | Cache-bypass fetch | NET-01 | Enable Bypass cache; run | Cache option and unique URL recorded | SW source guessed | Network JSON | Desktop, iPhone, MRBD |
| EXP-01 | JSON download attempt | At least one event | Download JSON | Blob availability/click attempt logged | Save falsely asserted | Export log + located file | Desktop, iPhone, MRBD |
| EXP-02 | CSV download attempt | At least one event | Download CSV | Quoted CSV and attempt evidence produced | Invalid columns/escaping | Export log + located file | Desktop, iPhone, MRBD |
| EXP-03 | Web Share attempt | Share API present | User presses Web Share | Resolution or exact exception logged | Auto-open or destination guessed | Export log + destination note | iPhone, MRBD; desktop if present |
| EXP-04 | Clipboard attempts | Clipboard API/permission | Copy summary/full JSON | Completion or exact exception logged | Silent failure | Export log | Desktop, iPhone, MRBD |
| EXP-05 | Text fallback | Page loaded | Show Export Text | Selectable text shown; large data segmented | Entire huge log freezes UI | Export log + copied text | Desktop, iPhone, MRBD |
