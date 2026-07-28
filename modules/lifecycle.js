import { errorDetails } from "./storage.js";

export function installLifecycleProbe(logger, onUpdate = () => {}) {
  const startedAt = performance.now();
  let bfcacheEvidence = false;
  const tracked = [
    ["DOMContentLoaded", document],
    ["load", window],
    ["pageshow", window],
    ["pagehide", window],
    ["visibilitychange", document],
    ["focus", window],
    ["blur", window],
    ["online", window],
    ["offline", window],
    ["beforeunload", window],
    ["unload", window],
    ["freeze", document],
    ["resume", document],
    ["storage", window]
  ];
  function record(event) {
    try {
      const payload = {
        type: event.type,
        persisted: "persisted" in event ? event.persisted : null,
        visibilityState: document.visibilityState
      };
      if (event.type === "storage") {
        payload.key = event.key;
        payload.oldValue = event.oldValue;
        payload.newValue = event.newValue;
        payload.url = event.url;
      }
      if (event.type === "pageshow" && event.persisted) bfcacheEvidence = true;
      logger.log("lifecycle", event.type, payload);
      onUpdate({ lastEvent: event.type, bfcacheEvidence });
    } catch (error) {
      logger.log("lifecycle", "listener-error", { sourceEvent: event.type, ...errorDetails(error) });
    }
  }
  tracked.forEach(([type, target]) => target.addEventListener(type, record));
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("controllerchange", record);
  logger.log("lifecycle", "script-start", { startedAtMonotonicMs: Number(startedAt.toFixed(2)) });
  return { startedAt, getBfcacheEvidence: () => bfcacheEvidence };
}
