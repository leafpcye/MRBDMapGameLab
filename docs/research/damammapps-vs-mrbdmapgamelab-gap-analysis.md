# DamammApps / DamamMap vs MRBDMapGameLab Gap Analysis

## Comparison

| Item | DamammApps / DamamMap | MRBDMapGameLab | Possible impact | Confidence |
|---|---|---|---|---|
| Install entry | Facebook `web_app_deep_link` with explicit Hub `index.html` | Added from public GitHub Pages URL; exact host install flow not captured here | May affect installed-root recognition, not proven to grant permissions | Medium |
| Actual startup URL | `/damammapps/index.html` | `/MRBDMapGameLab/` | Explicit file root may affect root boundary; no privilege evidence | Low–medium |
| Root shell | Hub registry with independent child documents | Single probe shell plus linked parity page | Provides real navigation history and a stable installed root | High |
| Child page | `/damammapps/apps/damammap/index.html?t=...` | `/MRBDMapGameLab/geo-parity.html` can be opened directly | DamamMap is normally reached after Hub history; parity may start as root/direct entry | High |
| Origin | Hub and children share `https://www.damamme.com` | Main and parity share `https://leafpcye.github.io` | Same-origin permission reuse is plausible in both; origin history/state differs | Medium |
| Manifest | Hub none; DamamMap standard manifest | Project manifest linked from main app | No permission declaration found in either | High |
| Service Worker | No registration found in inspected DamammApps/DamamMap text | Project has SW, but parity intentionally has no registration/controller | Current parity result already had no controller, so SW is unlikely to explain it | High |
| First location timing | Trusted Start click in child | Main quick test: trusted Enter; parity: automatic `DOMContentLoaded` | DamamMap combines a trusted child Start with a permission bootstrap | High |
| First API | Low-accuracy `getCurrentPosition` | Main quick test: `getCurrentPosition`; parity: `watchPosition` | API type alone is not unique; low-accuracy-first semantics remain untested locally | High |
| First options | `false / 60000 / 3000` | Quick test options differ; parity `true / 5000 / 30000` | Low accuracy and short timeout may trigger a different host path or use cached position | Medium |
| Later APIs | High-accuracy one-shot + low-accuracy warm-up + high-accuracy watch | Main has explicit probes; parity has one high-accuracy watch only | DamamMap makes several independent startup attempts | High |
| Permission preflight | No `navigator.permissions.query` | Parity none; main can observe permission state in broader probe | Not the differentiator for parity | High |
| User activation | Start click; sensor calls and first location request originate there | Trusted Enter confirmed in quick test; parity does not wait | User activation alone already failed locally; timing sequence may still matter | High |
| Low accuracy first | Yes | Not yet tested as an isolated first call with exact options | Strongest untested call-semantic difference | High |
| Runtime initialization wait | Waits for user Start; no fixed delay | Parity calls at DOMContentLoaded; quick test waits for user | Delay/state readiness may matter, but trusted manual local call also failed | Medium |
| Error handling | Bootstrap and one-shots suppress errors; watch shows code status | Detailed errors/logging | Presentation differs, not permission acquisition itself | High |
| Retry | No error-driven retry; multiple startup requests | Parity exactly one watch; main user-driven probes | Multiple attempts may expose prompt/state changes hidden by empty callbacks | Medium |
| Navigation history | Hub `location.href` to child | App routes mostly in one document; parity may be direct URL | Explains middle-pinch behavior more than Geolocation permission | High |
| iframe | None | None | Not a differentiator | High |
| Deep link | Only `appName` and `appUrl` | Exact installation path needs controlled comparison | May define app root; no special capability parameter | High for structure, low for permission |
| Response headers | No special permission/security policy headers found | GitHub Pages standard headers | No evidence headers enable DamamMap | High |
| Permission UI | Native-style prompt observed; no matching public UI implementation | No prompt, then TIMEOUT/PERMISSION_DENIED | Confirms different host permission state/path | High |
| Permissions menu | Root menu shows Microphone/Sensors/Location after observed use | Root menu has no Permissions | Strong evidence of different Runtime permission registration state | High |
| Sensors | Shared child Start requests Orientation/Motion permission if supported | Separate Motion/Orientation probes; not part of parity | Central sensor+location bootstrap may populate menu categories | Medium |
| Microphone | No request found in inspected active resources | Not requested by design | DamammApps Microphone row remains unexplained | High that code is absent; cause unknown |
| Map dependency | Leaflet loads after Start; permission bootstrap begins before it completes | No map | Map SDK is not required to trigger the initial permission request | High |

