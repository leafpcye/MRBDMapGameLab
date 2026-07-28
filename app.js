import { BUILD_INFO } from "./build-info.js";
import { createLogger } from "./modules/logger.js";
import { collectEnvironment, environmentRows } from "./modules/environment.js";
import { createInputProbe } from "./modules/input.js";
import { createStorageHelper, errorDetails } from "./modules/storage.js";
import { installLifecycleProbe } from "./modules/lifecycle.js";
import { runNetworkProbe } from "./modules/network.js";
import { snapshotJSON, snapshotCSV, triggerDownload, copyText, shareJSON } from "./modules/export.js";
import { renderRows, renderRecent, shortId } from "./modules/ui.js";

const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const pageInstanceId = id("page");
let sessionId;
try {
  sessionId = sessionStorage.getItem("mrbdProbe.sessionId") || id("session");
  sessionStorage.setItem("mrbdProbe.sessionId", sessionId);
} catch {
  sessionId = id("session");
}

let environmentSnapshot = null;
const logger = createLogger({
  sessionId,
  pageInstanceId,
  appVersion: BUILD_INFO.version,
  gitCommit: BUILD_INFO.gitCommit,
  environmentProvider: () => environmentSnapshot || collectEnvironment()
});

let launchState = { launchCount: "unavailable", firstLaunchAt: "unavailable", lastLaunchAt: "unavailable" };
try {
  launchState = createStorageHelper(localStorage).recordLaunch();
  logger.log("storage", "launch-recorded", launchState);
} catch (error) {
  logger.log("storage", "launch-record-failed", errorDetails(error));
}

