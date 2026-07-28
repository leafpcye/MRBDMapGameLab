import { errorDetails } from "./storage.js";

export async function runNetworkProbe(logger, bypassCache) {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  const url = new URL("/build-info.js", location.origin);
  if (bypassCache) url.searchParams.set("_probe", Date.now().toString());
  logger.log("network", "fetch-start", { url: url.href, startedAt, bypassCache });
  try {
    const response = await fetch(url, { cache: bypassCache ? "no-store" : "default" });
    const text = await response.text();
    const result = {
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Number((performance.now() - startedMs).toFixed(2)),
      status: response.status,
      ok: response.ok,
      bytes: new TextEncoder().encode(text).length,
      serviceWorkerSource: "Cannot be determined by this probe"
    };
    logger.log("network", "fetch-complete", result);
    return result;
  } catch (error) {
    const result = {
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Number((performance.now() - startedMs).toFixed(2)),
      error: errorDetails(error)
    };
    logger.log("network", "fetch-failed", result);
    return result;
  }
}
