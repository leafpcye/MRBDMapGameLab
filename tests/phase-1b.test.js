import test from "node:test";
import assert from "node:assert/strict";
import { createActivationTracker, flashActivation } from "../modules/activation.js";
import { createRuntimeSnapshot, saveRuntimeSnapshot, readRuntimeSnapshot, compareRuntimeSnapshots } from "../modules/runtime-snapshot.js";
import { haversineMeters, createLocationAccumulator, geolocationErrorDetails } from "../modules/location.js";
import { createRateSampler, motionRecord, orientationRecord } from "../modules/motion.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

function position(latitude, longitude, overrides = {}) {
  return {
    timestamp: overrides.timestamp ?? 1000,
    coords: {
      latitude,
      longitude,
      accuracy: overrides.accuracy ?? 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    }
  };
}

test("Haversine returns zero for an identical position", () => {
  assert.equal(haversineMeters({ latitude: 10, longitude: 20 }, { latitude: 10, longitude: 20 }), 0);
});

test("Haversine measures a known one-degree equatorial distance", () => {
  assert.ok(Math.abs(haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111195) < 10);
});

test("Haversine uses the short path across the antimeridian", () => {
  assert.ok(haversineMeters({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 }) < 23000);
});

test("location accumulator preserves nullable raw values and runtime context", () => {
  const accumulator = createLocationAccumulator({ now: () => 1000, monotonicNow: () => 12.345 });
  const record = accumulator.add(position(1, 2), { watchSessionId: "watch-1" });
  assert.equal(record.raw.altitude, null);
  assert.equal(record.watchSessionId, "watch-1");
  assert.equal(record.monotonicMs, 12.35);
});

test("location accumulator flags poor accuracy and stale positions", () => {
  const accumulator = createLocationAccumulator({
    now: () => 100000,
    monotonicNow: () => 1,
    thresholds: { poorAccuracyM: 20, suspiciousDerivedSpeedMps: 100, duplicateToleranceM: 0, longCallbackGapMs: 1000, suspiciousJumpDistanceM: 10000 }
  });
  const record = accumulator.add(position(0, 0, { accuracy: 30, timestamp: 0 }));
  assert.deepEqual(record.flags, ["poor-accuracy", "missing-heading", "missing-speed"]);
});

test("location summary separates raw cumulative and flagged distance", () => {
  let wall = 0;
  const accumulator = createLocationAccumulator({
    now: () => (wall += 1000),
    monotonicNow: () => wall,
    thresholds: { poorAccuracyM: 10, suspiciousDerivedSpeedMps: 1000, duplicateToleranceM: 0, longCallbackGapMs: 100000, suspiciousJumpDistanceM: 50 }
  });
  accumulator.add(position(0, 0, { timestamp: 1000 }));
  accumulator.add(position(0, 0.001, { timestamp: 2000 }));
  const summary = accumulator.summary();
  assert.ok(summary.cumulativeDistanceM > 100);
  assert.equal(summary.flaggedDistanceM, summary.cumulativeDistanceM);
  assert.equal(summary.flaggedSampleCount, 2);
});

test("geolocation error codes retain raw code and readable name", () => {
  assert.equal(geolocationErrorDetails({ code: 1, name: "Error", message: "denied" }).codeName, "PERMISSION_DENIED");
  assert.equal(geolocationErrorDetails({ code: 2, message: "gone" }).codeName, "POSITION_UNAVAILABLE");
  assert.equal(geolocationErrorDetails({ code: 3, message: "late" }).codeName, "TIMEOUT");
});

test("location quality flags cover duplicate, long gap, timestamp regression and high speed", () => {
  let wall = 0;
  const accumulator = createLocationAccumulator({
    now: () => (wall += wall ? 20000 : 1000),
    monotonicNow: () => wall,
    thresholds: { poorAccuracyM: 100, suspiciousDerivedSpeedMps: 0.01, duplicateToleranceM: 1, longCallbackGapMs: 10000, suspiciousJumpDistanceM: 10000 }
  });
  accumulator.add(position(0, 0, { timestamp: 2000 }));
  const duplicate = accumulator.add(position(0, 0, { timestamp: 1000 }));
  assert.ok(duplicate.flags.includes("duplicate"));
  assert.ok(duplicate.flags.includes("long-gap"));
  assert.ok(duplicate.flags.includes("timestamp-regression"));
  const moving = accumulator.add(position(0, 0.001, { timestamp: 3000 }));
  assert.ok(moving.flags.includes("high-derived-speed"));
});