const lifecycleState = { lastEvent: "script-start", bfcacheEvidence: false };
const lifecycleProbe = installLifecycleProbe(logger, (update) => {
  Object.assign(lifecycleState, update);
  updateLifecycleReadout();
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
$("#app-version").textContent = BUILD_INFO.version;
$("#git-commit").textContent = BUILD_INFO.gitCommit;
$("#session-short").textContent = shortId(sessionId);
updateNetworkStatus();

function currentPage() {
  return $(".page.active")?.dataset.page || "home";
}

function openPage(page) {
  $$(".page").forEach((section) => section.classList.toggle("active", section.dataset.page === page));
  $("#current-page").textContent = page[0].toUpperCase() + page.slice(1);
  logger.log("ui", "page-opened", { page });
  const first = $(`.page[data-page="${page}"] button, .page[data-page="${page}"] input`);
  requestAnimationFrame(() => first?.focus());
  refreshRecent();
  if (page === "lifecycle") updateLifecycleReadout();
}

$$("[data-open]").forEach((button) => button.addEventListener("click", () => openPage(button.dataset.open)));
$$("[data-back]").forEach((button) => button.addEventListener("click", () => openPage("home")));

// App-level keyboard routing is intentionally skipped on Input so raw Escape and
// direction events reach the probe without navigation side effects.
document.addEventListener("keydown", (event) => {
  if (currentPage() === "input") return;
  if (event.key === "Escape" && currentPage() !== "home") {
    event.preventDefault();
    openPage("home");
    return;
  }
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  const focusable = $$(`.page.active button:not([disabled]), .page.active input:not([disabled])`);
  const index = focusable.indexOf(document.activeElement);
  if (index < 0) return;
  const columns = currentPage() === "home" ? 2 : 1;
  const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -columns : columns;
  const next = index + delta;
  if (next >= 0 && next < focusable.length) {
    event.preventDefault();
    focusable[next].focus();
  }
});

function refreshRecent() {
  const entries = logger.getEntries();
  $$("[data-recent]").forEach((container) => {
    renderRecent(container, entries.filter((entry) => entry.module === container.dataset.recent));
  });
  $("#footer-count").textContent = `${entries.length} log ${entries.length === 1 ? "entry" : "entries"}`;
}
logger.subscribe(refreshRecent);

$$("[data-clear]").forEach((button) => button.addEventListener("click", () => {
  const module = button.dataset.clear;
  logger.clear(module);
  refreshRecent();
}));

$("#run-environment").addEventListener("click", () => {
  try {
    environmentSnapshot = collectEnvironment();
    logger.log("environment", "probe-complete", environmentSnapshot);
    renderRows($("#environment-output"), environmentRows(environmentSnapshot));
    $("#environment-status").textContent = `Captured ${environmentSnapshot.capturedAt}`;
  } catch (error) {
    logger.log("environment", "probe-failed", errorDetails(error));
    $("#environment-status").textContent = `${error.name}: ${error.message}`;
  }
});
$("#copy-environment").addEventListener("click", async () => {
  if (!environmentSnapshot) environmentSnapshot = collectEnvironment();
  const result = await copyText(logger, JSON.stringify(environmentSnapshot, null, 2), "Environment summary");
  $("#environment-status").textContent = result.message;
});

for (let index = 1; index <= 12; index += 1) {
  const button = document.createElement("button");
  button.dataset.testControl = `long-${index}`;
  button.textContent = `Long item ${String(index).padStart(2, "0")}`;
  $("#long-list").append(button);
}
const inputUi = { active: false, eventCount: 0 };
const inputProbe = createInputProbe({
  logger,
  root: $("#input-controls"),
  onUpdate(update) {
    Object.assign(inputUi, update);
    $("#input-status").textContent = `${inputUi.active ? "Running" : "Stopped"} · ${inputUi.eventCount} events observed`;
    $("#input-count").textContent = String(inputUi.eventCount);
    if (update.focus) $("#input-focus").textContent = update.focus;
    if (update.selection) $("#input-selection").textContent = update.selection;
    if (update.pairText) $("#input-pair").textContent = update.pairText;
  }
});
$("#start-input").addEventListener("click", () => inputProbe.start());
$("#stop-input").addEventListener("click", () => inputProbe.stop());
$("#prevent-default").addEventListener("click", (event) => {
  const enabled = event.currentTarget.getAttribute("aria-pressed") !== "true";
  inputProbe.setPreventNavigation(enabled);
  event.currentTarget.setAttribute("aria-pressed", String(enabled));
  event.currentTarget.textContent = `Prevent navigation defaults: ${enabled ? "On" : "Off"}`;
});

async function runStorageAction(label, action) {
  $("#storage-status").textContent = `${label} running…`;
  try {
    const result = await action();
    logger.log("storage", `${label}-complete`, result);
    renderRows($("#storage-output"), Object.entries(flatten(result)));
    $("#storage-status").textContent = `${label} complete`;
  } catch (error) {
    const details = errorDetails(error);
    logger.log("storage", `${label}-failed`, details);
    renderRows($("#storage-output"), Object.entries(details));
    $("#storage-status").textContent = `${details.name}: ${details.message}`;
  }
}

$("#test-local").addEventListener("click", () => runStorageAction("localStorage-test", () => {
  const helper = createStorageHelper(localStorage);
  const value = $("#storage-value").value;
  helper.set("testValue", value);
  const read = helper.get("testValue");
  helper.set("testValue", `${value}-updated`);
  const updated = helper.get("testValue");
  helper.setJSON("jsonTest", { value, at: new Date().toISOString() });
  const json = helper.getJSON("jsonTest");
  helper.set("temporary", "delete-me");
  helper.remove("temporary");
  return { accessible: true, written: value, read, updated, json, deleted: helper.get("temporary") === null, ...launchState };
}));
$("#test-session").addEventListener("click", () => runStorageAction("sessionStorage-test", () => {
  const helper = createStorageHelper(sessionStorage);
  const priorReloadValue = helper.get("reloadValue");
  helper.set("testValue", $("#storage-value").value);
  const read = helper.get("testValue");
  helper.set("testValue", `${read}-updated`);
  const updated = helper.get("testValue");
  helper.remove("testValue");
  helper.set("reloadValue", `set-${new Date().toISOString()}`);
  return { written: true, read, updated, removed: helper.get("testValue") === null, priorReloadValue, reloadValue: helper.get("reloadValue") };
}));
$("#test-idb").addEventListener("click", () => runStorageAction("indexedDB-test", testIndexedDB));
$("#test-cache").addEventListener("click", () => runStorageAction("cacheStorage-test", testCacheStorage));
$("#register-sw").addEventListener("click", () => runStorageAction("serviceWorker-register", registerServiceWorker));
$("#update-sw").addEventListener("click", () => runStorageAction("serviceWorker-update", updateServiceWorker));
$("#unregister-sw").addEventListener("click", () => runStorageAction("serviceWorker-unregister", unregisterServiceWorker));

function testIndexedDB() {
  if (!("indexedDB" in window)) throw Object.assign(new Error("API missing"), { name: "MissingAPIError" });
  const name = "mrbd-probe-phase-1a";
  return new Promise((resolve, reject) => {
    const steps = [];
    let currentStep = "open";
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      currentStep = "create-store";
      steps.push("open", "create-store");
      logger.log("storage", "indexedDB-step", { step: "open", status: "success", phase: "upgrade" });
      if (!request.result.objectStoreNames.contains("probe")) request.result.createObjectStore("probe", { keyPath: "id" });
      logger.log("storage", "indexedDB-step", { step: "create-store", status: "success" });
    };
    request.onerror = () => {
      const error = request.error || new Error("IndexedDB open failed");
      logger.log("storage", "indexedDB-step", { step: currentStep, status: "failed", error: errorDetails(error) });
      reject(error);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!steps.includes("open")) {
        steps.push("open");
        logger.log("storage", "indexedDB-step", { step: "open", status: "success" });
      }
      const transaction = db.transaction("probe", "readwrite");
      const store = transaction.objectStore("probe");
      const record = { id: "test", value: $("#storage-value").value };
      currentStep = "write";
      const write = store.put(record);
      write.onsuccess = () => {
        steps.push("write");
        logger.log("storage", "indexedDB-step", { step: "write", status: "success" });
        currentStep = "read";
        const read = store.get("test");
        read.onsuccess = () => {
          steps.push("read");
          logger.log("storage", "indexedDB-step", { step: "read", status: "success" });
          const value = read.result;
          currentStep = "delete";
          const remove = store.delete("test");
          remove.onsuccess = () => {
            steps.push("delete");
            logger.log("storage", "indexedDB-step", { step: "delete", status: "success" });
          };
          transaction.oncomplete = () => {
            currentStep = "close";
            db.close();
            steps.push("close");
            logger.log("storage", "indexedDB-step", { step: "close", status: "success" });
            resolve({ steps, readValue: value });
          };
        };
      };
      transaction.onerror = () => {
        db.close();
        const error = transaction.error || new Error("IndexedDB transaction failed");
        logger.log("storage", "indexedDB-step", { step: currentStep, status: "failed", error: errorDetails(error) });
        reject(error);
      };
    };
  });
}

