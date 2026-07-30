import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "geo-parity.html");
const distPath = path.join(root, "dist", "geo-parity.html");
const source = await readFile(sourcePath, "utf8");
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
const pluginSourcePath = path.join(root, "plugin-location-parity.html");
const pluginDistPath = path.join(root, "dist", "plugin-location-parity.html");
const pluginSource = await readFile(pluginSourcePath, "utf8");
const pluginScript = pluginSource.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
let server;
let baseUrl;

function runtimeHarness({ previous = null, watchThrows = null } = {}) {
  const nodes = new Map();
  const events = new Map();
  const stored = new Map();
  if (previous !== null) stored.set("mrbdGeoParity.lastResult", previous);
  const watchCalls = [];
  let performanceMs = 100;
  const context = vm.createContext({
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Object,
    navigator: {
      onLine: true,
      userAgent: "Test Runtime",
      platform: "Test Platform",
      serviceWorker: { controller: {} },
      geolocation: {
        watchPosition(success, error, options) {
          if (watchThrows) throw watchThrows;
          watchCalls.push({ success, error, options });
          return 41;
        },
        clearWatch() {}
      }
    },
    document: {
      getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, { textContent: "" });
        return nodes.get(id);
      }
    },
    window: {
      isSecureContext: true,
      addEventListener(name, callback) { events.set(name, callback); }
    },
    localStorage: {
      getItem(key) { return stored.has(key) ? stored.get(key) : null; },
      setItem(key, value) { stored.set(key, String(value)); }
    },
    performance: { now: () => performanceMs },
    setInterval() { return 1; }
  });
  vm.runInContext(script, context);
  return {
    context,
    events,
    nodes,
    stored,
    watchCalls,
    setPerformance(value) { performanceMs = value; },
    text(id) { return nodes.get(id)?.textContent; }
  };
}

function pluginRuntimeHarness() {
  const nodes = new Map();
  const documentEvents = new Map();
  const windowEvents = new Map();
  const oneShotCalls = [];
  const watchCalls = [];
  const timeouts = [];
  let performanceMs = 100;
  const documentObject = {
    visibilityState: "visible",
    activeElement: null,
    getElementById(id) {
      if (!nodes.has(id)) {
        const listeners = new Map();
        const node = {
          id,
          textContent: "",
          value: "",
          disabled: false,
          hidden: false,
          className: "",
          addEventListener(name, callback) { listeners.set(name, callback); },
          dispatch(name, event) { listeners.get(name)?.(event); },
          focus() { documentObject.activeElement = node; },
          classList: { toggle() {} }
        };
        nodes.set(id, node);
      }
      return nodes.get(id);
    },
    addEventListener(name, callback) { documentEvents.set(name, callback); },
    querySelectorAll() {
      return Array.from(nodes.values()).filter((node) => !node.disabled);
    }
  };
  const locationObject = {
    href: "https://example.test/MRBDMapGameLab/plugin-location-parity.html",
    pathname: "/MRBDMapGameLab/plugin-location-parity.html"
  };
  const navigatorObject = {
    userActivation: { isActive: true, hasBeenActive: true },
    serviceWorker: { controller: null },
    geolocation: {
      getCurrentPosition(success, error, options) {
        oneShotCalls.push({ success, error, options });
      },
      watchPosition(success, error, options) {
        watchCalls.push({ success, error, options, argumentCount: arguments.length });
        return 73;
      },
      clearWatch() {}
    }
  };
  const context = vm.createContext({
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    URL,
    location: locationObject,
    navigator: navigatorObject,
    document: documentObject,
    window: {
      isSecureContext: true,
      addEventListener(name, callback) { windowEvents.set(name, callback); }
    },
    performance: { now: () => performanceMs },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(callback, delay) {
      const token = { callback, delay, cancelled: false };
      timeouts.push(token);
      return token;
    },
    clearTimeout(token) {
      if (token) token.cancelled = true;
    }
  });
  vm.runInContext(pluginScript, context);
  documentEvents.get("DOMContentLoaded")();
  const trustedEnter = () => ({
    type: "keydown",
    key: "Enter",
    repeat: false,
    isTrusted: true,
    preventDefault() {}
  });
  return {
    nodes,
    documentEvents,
    windowEvents,
    oneShotCalls,
    watchCalls,
    timeouts,
    trustedEnter,
    flushNextTimeout() {
      const token = timeouts.find((candidate) => !candidate.cancelled);
      if (!token) return false;
      token.cancelled = true;
      token.callback();
      return true;
    },
    setPerformance(value) { performanceMs = value; },
    text(id) { return nodes.get(id)?.textContent; },
    evidence() { return JSON.parse(nodes.get("evidence-json").value); }
  };
}

