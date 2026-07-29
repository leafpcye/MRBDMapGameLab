export const LIFECYCLE_CHECKPOINT_KEY = "mrbdProbe.lifecycleCheckpoint";

export function readLifecycleCheckpoint(storage) {
  try {
    const raw = storage.getItem(LIFECYCLE_CHECKPOINT_KEY);
    if (!raw) return { checkpoint: null, error: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new TypeError("Checkpoint must be an object");
    return { checkpoint: parsed, error: null };
  } catch (error) {
    return {
      checkpoint: null,
      error: { name: error?.name || "Error", message: error?.message || String(error) }
    };
  }
}

export function writeLifecycleCheckpoint(storage, checkpoint) {
  const compact = {
    pageInstanceId: checkpoint.pageInstanceId,
    sessionId: checkpoint.sessionId,
    documentBootCount: checkpoint.documentBootCount,
    bootedAt: checkpoint.bootedAt,
    lastLifecycleEvent: checkpoint.lastLifecycleEvent,
    visibilityState: checkpoint.visibilityState,
    savedAt: checkpoint.savedAt
  };
  storage.setItem(LIFECYCLE_CHECKPOINT_KEY, JSON.stringify(compact));
  return compact;
}

export function classifyLifecycleEvidence({
  currentContext,
  previousCheckpoint = null,
  traceEntries = [],
  contextConsistent = true
}) {
  if (!contextConsistent) return "Inconsistent diagnostic evidence — do not infer restart or resume";

  const markerIndex = traceEntries.findLastIndex?.((entry) =>
    entry.event === "before-middle-pinch" || entry.event === "marker"
  ) ?? findLastMarker(traceEntries);
  const marker = markerIndex >= 0 ? traceEntries[markerIndex] : null;
  const baseline = marker || previousCheckpoint;
  const currentPage = currentContext?.pageInstanceId;
  const currentBoot = normalizeCount(currentContext?.documentBootCount);
  const baselinePage = baseline?.pageInstanceId;
  const baselineBoot = normalizeCount(baseline?.documentBootCount);

  if (baselinePage && baselineBoot !== null) {
    if (baselinePage === currentPage && baselineBoot !== currentBoot) {
      return "Inconsistent diagnostic evidence — do not infer restart or resume";
    }
    if (baselinePage !== currentPage && baselineBoot === currentBoot) {
      return "Inconsistent diagnostic evidence — do not infer restart or resume";
    }
  }

  const relevant = markerIndex >= 0 ? traceEntries.slice(markerIndex + 1) : traceEntries;
  const currentTrace = relevant.filter((entry) =>
    entry.pageInstanceId === currentPage
    && normalizeCount(entry.documentBootCount) === currentBoot
  );
  const hasScriptStart = currentTrace.some((entry) => entry.event === "script-start");
  const hasLoad = currentTrace.some((entry) => entry.event === "load" || entry.event === "DOMContentLoaded");

  if (baselinePage && baselinePage !== currentPage) {
    if (baselineBoot !== null && currentBoot !== null && currentBoot > baselineBoot && hasScriptStart && hasLoad) {
      return "Full document reload observed";
    }
    return "Inconsistent diagnostic evidence — do not infer restart or resume";
  }

  const pageshow = [...currentTrace].reverse().find((entry) => entry.event === "pageshow");
  if (pageshow && typeof pageshow.persisted === "boolean") {
    return `Same-document pageshow observed · persisted=${pageshow.persisted}`;
  }

  const overlayEvidence = currentTrace.some((entry) =>
    ["blur", "focus", "visibilitychange", "freeze", "resume"].includes(entry.event)
  );
  if (baselinePage === currentPage && baselineBoot === currentBoot && overlayEvidence) {
    return "Likely system overlay or same-document resume";
  }

  return "Unknown · more lifecycle evidence needed";
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findLastMarker(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].event === "before-middle-pinch" || entries[index].event === "marker") return index;
  }
  return -1;
}
