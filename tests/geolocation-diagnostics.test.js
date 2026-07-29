import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedDiagnosticEvents,
  createFinitePager,
  createGeolocationRequestMachine,
  formatDiagnosticValue,
  locationPresetOptions,
  queryGeolocationPermission,
  userActivationSnapshot
} from "../modules/location.js";
import { classifyNetworkEvidence, runNetworkProbe } from "../modules/network.js";

function harness({ permissionState = "prompt", permissionError = null } = {}) {
  const transitions = [];
  const calls = [];
  const timers = [];
  let wall = 1000;
  const geolocation = {
    getCurrentPosition(success, error, options) {
      calls.push({ success, error, options });
    }
  };
  const permissions = {
    query() {
      return permissionError ? Promise.reject(permissionError) : Promise.resolve({ state: permissionState });
    }
  };
  const machine = createGeolocationRequestMachine({
    geolocation,
    permissions,
    now: () => wall,
    monotonicNow: () => wall / 10,
    idFactory: () => "geo-one-test",
    schedule(callback, delay) {
      const token = { callback, delay, cancelled: false };
      timers.push(token);
      return token;
    },
    cancelSchedule(token) { token.cancelled = true; },
    onTransition: (value) => transitions.push(value)
  });
  return {
    machine,
    calls,
    timers,
    transitions,
    advance(ms) { wall += ms; }
  };
}

const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
const trustedEnter = {
  type: "keydown",
  key: "Enter",
  isTrusted: true,
  userActivation: { isActive: true, hasBeenActive: true }
};

test("trusted Enter enters the handler and issues geolocation synchronously", () => {
  const value = harness();
  const result = value.machine.requestFromTrustedEnter(trustedEnter, options, "prompt");
  assert.equal(result.accepted, true);
  assert.equal(value.calls.length, 1);
  assert.equal(value.machine.snapshot().handlerEntered, true);
  assert.equal(value.machine.snapshot().callIssued, true);
});

test("trusted Enter direct request does not depend on synthetic click", () => {
  const value = harness();
  value.machine.requestFromTrustedEnter(trustedEnter, options, "prompt");
  assert.equal(value.calls.length, 1);
  assert.equal(value.machine.snapshot().triggerSource, "keyboard");
});

test("click following trusted Enter is deduplicated", () => {
  const value = harness();
  value.machine.requestFromTrustedEnter(trustedEnter, options, "prompt");
  const duplicate = value.machine.requestFromClick({ type: "click", isTrusted: true }, options, "prompt");
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "trusted-enter-token");
  assert.equal(value.calls.length, 1);
});

test("repeated trusted Enter is deduplicated while a request is in flight", () => {
  const value = harness();
  value.machine.requestFromTrustedEnter(trustedEnter, options, "prompt");
  const repeated = value.machine.requestFromTrustedEnter({ ...trustedEnter, repeat: true }, options, "prompt");
  assert.equal(repeated.accepted, false);
  assert.equal(repeated.reason, "request-in-flight");
  assert.equal(value.calls.length, 1);
});

test("ordinary click directly issues a request", () => {
  const value = harness();
  const result = value.machine.requestFromClick({ type: "click", isTrusted: true, userActivation: { isActive: true, hasBeenActive: true } }, options, "prompt");
  assert.equal(result.accepted, true);
  assert.equal(value.calls.length, 1);
  assert.equal(value.machine.snapshot().triggerSource, "click");
});

test("request state transitions reach waiting in order", () => {
  const value = harness();
  value.machine.requestFromClick({ type: "click", isTrusted: true }, options, "prompt");
  assert.deepEqual(value.transitions.slice(0, 4).map((item) => item.state), [
    "input-received", "request-entered", "request-issued", "waiting"
  ]);
});

test("success records presence without exposing coordinates in request diagnostics", () => {
  const value = harness();
  value.machine.requestFromClick({ type: "click", isTrusted: true }, options, "prompt");
  value.calls[0].success({ coords: { latitude: 12, longitude: 34, accuracy: 7 } });
  const snapshot = value.machine.snapshot();
  assert.equal(snapshot.state, "success");
  assert.deepEqual(snapshot.result, {
    latitudePresent: true,
    longitudePresent: true,
    accuracy: 7,
    error: null
  });
  assert.equal(JSON.stringify(snapshot).includes('"latitude":12'), false);
});

test("standard geolocation error is retained", () => {
  const value = harness();
  value.machine.requestFromClick({ type: "click", isTrusted: true }, options, "prompt");
  value.calls[0].error({ code: 1, name: "PositionError", message: "denied" });
  assert.equal(value.machine.snapshot().state, "error");
  assert.equal(value.machine.snapshot().result.error.codeName, "PERMISSION_DENIED");
  assert.equal(value.machine.snapshot().result.error.message, "denied");
});

