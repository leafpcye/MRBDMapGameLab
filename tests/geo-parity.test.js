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

test("Service Worker gives geo-parity an explicit network-only bypass", async () => {
  const worker = await readFile(path.join(root, "sw.js"), "utf8");
  assert.equal(worker.includes('appUrl("geo-parity.html")'), false);
  assert.match(worker, /requestUrl\.pathname === new URL\("geo-parity\.html", APP_BASE\)\.pathname/);
  const bypassIndex = worker.indexOf('new URL("geo-parity.html", APP_BASE)');
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
