import { errorDetails } from "./storage.js";

export function classifyNetworkEvidence({ navigatorOnLine, liveFetchSucceeded }) {
  if (liveFetchSucceeded === null || liveFetchSucceeded === undefined) return "Not tested";
  if (navigatorOnLine === false && liveFetchSucceeded) return "Runtime says offline, live fetch succeeds";
  if (navigatorOnLine === true && !liveFetchSucceeded) return "Runtime says online, live fetch fails";
  if (navigatorOnLine === true && liveFetchSucceeded) return "Both online";
  return "Both unavailable";
}

export async function runNetworkProbe(logger, {
  fetchImpl = globalThis.fetch,
  navigatorOnLine = globalThis.navigator?.onLine ?? null,
  likelyCachedPageAvailable = Boolean(globalThis.navigator?.serviceWorker?.controller),
  now = () => new Date(),
  monotonicNow = () => globalThis.performance?.now?.() ?? 0
} = {}) {
  const startedAt = now().toISOString();
  const startedMs = monotonicNow();
  const url = new URL("../build-info.js", import.meta.url);
  url.searchParams.set("network_probe", Date.now().toString());
  logger.log("network", "live-fetch-start", {
    url: url.href,
    startedAt,
    navigatorOnLine,
    cacheMode: "no-store",
    note: "no-store requested; intermediaries cannot be absolutely ruled out"
  });
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    const text = await response.text();
    const liveFetchSucceeded = response.ok;
    const result = {
      navigatorOnLine,
      liveFetchSucceeded,
      likelyCachedPageAvailable,
      interpretation: classifyNetworkEvidence({ navigatorOnLine, liveFetchSucceeded }),
      startedAt,
      endedAt: now().toISOString(),
      durationMs: Number((monotonicNow() - startedMs).toFixed(2)),
      status: response.status,
      ok: response.ok,
      bytes: new TextEncoder().encode(text).length,
      cacheMode: "no-store",
      serviceWorkerSource: "Cannot be determined by this probe",
      note: "A successful response is live same-origin evidence; it does not absolutely exclude intermediary caching."
    };
    logger.log("network", "live-fetch-complete", result);
    return result;
  } catch (error) {
    const result = {
      navigatorOnLine,
      liveFetchSucceeded: false,
      likelyCachedPageAvailable,
      interpretation: classifyNetworkEvidence({ navigatorOnLine, liveFetchSucceeded: false }),
      startedAt,
      endedAt: now().toISOString(),
      durationMs: Number((monotonicNow() - startedMs).toFixed(2)),
      status: null,
      error: errorDetails(error)
    };
    logger.log("network", "live-fetch-failed", result);
    return result;
  }
}
