const SESSION_ID_KEY = "mrbdProbe.sessionId";
const BOOT_COUNT_KEY = "mrbdProbe.launchCount";
const FIRST_BOOT_KEY = "mrbdProbe.firstLaunchAt";
const LAST_BOOT_KEY = "mrbdProbe.lastLaunchAt";

function defaultId(prefix) {
  const value = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

export function createRuntimeContextManager({
  idFactory = defaultId,
  now = () => new Date().toISOString()
} = {}) {
  let context = null;

  return {
    initialize({ localStorage = null, sessionStorage = null } = {}) {
      if (context) return context;

      const bootedAt = now();
      let sessionId = idFactory("session");
      let sessionStorageAvailable = false;
      try {
        const stored = sessionStorage?.getItem(SESSION_ID_KEY);
        sessionId = stored || sessionId;
        sessionStorage?.setItem(SESSION_ID_KEY, sessionId);
        sessionStorageAvailable = Boolean(sessionStorage);
      } catch {
        // A fresh in-memory session ID still keeps this document internally consistent.
      }

      let documentBootCount = "unavailable";
      let firstBootAt = null;
      let previousBootAt = null;
      let localStorageAvailable = false;
      try {
        const rawCount = localStorage?.getItem(BOOT_COUNT_KEY);
        const parsedCount = Number.parseInt(rawCount ?? "0", 10);
        documentBootCount = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount + 1 : 1;
        firstBootAt = localStorage?.getItem(FIRST_BOOT_KEY) || bootedAt;
        previousBootAt = localStorage?.getItem(LAST_BOOT_KEY);
        localStorage?.setItem(BOOT_COUNT_KEY, String(documentBootCount));
        localStorage?.setItem(FIRST_BOOT_KEY, firstBootAt);
        localStorage?.setItem(LAST_BOOT_KEY, bootedAt);
        localStorageAvailable = Boolean(localStorage);
      } catch {
        // The Probe remains usable while clearly reporting an unavailable boot count.
      }

      context = Object.freeze({
        pageInstanceId: idFactory("page"),
        sessionId,
        documentBootCount,
        bootedAt,
        previousBootAt,
        firstBootAt,
        localStorageAvailable,
        sessionStorageAvailable
      });
      return context;
    },
    get() {
      return context;
    }
  };
}

const defaultManager = createRuntimeContextManager();

export function initializeRuntimeContext(options) {
  return defaultManager.initialize(options);
}

export function getRuntimeContext() {
  return defaultManager.get();
}

export function checkRuntimeContextConsistency(expectedContext, observedContexts = []) {
  const expected = expectedContext?.pageInstanceId;
  const observed = observedContexts
    .map((item) => typeof item === "string" ? item : item?.pageInstanceId)
    .filter(Boolean);
  const consistent = Boolean(expected) && observed.every((pageInstanceId) => pageInstanceId === expected);
  return {
    status: consistent ? "OK" : "ERROR",
    expectedPageInstanceId: expected || "unavailable",
    observedPageInstanceIds: observed
  };
}
