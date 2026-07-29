export const CORE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"];

export function createPairTracker(keys = CORE_KEYS) {
  const state = new Map(keys.map((key) => [key, createKeyState()]));
  let rawKeyboardEventCount = 0;

  function stateFor(key) {
    if (!state.has(key)) state.set(key, createKeyState());
    return state.get(key);
  }

  return {
    observe(event) {
      const key = event.key;
      const item = stateFor(key);
      rawKeyboardEventCount += 1;
      let matched = false;
      if (event.type === "keydown") {
        item.downCount += 1;
        item.pendingTimestamps.push(Number(event.timeStamp) || 0);
      } else if (event.type === "keyup") {
        item.upCount += 1;
        if (item.pendingTimestamps.length) {
          const downAt = item.pendingTimestamps.shift();
          item.completedPairCount += 1;
          item.latestDurationMs = Number(Math.max(0, (Number(event.timeStamp) || 0) - downAt).toFixed(2));
          matched = true;
        } else {
          item.unmatchedKeyups += 1;
        }
      }
      return { ...summarizeKey(key, item), matched };
    },
    get(key) {
      return summarizeKey(key, stateFor(key));
    },
    summary() {
      return Array.from(state, ([key, value]) => summarizeKey(key, value));
    },
    metrics() {
      const summary = Array.from(state.values());
      return {
        rawKeyboardEventCount,
        completedPairCount: summary.reduce((total, item) => total + item.completedPairCount, 0),
        unmatchedKeydowns: summary.reduce((total, item) => total + item.pendingTimestamps.length, 0),
        unmatchedKeyups: summary.reduce((total, item) => total + item.unmatchedKeyups, 0)
      };
    }
  };
}

function createKeyState() {
  return {
    downCount: 0,
    upCount: 0,
    completedPairCount: 0,
    latestDurationMs: null,
    pendingTimestamps: [],
    unmatchedKeyups: 0
  };
}

function summarizeKey(key, item) {
  return {
    key,
    downCount: item.downCount,
    upCount: item.upCount,
    completedPairCount: item.completedPairCount,
    latestDurationMs: item.latestDurationMs,
    unmatchedKeydowns: item.pendingTimestamps.length,
    unmatchedKeyups: item.unmatchedKeyups
  };
}

export function formatInputValue(value) {
  if (value === "") return "(empty)";
  if (value === undefined) return "(undefined)";
  if (value === null) return "(null)";
  return String(value);
}

export function formatElementDescriptor({
  tagName = "unknown",
  id = "",
  testId = "",
  functionName = "",
  text = ""
}) {
  const tag = String(tagName).toLowerCase();
  const identity = id
    ? `#${id}`
    : testId
      ? `[data-testid="${testId}"]`
      : functionName
        ? `[${functionName}]`
        : "";
  const compactText = String(text).replace(/\s+/g, " ").trim().slice(0, 48);
  return `${tag}${identity}${compactText ? ` "${compactText}"` : ""}`;
}

export function boundedRecentEvents(entries, nextEntry, limit = 4) {
  return [...entries, nextEntry].slice(-limit);
}