test("diagnostic watchdog creates a distinct client-timeout", () => {
  const value = harness();
  value.machine.requestFromClick({ type: "click", isTrusted: true }, options, "prompt");
  assert.equal(value.timers[0].delay, 17000);
  value.advance(17000);
  value.timers[0].callback();
  assert.equal(value.machine.snapshot().state, "client-timeout");
  assert.equal(value.machine.snapshot().result.error.codeName, "CLIENT_TIMEOUT");
});

test("permission query reports prompt, granted, and denied", async () => {
  for (const state of ["prompt", "granted", "denied"]) {
    const result = await queryGeolocationPermission({ query: async () => ({ state }) });
    assert.equal(result.state, state);
  }
});

test("permission query failure does not prevent the synchronous request", async () => {
  const value = harness({ permissionError: new Error("host blocked query") });
  const permission = await queryGeolocationPermission({ query: async () => { throw new Error("host blocked query"); } });
  value.machine.requestFromClick({ type: "click", isTrusted: true }, options, permission.state);
  assert.equal(value.calls.length, 1);
  assert.equal(permission.state, "query-error");
  assert.equal(value.machine.snapshot().permissionStateBefore, "query-error");
});

test("user activation fields are explicit when present or missing", () => {
  assert.deepEqual(userActivationSnapshot({ userActivation: { isActive: true, hasBeenActive: false } }), {
    isActive: true,
    hasBeenActive: false
  });
  assert.deepEqual(userActivationSnapshot({}), { isActive: "unavailable", hasBeenActive: "unavailable" });
});

test("preset selector maps all three button values to finite options", () => {
  assert.deepEqual(locationPresetOptions("high-accuracy"), options);
  assert.equal(locationPresetOptions("balanced").timeout, 10000);
  assert.equal(locationPresetOptions("cached-quick").timeout, 5000);
  assert.throws(() => locationPresetOptions("missing"), /Unknown location preset/);
});

test("Location pager has five finite pages and never wraps", () => {
  const pager = createFinitePager(["request", "current", "stats", "quality", "events"]);
  assert.equal(pager.snapshot().page, "request");
  pager.previous();
  assert.equal(pager.snapshot().page, "request");
  for (let index = 0; index < 8; index += 1) pager.next();
  assert.deepEqual(pager.snapshot(), {
    index: 4, page: "events", pageNumber: 5, pageCount: 5, canPrevious: true, canNext: false
  });
});

test("bounded dynamic diagnostics do not grow the primary structure", () => {
  let entries = [];
  for (let index = 1; index <= 12; index += 1) entries = boundedDiagnosticEvents(entries, { index }, 5);
  assert.deepEqual(entries.map((item) => item.index), [8, 9, 10, 11, 12]);
});

test("network evidence distinguishes navigator and live fetch combinations", () => {
  assert.equal(classifyNetworkEvidence({ navigatorOnLine: false, liveFetchSucceeded: true }), "Runtime says offline, live fetch succeeds");
  assert.equal(classifyNetworkEvidence({ navigatorOnLine: true, liveFetchSucceeded: false }), "Runtime says online, live fetch fails");
  assert.equal(classifyNetworkEvidence({ navigatorOnLine: true, liveFetchSucceeded: true }), "Both online");
  assert.equal(classifyNetworkEvidence({ navigatorOnLine: false, liveFetchSucceeded: false }), "Both unavailable");
  assert.equal(classifyNetworkEvidence({ navigatorOnLine: true, liveFetchSucceeded: null }), "Not tested");
});

test("network live probe requests timestamped build-info with no-store", async () => {
  let observed = null;
  const logger = { log() {} };
  const result = await runNetworkProbe(logger, {
    navigatorOnLine: false,
    fetchImpl: async (url, init) => {
      observed = { url: String(url), init };
      return { ok: true, status: 200, text: async () => "ok" };
    },
    now: () => new Date("2026-07-29T00:00:00.000Z"),
    monotonicNow: (() => { let value = 0; return () => (value += 5); })()
  });
  assert.match(observed.url, /build-info\.js\?network_probe=\d+/);
  assert.equal(observed.init.cache, "no-store");
  assert.equal(result.interpretation, "Runtime says offline, live fetch succeeds");
});

test("empty, null, and undefined diagnostics remain distinguishable", () => {
  assert.equal(formatDiagnosticValue(""), "(empty)");
  assert.equal(formatDiagnosticValue(null), "(null)");
  assert.equal(formatDiagnosticValue(undefined), "(undefined)");
});
