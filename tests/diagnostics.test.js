import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseLargeText, readLargeTextPreference, writeLargeTextPreference } from "../modules/preferences.js";
import { getNavigationTarget, getDirectionalNeighbor } from "../modules/navigation.js";
import {
  boundedRecentEvents,
  createPairTracker,
  formatElementDescriptor,
  formatInputValue
} from "../modules/input-state.js";
import {
  readLifecycleCheckpoint,
  writeLifecycleCheckpoint,
  classifyLifecycleEvidence
} from "../modules/lifecycle-checkpoint.js";
import { createLifecycleTrace, LIFECYCLE_TRACE_KEY } from "../modules/lifecycle-trace.js";
import { createRuntimeContextManager, checkRuntimeContextConsistency } from "../modules/runtime-context.js";
import { formatBootTimestamp } from "../modules/storage.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function rect(left, top, width = 80, height = 40) {
  return { left, top, width, height };
}

test("large text defaults on for a 600px viewport or Greatwhite", () => {
  assert.equal(shouldUseLargeText({ width: 600, height: 900, userAgent: "" }), true);
  assert.equal(shouldUseLargeText({ width: 900, height: 900, userAgent: "Greatwhite WebView" }), true);
  assert.equal(shouldUseLargeText({ width: 900, height: 900, userAgent: "Desktop" }), false);
});

test("stored large text preference overrides automatic detection", () => {
  assert.equal(shouldUseLargeText({ storedPreference: "false", width: 500, height: 500, userAgent: "Greatwhite" }), false);
  assert.equal(shouldUseLargeText({ storedPreference: "true", width: 1200, height: 900, userAgent: "Desktop" }), true);
});

test("large text preference can be stored and read", () => {
  const storage = memoryStorage();
  writeLargeTextPreference(storage, true);
  assert.equal(readLargeTextPreference(storage), "true");
});

test("single-column navigation moves 01 down to 02 and up again", () => {
  const rects = [rect(0, 0), rect(0, 60), rect(0, 120)];
  assert.equal(getDirectionalNeighbor({ key: "ArrowDown", currentIndex: 0, rects }), 1);
  assert.equal(getDirectionalNeighbor({ key: "ArrowUp", currentIndex: 1, rects }), 0);
  assert.equal(getDirectionalNeighbor({ key: "ArrowLeft", currentIndex: 1, rects }), 1);
});

test("two-column navigation follows visual rows and columns", () => {
  const rects = [rect(0, 0), rect(100, 0), rect(0, 60), rect(100, 60)];
  assert.equal(getDirectionalNeighbor({ key: "ArrowDown", currentIndex: 0, rects }), 2);
  assert.equal(getDirectionalNeighbor({ key: "ArrowRight", currentIndex: 0, rects }), 1);
  assert.equal(getDirectionalNeighbor({ key: "ArrowUp", currentIndex: 3, rects }), 1);
});

test("visual rectangle navigation selects the nearest directional candidate", () => {
  const rects = [rect(40, 0), rect(0, 70), rect(45, 65), rect(120, 70)];
  assert.equal(getDirectionalNeighbor({ key: "ArrowDown", currentIndex: 0, rects }), 2);
});

test("app navigation helper preserves vertical and horizontal boundaries", () => {
  assert.equal(getNavigationTarget({ key: "ArrowDown", index: 1, count: 5, orientation: "vertical" }), 2);
  assert.equal(getNavigationTarget({ key: "ArrowUp", index: 0, count: 5, orientation: "vertical" }), 0);
  assert.equal(getNavigationTarget({ key: "ArrowRight", index: 2, count: 3, orientation: "horizontal" }), 2);
});

test("runtime context initializes once and keeps one page instance", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  let id = 0;
  const manager = createRuntimeContextManager({
    idFactory: (prefix) => `${prefix}-${++id}`,
    now: () => "2026-07-29T04:00:00.000Z"
  });
  const first = manager.initialize({ localStorage: local, sessionStorage: session });
  const second = manager.initialize({ localStorage: local, sessionStorage: session });
  assert.equal(first, second);
  assert.equal(first.pageInstanceId, second.pageInstanceId);
  assert.equal(first.documentBootCount, 1);
  assert.equal(local.getItem("mrbdProbe.launchCount"), "1");
});

test("a new runtime manager represents one new document boot", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  const firstManager = createRuntimeContextManager({
    idFactory: (prefix) => `${prefix}-first`,
    now: () => "2026-07-29T04:00:00.000Z"
  });
  firstManager.initialize({ localStorage: local, sessionStorage: session });
  const secondManager = createRuntimeContextManager({
    idFactory: (prefix) => `${prefix}-second`,
    now: () => "2026-07-29T05:00:00.000Z"
  });
  const second = secondManager.initialize({ localStorage: local, sessionStorage: session });
  assert.equal(second.documentBootCount, 2);
  assert.equal(second.previousBootAt, "2026-07-29T04:00:00.000Z");
});

test("different modules can read the same runtime context", () => {
  const manager = createRuntimeContextManager({ idFactory: (prefix) => `${prefix}-fixed` });
  const initialized = manager.initialize({ localStorage: memoryStorage(), sessionStorage: memoryStorage() });
  const storageModuleView = manager.get();
  const lifecycleModuleView = manager.get();
  assert.equal(storageModuleView.pageInstanceId, lifecycleModuleView.pageInstanceId);
  assert.equal(checkRuntimeContextConsistency(initialized, [storageModuleView, lifecycleModuleView]).status, "OK");
  assert.equal(checkRuntimeContextConsistency(initialized, ["page-other"]).status, "ERROR");
});

