export const LIFECYCLE_TRACE_KEY = "mrbdProbe.lifecycleTrace";
export const DEFAULT_TRACE_LIMIT = 16;

function errorDetails(error) {
  return { name: error?.name || "Error", message: error?.message || String(error) };
}

export function readLifecycleTrace(storage, limit = DEFAULT_TRACE_LIMIT) {
  try {
    const raw = storage?.getItem(LIFECYCLE_TRACE_KEY);
    if (!raw) return { entries: [], error: null };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Lifecycle trace must be an array");
    const entries = parsed
      .filter((entry) => entry && typeof entry === "object" && typeof entry.event === "string")
      .map((entry) => ({
        sequence: Number(entry.sequence) || 0,
        event: entry.event,
        wallTime: String(entry.wallTime || ""),
        localTime: String(entry.localTime || ""),
        pageInstanceId: String(entry.pageInstanceId || "page-unknown"),
        documentBootCount: entry.documentBootCount ?? "unavailable",
        visibilityState: String(entry.visibilityState || "unknown"),
        persisted: typeof entry.persisted === "boolean" ? entry.persisted : null
      }));
    return { entries: entries.slice(-limit), error: null };
  } catch (error) {
    return { entries: [], error: errorDetails(error) };
  }
}

export function createLifecycleTrace({
  storage = null,
  runtimeContext,
  limit = DEFAULT_TRACE_LIMIT,
  now = () => new Date().toISOString(),
  localTime = (value) => new Date(value).toLocaleString()
}) {
  const restored = readLifecycleTrace(storage, limit);
  let entries = restored.entries;
  let sequence = entries.reduce((highest, entry) => Math.max(highest, Number(entry.sequence) || 0), 0);
  let writeError = null;

  function persist() {
    try {
      storage?.setItem(LIFECYCLE_TRACE_KEY, JSON.stringify(entries));
      writeError = null;
    } catch (error) {
      writeError = errorDetails(error);
    }
  }

  function append(event, details = {}) {
    const wallTime = details.wallTime || now();
    const entry = {
      sequence: ++sequence,
      event,
      wallTime,
      localTime: localTime(wallTime),
      pageInstanceId: runtimeContext.pageInstanceId,
      documentBootCount: runtimeContext.documentBootCount,
      visibilityState: details.visibilityState ?? globalThis.document?.visibilityState ?? "unknown",
      persisted: details.persisted ?? null
    };
    entries = [...entries, entry].slice(-limit);
    persist();
    return { ...entry };
  }

  return {
    append,
    mark(event = "marker") {
      entries = [];
      return append(event);
    },
    getEntries: () => entries.map((entry) => ({ ...entry })),
    getReadError: () => restored.error,
    getWriteError: () => writeError,
    limit
  };
}
