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
    lastLifecycleEvent: checkpoint.lastLifecycleEvent,
    visibilityState: checkpoint.visibilityState,
    savedAt: checkpoint.savedAt
  };
  storage.setItem(LIFECYCLE_CHECKPOINT_KEY, JSON.stringify(compact));
  return compact;
}

export function interpretLifecycleEvidence({
  currentPageInstanceId,
  previousCheckpoint,
  lastEvent,
  pageshowPersisted = false,
  visibilityRestored = false,
  navigationType = "unavailable"
}) {
  if (previousCheckpoint?.pageInstanceId && previousCheckpoint.pageInstanceId !== currentPageInstanceId) {
    return navigationType === "reload"
      ? "New page instance · full reload evidence"
      : "New page instance · full reload suspected";
  }
  if (pageshowPersisted) return "Same page instance · pageshow resume evidence";
  if (visibilityRestored) return "Same page instance · visibility restored";
  if (lastEvent === "pageshow") return "Same page instance · pageshow observed";
  if (previousCheckpoint?.pageInstanceId === currentPageInstanceId) return "Same page instance";
  return "Unknown · more lifecycle evidence needed";
}
