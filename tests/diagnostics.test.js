import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseLargeText, readLargeTextPreference, writeLargeTextPreference } from "../modules/preferences.js";
import { getNavigationTarget } from "../modules/navigation.js";
import { createPairTracker } from "../modules/input-state.js";
import { readLifecycleCheckpoint, writeLifecycleCheckpoint, interpretLifecycleEvidence } from "../modules/lifecycle-checkpoint.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
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

test("app navigation moves within vertical and horizontal groups", () => {
  assert.equal(getNavigationTarget({ key: "ArrowDown", index: 1, count: 5, orientation: "vertical" }), 2);
  assert.equal(getNavigationTarget({ key: "ArrowLeft", index: 2, count: 3, orientation: "horizontal" }), 1);
});

test("app navigation respects first and last boundaries", () => {
  assert.equal(getNavigationTarget({ key: "ArrowUp", index: 0, count: 5, orientation: "vertical" }), 0);
  assert.equal(getNavigationTarget({ key: "ArrowRight", index: 2, count: 3, orientation: "horizontal" }), 2);
});

test("pair tracker records down and matching up", () => {
  const tracker = createPairTracker();
  assert.equal(tracker.observe({ type: "keydown", key: "ArrowUp" }).pending, true);
  const matched = tracker.observe({ type: "keyup", key: "ArrowUp" });
  assert.equal(matched.down, true);
  assert.equal(matched.up, true);
  assert.equal(matched.pending, false);
});

test("lifecycle checkpoint writes only compact diagnostic fields", () => {
  const storage = memoryStorage();
  const saved = writeLifecycleCheckpoint(storage, {
    pageInstanceId: "page-1",
    sessionId: "session-1",
    lastLifecycleEvent: "visibilitychange",
    visibilityState: "hidden",
    savedAt: "2026-07-29T00:00:00.000Z",
    ignored: "large payload"
  });
  assert.equal(saved.ignored, undefined);
  assert.equal(readLifecycleCheckpoint(storage).checkpoint.pageInstanceId, "page-1");
});

test("damaged lifecycle checkpoint does not throw", () => {
  const storage = memoryStorage({ "mrbdProbe.lifecycleCheckpoint": "{broken" });
  const result = readLifecycleCheckpoint(storage);
  assert.equal(result.checkpoint, null);
  assert.equal(result.error.name, "SyntaxError");
});

test("lifecycle interpretation distinguishes a new page instance", () => {
  assert.match(interpretLifecycleEvidence({
    currentPageInstanceId: "page-2",
    previousCheckpoint: { pageInstanceId: "page-1" },
    navigationType: "reload"
  }), /full reload evidence/);
});