before(async () => {
  await execFileAsync(process.execPath, ["scripts/build-site.mjs"], { cwd: root });
  server = spawn(process.execPath, ["scripts/dev-server.mjs", "--root", "dist", "--mount", "/MRBDMapGameLab/"], {
    cwd: root,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Preview server did not start")), 5000);
    let stderr = "";
    server.stderr.on("data", (chunk) => { stderr += String(chunk); });
    server.once("exit", (code) => reject(new Error(`Preview server exited with ${code}: ${stderr.trim()}`)));
    server.stdout.on("data", (chunk) => {
      const match = String(chunk).match(/MRBD capability probe running at http:\/\/localhost:(\d+)/);
      if (!match) return;
      baseUrl = `http://127.0.0.1:${match[1]}`;
      clearTimeout(timeout);
      resolve();
    });
  });
});

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
});

test("geo-parity page is copied into dist as a non-empty HTML file", async () => {
  assert.ok((await stat(distPath)).size > 1000);
  assert.equal((await readFile(distPath, "utf8")).includes("<title>MRBD Geo Parity</title>"), true);
});

test("page contains one automatic watchPosition call path", () => {
  assert.match(source, /DOMContentLoaded[\s\S]*startWatch\(\)/);
  assert.equal((source.match(/navigator\.geolocation\.watchPosition\s*\(/g) || []).length, 1);
  assert.match(source, /enableHighAccuracy:\s*true/);
  assert.match(source, /maximumAge:\s*5000/);
  assert.match(source, /timeout:\s*30000/);
});

test("startup guard prevents a second watch from the same document", () => {
  const runtime = runtimeHarness();
  runtime.events.get("DOMContentLoaded")();
  runtime.events.get("DOMContentLoaded")();
  assert.equal(runtime.watchCalls.length, 1);
});

test("page does not call getCurrentPosition or Permissions API", () => {
  assert.equal(source.includes("navigator.geolocation.getCurrentPosition"), false);
  assert.equal(source.includes("navigator.permissions.query"), false);
});

test("page does not register a Service Worker or load external scripts", () => {
  assert.equal(source.includes("serviceWorker.register"), false);
  assert.doesNotMatch(source, /<script[^>]+\bsrc\s*=/i);
});

test("error codes 1, 2, and 3 retain their standard names", () => {
  const runtime = runtimeHarness();
  assert.equal(runtime.context.errorName(1), "PERMISSION_DENIED");
  assert.equal(runtime.context.errorName(2), "POSITION_UNAVAILABLE");
  assert.equal(runtime.context.errorName(3), "TIMEOUT");
  assert.equal(runtime.context.errorName(9), "unknown");
});

test("nullable coordinate metadata formats null, present, and unavailable", () => {
  const runtime = runtimeHarness();
  assert.equal(runtime.context.nullableState(null), "null");
  assert.equal(runtime.context.nullableState(4), "present");
  assert.equal(runtime.context.nullableState(undefined), "unavailable");
  assert.equal(runtime.context.nullableState(4, false), "unavailable");
});

test("first callback time and callback count are calculated from watch start", () => {
  const runtime = runtimeHarness();
  runtime.events.get("DOMContentLoaded")();
  runtime.setPerformance(475);
  runtime.watchCalls[0].error({ code: 3, message: "late" });
  assert.equal(runtime.text("first-callback"), "375 ms");
  assert.equal(runtime.text("callbacks"), "1");
  runtime.setPerformance(700);
  runtime.watchCalls[0].error({ code: 2, message: "again" });
  assert.equal(runtime.text("first-callback"), "375 ms");
  assert.equal(runtime.text("callbacks"), "2");
});

test("success summary stores presence but never exact coordinates", () => {
  const runtime = runtimeHarness();
  runtime.events.get("DOMContentLoaded")();
  runtime.watchCalls[0].success({
    coords: { latitude: 12.345, longitude: 67.89, accuracy: 4, speed: null, heading: 30, altitude: undefined }
  });
  const saved = runtime.stored.get("mrbdGeoParity.lastResult");
  const value = JSON.parse(saved);
  assert.equal(value.latitudePresent, true);
  assert.equal(value.longitudePresent, true);
  assert.equal(value.speedState, "null");
  assert.equal(value.headingState, "present");
  assert.equal(value.altitudeState, "unavailable");
  assert.equal(saved.includes("12.345"), false);
  assert.equal(saved.includes("67.89"), false);
  assert.equal(Object.hasOwn(value, "latitude"), false);
  assert.equal(Object.hasOwn(value, "longitude"), false);
});

test("damaged previous localStorage value does not stop automatic watch", () => {
  const runtime = runtimeHarness({ previous: "{damaged" });
  assert.doesNotThrow(() => runtime.events.get("DOMContentLoaded")());
  assert.equal(runtime.watchCalls.length, 1);
  assert.equal(runtime.text("previous-result"), "none");
});

test("synchronous watchPosition exception is visible and persisted", () => {
  const runtime = runtimeHarness({ watchThrows: Object.assign(new Error("host rejected"), { name: "SecurityError" }) });
  runtime.events.get("DOMContentLoaded")();
  assert.equal(runtime.text("call"), "synchronous-error");
  assert.equal(runtime.text("state"), "synchronous-error");
  assert.equal(runtime.text("error-name"), "SecurityError");
  assert.equal(JSON.parse(runtime.stored.get("mrbdGeoParity.lastResult")).state, "synchronous-error");
});

test("Service Worker gives the original geo-parity page an explicit network-only bypass", async () => {
  const worker = await readFile(path.join(root, "sw.js"), "utf8");
  assert.equal(worker.includes('appUrl("geo-parity.html")'), false);
  assert.match(worker, /new URL\("geo-parity\.html", APP_BASE\)\.pathname/);
  const bypassIndex = worker.indexOf("const parityPaths");
  const fallbackIndex = worker.indexOf('caches.match(INDEX_URL)');
  assert.ok(bypassIndex >= 0 && bypassIndex < fallbackIndex);
  assert.match(worker.slice(bypassIndex, fallbackIndex), /event\.respondWith\(fetch\(event\.request\)\)/);
});

test("root and GitHub Pages subpath both return geo-parity HTML", async () => {
  for (const pathname of ["/geo-parity.html", "/MRBDMapGameLab/geo-parity.html"]) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(await response.text(), /MRBD GEO PARITY/);
  }
});