test("rate sampler emits at configured 10 Hz and counts dropped samples", () => {
  let at = 0;
  const sampler = createRateSampler({ hz: 10, now: () => at });
  assert.equal(sampler.observe("a").emitted, true);
  at = 50;
  assert.equal(sampler.observe("b").emitted, false);
  at = 100;
  assert.equal(sampler.observe("c").emitted, true);
  assert.deepEqual({ raw: sampler.stats().rawCount, emitted: sampler.stats().emittedCount, dropped: sampler.stats().droppedBySampler }, { raw: 3, emitted: 2, dropped: 1 });
  assert.equal(sampler.stats().averageRawIntervalMs, 50);
});

test("sensor record helpers preserve null acceleration, rotation and orientation values", () => {
  assert.deepEqual(orientationRecord({ alpha: null, beta: null, gamma: null, absolute: false, timeStamp: 4 }), {
    alpha: null, beta: null, gamma: null, absolute: false, timeStamp: 4
  });
  assert.deepEqual(motionRecord({ acceleration: null, accelerationIncludingGravity: null, rotationRate: null, interval: 16, timeStamp: 5 }), {
    acceleration: null, accelerationIncludingGravity: null, rotationRate: null, intervalMs: 16, timeStamp: 5
  });
});

test("rate sampler can switch from 5 Hz to 20 Hz", () => {
  let at = 0;
  const sampler = createRateSampler({ hz: 5, now: () => at });
  sampler.observe("a");
  at = 60;
  assert.equal(sampler.observe("b").emitted, false);
  sampler.setHz(20);
  assert.equal(sampler.observe("c").emitted, true);
  assert.equal(sampler.stats().samplingHz, 20);
});

test("5, 10 and 20 Hz settings enforce their corresponding sample windows", () => {
  for (const hz of [5, 10, 20]) {
    let at = 0;
    const sampler = createRateSampler({ hz, now: () => at });
    assert.equal(sampler.observe("first").emitted, true);
    at = (1000 / hz) - 1;
    assert.equal(sampler.observe("early").emitted, false);
    at = 1000 / hz;
    assert.equal(sampler.observe("on-time").emitted, true);
  }
});

test("activation tracker counts Enter once when a synthetic click follows", () => {
  let now = 1000;
  const observed = [];
  const tracker = createActivationTracker({ now: () => now, onActivation: (value) => observed.push(value) });
  assert.equal(tracker.activate("single", "keyboard").activated, true);
  now += 10;
  assert.equal(tracker.activate("single", "unknown").activated, false);
  assert.equal(tracker.getCount("single"), 1);
  assert.equal(observed[0].source, "keyboard");
});

test("activation tracker records a later pointer activation separately", () => {
  let now = 1000;
  const tracker = createActivationTracker({ now: () => now });
  tracker.activate("single", "keyboard");
  now += 500;
  assert.equal(tracker.activate("single", "pointer").count, 2);
});

test("activation tracker records an ordinary click", () => {
  const tracker = createActivationTracker();
  const result = tracker.activate("option-1", "click");
  assert.equal(result.activated, true);
  assert.equal(result.source, "click");
  assert.equal(result.count, 1);
});

test("activation visual state automatically ends after the configured duration", () => {
  const states = [];
  let scheduled = null;
  const result = flashActivation({
    setActive: (active) => states.push(active),
    schedule: (callback, delay) => { scheduled = { callback, delay }; },
    durationMs: 700
  });
  assert.deepEqual(result, { active: true, durationMs: 700 });
  assert.equal(scheduled.delay, 700);
  scheduled.callback();
  assert.deepEqual(states, [true, false]);
});

test("runtime snapshot round-trips and detects a new document boot", () => {
  const storage = memoryStorage();
  const previous = createRuntimeSnapshot({ pageInstanceId: "page-1", sessionId: "session-1", documentBootCount: 1, bootedAt: "one" });
  saveRuntimeSnapshot(storage, previous);
  assert.equal(readRuntimeSnapshot(storage).snapshot.pageInstanceId, "page-1");
  const current = createRuntimeSnapshot({ pageInstanceId: "page-2", sessionId: "session-2", documentBootCount: 2, bootedAt: "two" });
  const comparison = compareRuntimeSnapshots(previous, current);
  assert.equal(comparison.changed, true);
  assert.equal(comparison.classification, "New document boot observed");
});

test("damaged runtime snapshot does not throw", () => {
  const result = readRuntimeSnapshot(memoryStorage({ "mrbdProbe.runtimeSnapshot": "{broken" }));
  assert.equal(result.snapshot, null);
  assert.equal(result.error.name, "SyntaxError");
});
