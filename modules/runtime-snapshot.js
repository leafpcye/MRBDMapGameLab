export const RUNTIME_SNAPSHOT_KEY = "mrbdProbe.runtimeSnapshot";

export function createRuntimeSnapshot(runtimeContext, {
  marker = "",
  classification = "Manual foreground snapshot",
  savedAt = new Date().toISOString()
} = {}) {
  return {
    pageInstanceId: runtimeContext.pageInstanceId,
    sessionId: runtimeContext.sessionId,
    documentBootCount: runtimeContext.documentBootCount,
    bootedAt: runtimeContext.bootedAt,
    marker,
    classification,
    savedAt
  };
}

export function saveRuntimeSnapshot(storage, snapshot) {
  storage.setItem(RUNTIME_SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function readRuntimeSnapshot(storage) {
  try {
    const raw = storage?.getItem(RUNTIME_SNAPSHOT_KEY);
    return { snapshot: raw ? JSON.parse(raw) : null, error: null };
  } catch (error) {
    return { snapshot: null, error: { name: error?.name || "Error", message: error?.message || String(error) } };
  }
}

export function compareRuntimeSnapshots(previous, current) {
  if (!previous) return { changed: null, classification: "No previous saved snapshot" };
  const pageChanged = previous.pageInstanceId !== current.pageInstanceId;
  const sessionChanged = previous.sessionId !== current.sessionId;
  const bootChanged = previous.documentBootCount !== current.documentBootCount;
  return {
    changed: pageChanged || sessionChanged || bootChanged,
    pageChanged,
    sessionChanged,
    bootChanged,
    classification: pageChanged || bootChanged
      ? "New document boot observed"
      : sessionChanged
        ? "Session identity changed without boot evidence"
        : "Same saved runtime identity"
  };
}