test("missing preview resource remains a 404", async () => {
  const response = await fetch(`${baseUrl}/MRBDMapGameLab/not-present.html`);
  assert.equal(response.status, 404);
});

test("built page remains self-contained and does not redirect to the main app", async () => {
  const response = await fetch(`${baseUrl}/MRBDMapGameLab/geo-parity.html`, { redirect: "manual" });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(body.includes('src="./app.js"'), false);
  assert.equal(body.includes("MRBD Capability Probe"), false);
});

test("plugin Location parity page is built and served from the Pages subpath", async () => {
  assert.ok((await stat(pluginDistPath)).size > 1000);
  const response = await fetch(`${baseUrl}/MRBDMapGameLab/plugin-location-parity.html`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(await response.text(), /PLUGIN LOCATION PARITY/);
});

test("plugin parity page has no automatic Geolocation request", () => {
  const runtime = pluginRuntimeHarness();
  assert.equal(runtime.oneShotCalls.length, 0);
  assert.equal(runtime.watchCalls.length, 0);
  assert.equal(runtime.text("state"), "idle");
});

test("plugin parity one-shot exactly matches the plugin timeout-only call", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("start-one-shot").dispatch("keydown", runtime.trustedEnter());
  assert.equal(runtime.oneShotCalls.length, 1);
  assert.deepEqual({ ...runtime.oneShotCalls[0].options }, { timeout: 15000 });
  assert.equal(Object.hasOwn(runtime.oneShotCalls[0].options, "enableHighAccuracy"), false);
  assert.equal(Object.hasOwn(runtime.oneShotCalls[0].options, "maximumAge"), false);
});

test("trusted Enter and synthesized click cannot duplicate the one-shot", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("start-one-shot").dispatch("keydown", runtime.trustedEnter());
  runtime.nodes.get("start-one-shot").dispatch("click", { type: "click", isTrusted: true });
  assert.equal(runtime.oneShotCalls.length, 1);
});

test("plugin parity watch passes no options argument", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("start-watch").dispatch("keydown", runtime.trustedEnter());
  assert.equal(runtime.watchCalls.length, 1);
  assert.equal(runtime.watchCalls[0].argumentCount, 2);
  assert.equal(runtime.watchCalls[0].options, undefined);
});

test("compact matrix starts the old bootstrap case directly from one trusted Enter", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("run-matrix").dispatch("keydown", runtime.trustedEnter());
  assert.equal(runtime.oneShotCalls.length, 1);
  assert.deepEqual({ ...runtime.oneShotCalls[0].options }, {
    enableHighAccuracy: false,
    timeout: 3000,
    maximumAge: 60000
  });
  assert.equal(runtime.text("matrix-old-bootstrap-state"), "RUNNING");
});