async function testCacheStorage() {
  if (!("caches" in window)) throw Object.assign(new Error("API missing"), { name: "MissingAPIError" });
  const name = "mrbd-probe-storage-test-v1";
  const cache = await caches.open(name);
  logger.log("storage", "cacheStorage-step", { step: "create", status: "success", cacheName: name });
  const url = new URL("/__mrbd-cache-probe__", location.origin).href;
  await cache.put(url, new Response("mrbd-cache-probe", { headers: { "Content-Type": "text/plain" } }));
  logger.log("storage", "cacheStorage-step", { step: "write", status: "success", url });
  const match = await cache.match(url);
  const text = await match?.text();
  logger.log("storage", "cacheStorage-step", { step: "read", status: match ? "success" : "missing", value: text ?? null });
  const deleted = await caches.delete(name);
  logger.log("storage", "cacheStorage-step", { step: "delete", status: deleted ? "success" : "not-deleted" });
  return { steps: ["create", "write", "read", "delete"], readValue: text, cacheDeleted: deleted };
}

function swState(registration) {
  return {
    scope: registration.scope,
    installing: registration.installing?.state || "none",
    waiting: registration.waiting?.state || "none",
    active: registration.active?.state || "none",
    controller: navigator.serviceWorker.controller?.scriptURL || "none"
  };
}
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) throw Object.assign(new Error("API missing"), { name: "MissingAPIError" });
  const registration = await navigator.serviceWorker.register("/sw.js");
  return swState(registration);
}
async function updateServiceWorker() {
  if (!("serviceWorker" in navigator)) throw Object.assign(new Error("API missing"), { name: "MissingAPIError" });
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw Object.assign(new Error("No registration found"), { name: "NotRegisteredError" });
  await registration.update();
  return swState(registration);
}
async function unregisterServiceWorker() {
  if (!("serviceWorker" in navigator)) throw Object.assign(new Error("API missing"), { name: "MissingAPIError" });
  const registration = await navigator.serviceWorker.getRegistration();
  return { found: Boolean(registration), unregistered: registration ? await registration.unregister() : false };
}