## Most likely differences, prioritized

### 1. Fresh-origin permission state plus a trusted low-accuracy-first child Start

**Confidence: medium-high.**

DamamMap's first location call is a low-accuracy `getCurrentPosition` inside the Start click flow. MRBDMapGameLab has tested a trusted manual call and an automatic high-accuracy watch, but not this exact first-call combination. Because deleting/re-adding the local app did not reset permission state, the different origin's prior state may be as important as the call itself.

### 2. Installed root plus real same-origin child navigation

**Confidence: medium.**

DamammApps is installed at an explicit Hub `index.html`, then uses normal full navigation to a deeper same-origin child. This clearly explains the observed back/root-menu hierarchy and may affect when the Runtime associates permission registrations with an installed app. There is no evidence that it grants privileged access by itself.

### 3. Multiple coordinated startup requests

**Confidence: medium-low for prompt acquisition; high that the code differs.**

DamamMap issues a low-accuracy bootstrap, later one-shot calls, and a watch. A prompt could be triggered by the first call and later calls then benefit from the result. This does not mean “retry until success”; most error callbacks are empty, so visible behavior obscures which request caused what.

## Differences worth reproducing

- Exact first-call semantics: trusted Start, low accuracy, `timeout: 3000`, `maximumAge: 60000`.
- Explicit installed root followed by an ordinary same-origin link/history child.
- A controlled request timeline that records each request separately rather than suppressing callbacks.
- Before/after screenshots of the root universal menu and permission manager.

## Differences not worth reproducing

- Leaflet, map tiles, route APIs, or map UI. The first permission request precedes map library completion.
- DamammApps account/authentication code.
- Empty error callbacks; diagnostics should remain observable.
- External fonts, branding, layout, or copied third-party source.
- A Service Worker change; no DamammApps Service Worker was found and parity already had no controller.
- Manifest changes as a permission claim; the inspected manifest declares no permissions.
- Random Geolocation parameter combinations without an isolated experimental question.

## Candidate explanations for the current failure

1. **Origin-specific MRBD permission state is stuck denied for `leafpcye.github.io`.**  
   Confidence: medium-high. Deleting/re-adding did not reset it, while another origin prompted.

2. **MRBD recognizes/requests permission most reliably from a trusted child Start using a low-accuracy one-shot before high-accuracy tracking.**  
   Confidence: medium. This exact sequence is public-code evidence and remains untested locally as a controlled parity experiment.

3. **The explicit deep-link-installed Hub/root and child history structure participates in host permission registration.**  
   Confidence: medium-low. It fits the Permissions menu and back behavior, but the deep link contains no capability parameter.

These explanations can coexist. Static analysis cannot select a single root cause.

## Minimal next experiments — do not implement in this phase

### Experiment A — root permission bootstrap plus child history

Create a minimal root page installed as the app URL. From a trusted Start:

- issue one observable low-accuracy `getCurrentPosition` with DamamMap's exact options;
- record the result and universal Permissions menu before/after;
- navigate by a normal same-origin link to a minimal child;
- test middle pinch and permission reuse.

No map, sensor processing, microphone, or hidden callback.

### Experiment B — exact call semantics on a controlled origin

Compare only:

1. trusted low-accuracy one-shot (`false / 60000 / 3000`);
2. after its callback or permission decision, high-accuracy watch (`true / 2000 / 15000`).

Run first on the existing origin. If its state appears irrecoverably denied, repeat only with an explicitly approved fresh origin. This isolates call semantics from product architecture.

### Experiment C — installation/root URL matrix

Using the same static root implementation, compare:

- manual add of directory URL;
- explicit `index.html`;
- the documented Facebook `web_app_deep_link` containing only `appName` and `appUrl`.

Record installed root, middle-pinch behavior, Permissions menu, and location prompt. Do not infer privilege from installation alone.

## Decision gate

Do not modify the production probe until the experiment design is reviewed. The next implementation should choose one experiment, preserve detailed callbacks, and avoid map/navigation/game scope expansion.