test("pair tracker separates two raw events from one completed pair", () => {
  const tracker = createPairTracker();
  tracker.observe({ type: "keydown", key: "ArrowUp", timeStamp: 100 });
  const matched = tracker.observe({ type: "keyup", key: "ArrowUp", timeStamp: 102 });
  assert.equal(matched.latestDurationMs, 2);
  assert.deepEqual(tracker.metrics(), {
    rawKeyboardEventCount: 2,
    completedPairCount: 1,
    unmatchedKeydowns: 0,
    unmatchedKeyups: 0
  });
});

test("empty, undefined and null input values remain distinguishable", () => {
  assert.equal(formatInputValue(""), "(empty)");
  assert.equal(formatInputValue(undefined), "(undefined)");
  assert.equal(formatInputValue(null), "(null)");
});

test("focus descriptor includes tag, id and visible text", () => {
  assert.equal(formatElementDescriptor({
    tagName: "BUTTON",
    id: "vertical-option-2",
    text: "Option 2"
  }), 'button#vertical-option-2 "Option 2"');
});

test("recent raw events retain a fixed four-entry window", () => {
  let entries = [];
  for (let index = 1; index <= 9; index += 1) entries = boundedRecentEvents(entries, { seq: index }, 4);
  assert.deepEqual(entries.map((entry) => entry.seq), [6, 7, 8, 9]);
});

test("lifecycle checkpoint writes compact boot identity fields", () => {
  const storage = memoryStorage();
  const saved = writeLifecycleCheckpoint(storage, {
    pageInstanceId: "page-1",
    sessionId: "session-1",
    documentBootCount: 4,
    bootedAt: "2026-07-29T00:00:00.000Z",
    lastLifecycleEvent: "visibilitychange",
    visibilityState: "hidden",
    savedAt: "2026-07-29T00:01:00.000Z",
    ignored: "large payload"
  });
  assert.equal(saved.ignored, undefined);
  assert.equal(readLifecycleCheckpoint(storage).checkpoint.documentBootCount, 4);
});

test("damaged lifecycle checkpoint does not throw", () => {
  const storage = memoryStorage({ "mrbdProbe.lifecycleCheckpoint": "{broken" });
  const result = readLifecycleCheckpoint(storage);
  assert.equal(result.checkpoint, null);
  assert.equal(result.error.name, "SyntaxError");
});

test("lifecycle trace stays within its fixed limit", () => {
  const trace = createLifecycleTrace({
    storage: memoryStorage(),
    runtimeContext: { pageInstanceId: "page-1", documentBootCount: 1 },
    limit: 3,
    localTime: (value) => `local:${value}`
  });
  for (const event of ["script-start", "load", "blur", "focus"]) trace.append(event, { visibilityState: "visible" });
  assert.deepEqual(trace.getEntries().map((entry) => entry.event), ["load", "blur", "focus"]);
});

test("damaged lifecycle trace is ignored without crashing", () => {
  const storage = memoryStorage({ [LIFECYCLE_TRACE_KEY]: "{broken" });
  const trace = createLifecycleTrace({
    storage,
    runtimeContext: { pageInstanceId: "page-1", documentBootCount: 1 }
  });
  assert.equal(trace.getEntries().length, 0);
  assert.equal(trace.getReadError().name, "SyntaxError");
});

test("consistent same-document lifecycle evidence is classified conservatively", () => {
  const result = classifyLifecycleEvidence({
    currentContext: { pageInstanceId: "page-1", documentBootCount: 5 },
    traceEntries: [
      { event: "before-middle-pinch", pageInstanceId: "page-1", documentBootCount: 5 },
      { event: "blur", pageInstanceId: "page-1", documentBootCount: 5 },
      { event: "focus", pageInstanceId: "page-1", documentBootCount: 5 }
    ]
  });
  assert.equal(result, "Likely system overlay or same-document resume");
});

test("complete document boot evidence is classified as a reload", () => {
  const result = classifyLifecycleEvidence({
    currentContext: { pageInstanceId: "page-2", documentBootCount: 6 },
    traceEntries: [
      { event: "before-middle-pinch", pageInstanceId: "page-1", documentBootCount: 5 },
      { event: "script-start", pageInstanceId: "page-2", documentBootCount: 6 },
      { event: "DOMContentLoaded", pageInstanceId: "page-2", documentBootCount: 6 }
    ]
  });
  assert.equal(result, "Full document reload observed");
});

test("contradictory lifecycle identity returns inconclusive", () => {
  const result = classifyLifecycleEvidence({
    currentContext: { pageInstanceId: "page-1", documentBootCount: 6 },
    traceEntries: [
      { event: "before-middle-pinch", pageInstanceId: "page-1", documentBootCount: 5 },
      { event: "focus", pageInstanceId: "page-1", documentBootCount: 6 }
    ]
  });
  assert.equal(result, "Inconsistent diagnostic evidence — do not infer restart or resume");
});

test("boot time formatter returns local, UTC and runtime time zone", () => {
  const result = formatBootTimestamp("2026-07-29T03:13:25.592Z", {
    localeFormatter: (date) => `LOCAL ${date.toISOString()}`,
    timeZoneResolver: () => "Test/Zone"
  });
  assert.deepEqual(result, {
    local: "LOCAL 2026-07-29T03:13:25.592Z",
    utc: "2026-07-29T03:13:25.592Z",
    timeZone: "Test/Zone"
  });
});