test("compact matrix advances sequentially and keeps PASS rows compact", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("run-matrix").dispatch("keydown", runtime.trustedEnter());
  runtime.oneShotCalls[0].success({
    coords: { latitude: 1, longitude: 2, accuracy: 8 }
  });
  assert.equal(runtime.text("matrix-old-bootstrap-state"), "PASS");
  assert.equal(runtime.nodes.get("matrix-old-bootstrap-detail").hidden, true);
  assert.equal(runtime.flushNextTimeout(), true);
  assert.equal(runtime.oneShotCalls.length, 2);
  assert.deepEqual({ ...runtime.oneShotCalls[1].options }, { timeout: 15000 });
});

test("compact matrix expands failure details and enables trusted confirmation after completion", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("run-matrix").dispatch("keydown", runtime.trustedEnter());
  runtime.oneShotCalls[0].error({ code: 1, name: "GeolocationPositionError", message: "User denied Geolocation" });
  assert.equal(runtime.text("matrix-old-bootstrap-state"), "FAIL");
  assert.equal(runtime.nodes.get("matrix-old-bootstrap-detail").hidden, false);
  assert.match(runtime.text("matrix-old-bootstrap-detail"), /User denied Geolocation/);
  assert.match(runtime.text("matrix-old-bootstrap-detail"), /"timeout":3000/);
});

test("compact matrix declares all seven controlled cases", () => {
  assert.match(pluginSource, /old-bootstrap[\s\S]*enableHighAccuracy:\s*false,\s*timeout:\s*3000,\s*maximumAge:\s*60000/);
  assert.match(pluginSource, /plugin-one-shot[\s\S]*timeout:\s*15000/);
  assert.match(pluginSource, /timeout-3s[\s\S]*timeout:\s*3000/);
  assert.match(pluginSource, /explicit-low[\s\S]*enableHighAccuracy:\s*false,\s*timeout:\s*15000/);
  assert.match(pluginSource, /cached-low[\s\S]*timeout:\s*15000,\s*maximumAge:\s*60000/);
  assert.match(pluginSource, /high-accuracy[\s\S]*enableHighAccuracy:\s*true,\s*timeout:\s*15000,\s*maximumAge:\s*0/);
  assert.match(pluginSource, /plugin-watch[\s\S]*kind:\s*"watch",\s*options:\s*null/);
});

test("plugin parity evidence never retains exact coordinates", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("start-one-shot").dispatch("keydown", runtime.trustedEnter());
  runtime.setPerformance(680);
  runtime.oneShotCalls[0].success({
    coords: { latitude: 12.345678, longitude: 87.654321, accuracy: 6 }
  });
  const serialized = JSON.stringify(runtime.evidence());
  assert.equal(serialized.includes("12.345678"), false);
  assert.equal(serialized.includes("87.654321"), false);
  assert.equal(runtime.evidence().activeCall.result.latitudePresent, true);
  assert.equal(runtime.evidence().activeCall.result.longitudePresent, true);
  assert.equal(runtime.evidence().activeCall.result.accuracy, 6);
});

test("plugin parity preserves standard error evidence and callback timing", () => {
  const runtime = pluginRuntimeHarness();
  runtime.nodes.get("start-one-shot").dispatch("keydown", runtime.trustedEnter());
  runtime.setPerformance(3013);
  runtime.oneShotCalls[0].error({
    code: 1,
    name: "GeolocationPositionError",
    message: "User denied Geolocation"
  });
  assert.equal(runtime.text("state"), "error");
  assert.equal(runtime.text("error-code"), "1");
  assert.equal(runtime.text("error-name"), "PERMISSION_DENIED");
  assert.equal(runtime.text("error-message"), "User denied Geolocation");
  assert.equal(runtime.text("first-callback"), "2913 ms");
});

test("plugin parity source has no Sensors, Permissions preflight, SW registration, or external scripts", () => {
  assert.equal(pluginSource.includes("DeviceOrientationEvent"), false);
  assert.equal(pluginSource.includes("DeviceMotionEvent"), false);
  assert.equal(pluginSource.includes("navigator.permissions"), false);
  assert.equal(pluginSource.includes("serviceWorker.register"), false);
  assert.doesNotMatch(pluginSource, /<script[^>]+\bsrc\s*=/i);
});

test("Service Worker gives both parity pages network-only bypasses", async () => {
  const worker = await readFile(path.join(root, "sw.js"), "utf8");
  assert.match(worker, /new URL\("geo-parity\.html", APP_BASE\)\.pathname/);
  assert.match(worker, /new URL\("plugin-location-parity\.html", APP_BASE\)\.pathname/);
  const bypassIndex = worker.indexOf("const parityPaths");
  const fallbackIndex = worker.indexOf("caches.match(INDEX_URL)");
  assert.ok(bypassIndex >= 0 && bypassIndex < fallbackIndex);
  assert.match(worker.slice(bypassIndex, fallbackIndex), /event\.respondWith\(fetch\(event\.request\)\)/);
});