function updateLifecycleReadout() {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  const rows = [
    ["Visibility", document.visibilityState],
    ["Page instance", pageInstanceId],
    ["Session", sessionId],
    ["Launch count", String(launchState.launchCount)],
    ["Elapsed since script", `${(performance.now() - lifecycleProbe.startedAt).toFixed(1)} ms`],
    ["Navigation evidence", navigation?.type || "unavailable"],
    ["BFCache evidence", lifecycleState.bfcacheEvidence ? "pageshow.persisted=true observed" : "Not observed"],
    ["Last lifecycle event", lifecycleState.lastEvent]
  ];
  const container = $("#lifecycle-readout");
  if (!container) return;
  container.replaceChildren();
  rows.forEach(([term, value]) => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    wrap.append(dt, dd);
    container.append(wrap);
  });
}
$("#add-marker").addEventListener("click", () => {
  const note = $("#marker-note").value.trim();
  logger.log("lifecycle", "marker", { note: note || "(no note)" });
  $("#lifecycle-status").textContent = `Marker recorded: ${note || "(no note)"}`;
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
function updateNetworkStatus(event) {
  $("#network-status").textContent = navigator.onLine ? "ONLINE*" : "OFFLINE*";
  if (event?.type) logger.log("network", event.type, { navigatorOnLine: navigator.onLine });
}
$("#run-network").addEventListener("click", async () => {
  $("#network-probe-status").textContent = "Fetch running…";
  const result = await runNetworkProbe(logger, $("#bypass-cache").checked);
  renderRows($("#network-output"), Object.entries(flatten(result)));
  $("#network-probe-status").textContent = result.error ? `${result.error.name}: ${result.error.message}` : `HTTP ${result.status} in ${result.durationMs} ms`;
});

let exportSegments = [];
let exportSegmentIndex = 0;
function setExportStatus(message) {
  $("#export-status").textContent = message;
}
function prepareExport() {
  environmentSnapshot = collectEnvironment();
  logger.log("environment", "export-snapshot-captured", environmentSnapshot);
}
$("#download-json").addEventListener("click", () => {
  prepareExport();
  setExportStatus(triggerDownload(logger, snapshotJSON(logger), "application/json", "json").message);
});
$("#download-csv").addEventListener("click", () => {
  prepareExport();
  setExportStatus(triggerDownload(logger, snapshotCSV(logger), "text/csv", "csv").message);
});
$("#share-json").addEventListener("click", async () => {
  prepareExport();
  setExportStatus((await shareJSON(logger, snapshotJSON(logger))).message);
});
$("#copy-summary").addEventListener("click", async () => {
  prepareExport();
  const snapshot = logger.exportSnapshot();
  const summary = `MRBD Phase 1A Probe\nVersion ${snapshot.app.version} (${snapshot.app.gitCommit})\nSession ${snapshot.sessionId}\nEntries ${snapshot.entryCount}\nMRBD result: Not tested`;
  setExportStatus((await copyText(logger, summary, "Summary")).message);
});
$("#copy-json").addEventListener("click", async () => {
  prepareExport();
  setExportStatus((await copyText(logger, snapshotJSON(logger), "Full JSON")).message);
});
$("#show-export").addEventListener("click", () => {
  prepareExport();
  const json = snapshotJSON(logger);
  const segmentSize = 50000;
  exportSegments = Array.from({ length: Math.ceil(json.length / segmentSize) || 1 }, (_, index) => json.slice(index * segmentSize, (index + 1) * segmentSize));
  exportSegmentIndex = 0;
  $("#export-text-wrap").hidden = false;
  $("#export-warning").hidden = exportSegments.length === 1;
  $("#export-warning").textContent = exportSegments.length > 1 ? `Large log split into ${exportSegments.length} selectable segments.` : "";
  showSegment();
  logger.log("export", "text-fallback-shown", { length: json.length, segments: exportSegments.length });
});
function showSegment() {
  $("#export-text").value = exportSegments[exportSegmentIndex] || "";
  $("#segment-status").textContent = `${exportSegmentIndex + 1} / ${exportSegments.length || 1}`;
}
$("#previous-segment").addEventListener("click", () => { exportSegmentIndex = Math.max(0, exportSegmentIndex - 1); showSegment(); });
$("#next-segment").addEventListener("click", () => { exportSegmentIndex = Math.min(exportSegments.length - 1, exportSegmentIndex + 1); showSegment(); });
$("#clear-all").addEventListener("click", () => { logger.clear(); setExportStatus("In-memory log cleared; clear event recorded."); });

function flatten(value, prefix = "", result = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, result));
  } else {
    result[prefix] = Array.isArray(value) ? JSON.stringify(value) : String(value);
  }
  return result;
}

logger.log("app", "initialized", { buildInfo: BUILD_INFO, pageInstanceId, sessionId, launchState });
refreshRecent();
updateLifecycleReadout();
