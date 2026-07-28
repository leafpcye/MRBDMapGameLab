function safePayload(value) {
  try {
    const json = JSON.stringify(value ?? {});
    return { payload: JSON.parse(json), serializationError: null };
  } catch (error) {
    return {
      payload: {
        serializationError: true,
        error: { name: error?.name || "Error", message: error?.message || String(error) }
      },
      serializationError: error
    };
  }
}

export function createLogger(options = {}) {
  const {
    sessionId = "session-unknown",
    pageInstanceId = "page-unknown",
    appVersion = "unknown",
    gitCommit = "unknown",
    maxEntries = 5000,
    now = () => new Date(),
    monotonicNow = () => globalThis.performance?.now?.() ?? 0,
    visibility = () => globalThis.document?.visibilityState ?? "unknown",
    online = () => globalThis.navigator?.onLine ?? null,
    environmentProvider = () => null
  } = options;
  let entries = [];
  let seq = 0;
  let truncationPending = false;
  const listeners = new Set();

  function append(module, event, rawPayload = {}) {
    const { payload, serializationError } = safePayload(rawPayload);
    const entry = {
      seq: ++seq,
      wallTime: now().toISOString(),
      monotonicMs: Number(monotonicNow().toFixed?.(2) ?? monotonicNow()),
      sessionId,
      pageInstanceId,
      appVersion,
      gitCommit,
      module,
      event,
      visibilityState: visibility(),
      online: online(),
      payload
    };
    entries.push(entry);
    if (entries.length > maxEntries) {
      entries.splice(0, entries.length - maxEntries);
      truncationPending = true;
    }
    listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // A display subscriber must never break evidence collection.
      }
    });
    if (serializationError && event !== "payload-serialization-error") {
      append("logger", "payload-serialization-error", {
        sourceModule: module,
        sourceEvent: event,
        name: serializationError.name,
        message: serializationError.message
      });
    }
    if (truncationPending && event !== "log-truncated") {
      truncationPending = false;
      append("logger", "log-truncated", { maxEntries, policy: "oldest entries removed" });
    }
    return entry;
  }

  return {
    log: append,
    getEntries: () => entries.map((entry) => structuredCloneSafe(entry)),
    clear(module = null) {
      entries = module ? entries.filter((entry) => entry.module !== module) : [];
      return append(module || "logger", module ? "module-log-cleared" : "log-cleared", { module });
    },
    exportSnapshot() {
      return {
        schemaVersion: 1,
        exportedAt: now().toISOString(),
        app: { version: appVersion, gitCommit },
        sessionId,
        pageInstanceId,
        environment: structuredCloneSafe(environmentProvider()),
        entryCount: entries.length,
        entries: entries.map((entry) => structuredCloneSafe(entry))
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

function structuredCloneSafe(value) {
  if (value === undefined) return null;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON for older or constrained runtimes.
    }
  }
  return JSON.parse(JSON.stringify(value));
}
