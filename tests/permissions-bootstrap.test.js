import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createPermissionBootstrap,
  PERMISSION_BOOTSTRAP_GEOLOCATION_OPTIONS
} from "../modules/permissions-bootstrap.js";

function createHarness({
  orientation,
  motion,
  geolocation = {}
} = {}) {
  const logs = [];
  const updates = [];
  const calls = [];
  let monotonicMs = 100;
  const globalObject = {
    DeviceOrientationEvent: orientation,
    DeviceMotionEvent: motion,
    isSecureContext: true,
    location: { href: "https://example.test/index.html" },
    navigator: {
      userActivation: { isActive: true, hasBeenActive: true },
      serviceWorker: { controller: null }
    },
    document: {
      querySelector(selector) {
        return selector.includes("mrbd-web-app-capable") ? {} : null;
      }
    }
  };
  const geo = {
    getCurrentPosition(success, error, options) {
      calls.push({ success, error, options });
      return geolocation.getCurrentPosition?.(success, error, options);
    }
  };
  const bootstrap = createPermissionBootstrap({
    globalObject,
    geolocation: geolocation.missing ? undefined : geo,
    logger: {
      log(module, event, payload) {
        logs.push({ module, event, payload });
      }
    },
    onUpdate: (snapshot) => updates.push(snapshot),
    wallTime: () => "2026-07-30T10:00:00.000Z",
    monotonicNow: () => monotonicMs
  });
  return {
    bootstrap,
    calls,
    logs,
    updates,
    advance(ms) { monotonicMs += ms; }
  };
}

const trustedEnter = {
  type: "keydown",
  key: "Enter",
  isTrusted: true,
  userActivation: { isActive: true, hasBeenActive: true }
};
const trustedClick = {
  type: "click",
  isTrusted: true,
  userActivation: { isActive: true, hasBeenActive: true }
};

test("trusted Enter issues Location synchronously when sensor requestPermission methods are absent", () => {
  const value = createHarness({
    orientation: function DeviceOrientationEvent() {},
    motion: function DeviceMotionEvent() {}
  });
  const result = value.bootstrap.startFromEvent(trustedEnter);
  assert.equal(result.accepted, true);
  assert.equal(value.calls.length, 1);
  assert.deepEqual(value.calls[0].options, PERMISSION_BOOTSTRAP_GEOLOCATION_OPTIONS);
  assert.equal(value.bootstrap.snapshot().sensors.orientation, "requestPermission-missing");
  assert.equal(value.bootstrap.snapshot().sensors.motion, "requestPermission-missing");
});

test("ordinary trusted click starts the bootstrap", () => {
  const value = createHarness();
  const result = value.bootstrap.startFromEvent(trustedClick);
  assert.equal(result.accepted, true);
  assert.equal(value.bootstrap.snapshot().input.type, "click");
  assert.equal(value.calls.length, 1);
});

test("untrusted input is rejected without calling permission APIs", () => {
  const value = createHarness();
  const result = value.bootstrap.startFromEvent({ type: "click", isTrusted: false });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "untrusted-event");
  assert.equal(value.calls.length, 0);
  assert.equal(value.bootstrap.isStarted(), false);
});

test("a second event is blocked for the same document instance", () => {
  const value = createHarness();
  value.bootstrap.startFromEvent(trustedEnter);
  const duplicate = value.bootstrap.startFromEvent(trustedClick);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "already-started");
  assert.equal(value.calls.length, 1);
  assert.ok(value.logs.some((entry) => entry.event === "duplicate-start-blocked"));
});

test("Orientation then Motion permission results precede Location", async () => {
  const order = [];
  function Orientation() {}
  Orientation.requestPermission = async () => {
    order.push("orientation");
    return "granted";
  };
  function Motion() {}
  Motion.requestPermission = async () => {
    order.push("motion");
    return "denied";
  };
  const value = createHarness({
    orientation: Orientation,
    motion: Motion,
    geolocation: {
      getCurrentPosition() {
        order.push("location");
      }
    }
  });
  const result = value.bootstrap.startFromEvent(trustedEnter);
  await result.completion;
  assert.deepEqual(order, ["orientation", "motion", "location"]);
  assert.equal(value.bootstrap.snapshot().sensors.orientation, "granted");
  assert.equal(value.bootstrap.snapshot().sensors.motion, "denied");
  assert.deepEqual(
    value.logs
      .filter((entry) => entry.event === "sensor-permission-issued")
      .map((entry) => entry.payload.sensor),
    ["orientation", "motion"]
  );
});

test("sensor permission errors are recorded and Location still runs", async () => {
  function Orientation() {}
  Orientation.requestPermission = async () => {
    throw Object.assign(new Error("orientation blocked"), { name: "NotAllowedError" });
  };
  function Motion() {}
  Motion.requestPermission = async () => "granted";
  const value = createHarness({ orientation: Orientation, motion: Motion });
  const result = value.bootstrap.startFromEvent(trustedEnter);
  await result.completion;
  assert.equal(value.bootstrap.snapshot().sensors.orientation, "error");
  assert.equal(value.bootstrap.snapshot().sensors.motion, "granted");
  assert.equal(value.calls.length, 1);
  const failure = value.logs.find((entry) => entry.event === "sensor-permission-error");
  assert.equal(failure.payload.error.name, "NotAllowedError");
  assert.equal(failure.payload.error.message, "orientation blocked");
});

test("missing sensor constructors and missing Geolocation remain distinguishable", async () => {
  const value = createHarness({ geolocation: { missing: true } });
  const result = value.bootstrap.startFromEvent(trustedEnter);
  await result.completion;
  const snapshot = value.bootstrap.snapshot();
  assert.equal(snapshot.sensors.orientation, "api-missing");
  assert.equal(snapshot.sensors.motion, "api-missing");
  assert.equal(snapshot.location.state, "api-missing");
  assert.equal(snapshot.state, "complete");
});

test("a synchronous Geolocation exception is visible", async () => {
  const value = createHarness({
    geolocation: {
      getCurrentPosition() {
        throw Object.assign(new Error("host rejected call"), { name: "SecurityError" });
      }
    }
  });
  const result = value.bootstrap.startFromEvent(trustedEnter);
  await result.completion;
  const snapshot = value.bootstrap.snapshot();
  assert.equal(snapshot.location.state, "synchronous-error");
  assert.equal(snapshot.location.error.name, "SecurityError");
  assert.ok(value.logs.some((entry) => entry.event === "geolocation-synchronous-error"));
});

test("Geolocation error codes 1, 2, and 3 retain standard names", () => {
  const expected = ["PERMISSION_DENIED", "POSITION_UNAVAILABLE", "TIMEOUT"];
  expected.forEach((codeName, index) => {
    const value = createHarness();
    value.bootstrap.startFromEvent(trustedEnter);
    value.advance(25);
    value.calls[0].error({ code: index + 1, message: codeName.toLowerCase() });
    const snapshot = value.bootstrap.snapshot();
    assert.equal(snapshot.location.error.codeName, codeName);
    assert.equal(snapshot.location.firstCallbackElapsedMs, 25);
  });
});

test("success snapshot stores presence and accuracy but never exact coordinates", () => {
  const value = createHarness();
  value.bootstrap.startFromEvent(trustedEnter);
  value.advance(40);
  value.calls[0].success({
    coords: { latitude: 48.123456, longitude: 6.123456, accuracy: 12 }
  });
  const snapshot = value.bootstrap.snapshot();
  assert.deepEqual(snapshot.location.result, {
    latitudePresent: true,
    longitudePresent: true,
    accuracy: 12
  });
  assert.equal(snapshot.location.firstCallbackElapsedMs, 40);
  assert.equal(JSON.stringify(snapshot).includes("48.123456"), false);
  assert.equal(JSON.stringify(snapshot).includes("6.123456"), false);
});

test("source constraints preserve the isolated permission experiment", async () => {
  const [moduleSource, appSource, html] = await Promise.all([
    readFile(new URL("../modules/permissions-bootstrap.js", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(moduleSource, /navigator\.permissions|permissions\.query/i);
  assert.doesNotMatch(moduleSource, /watchPosition|getUserMedia|mediaDevices|microphone/i);
  assert.match(html, /<meta name="mrbd-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="viewport" content="width=600,height=600/);
  const firstHomeButton = html.match(/<nav class="probe-menu[\s\S]*?<button ([^>]+)>/);
  assert.match(firstHomeButton?.[1] || "", /data-open="permissions"/);
  assert.equal((appSource.match(/refreshLocationPermission\(\);/g) || []).length, 0);
});
