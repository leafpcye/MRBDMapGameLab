import { BUILD_INFO } from "./build-info.js";
import { createLogger } from "./modules/logger.js";
import { collectEnvironment, environmentPages } from "./modules/environment.js";
import { createInputProbe } from "./modules/input.js";
import { createStorageHelper, errorDetails, formatBootTimestamp } from "./modules/storage.js";
import { installLifecycleProbe } from "./modules/lifecycle.js";
import { runNetworkProbe } from "./modules/network.js";
import { snapshotJSON, snapshotCSV, triggerDownload, copyText, shareJSON } from "./modules/export.js";
import { renderRows, renderRecent, shortId } from "./modules/ui.js";
import { readLargeTextPreference, shouldUseLargeText, writeLargeTextPreference } from "./modules/preferences.js";
import { readLifecycleCheckpoint, writeLifecycleCheckpoint, classifyLifecycleEvidence } from "./modules/lifecycle-checkpoint.js";
import { getDirectionalNeighbor } from "./modules/navigation.js";
import { initializeRuntimeContext, getRuntimeContext, checkRuntimeContextConsistency } from "./modules/runtime-context.js";
import { createLifecycleTrace } from "./modules/lifecycle-trace.js";

let browserLocalStorage = null;
let browserSessionStorage = null;
try {
  browserLocalStorage = localStorage;
} catch {
  // Runtime Context records storage availability without blocking startup.
}
try {
  browserSessionStorage = sessionStorage;
} catch {
  // Runtime Context creates an in-memory session ID if sessionStorage is inaccessible.
}

const runtimeContext = initializeRuntimeContext({
  localStorage: browserLocalStorage,
  sessionStorage: browserSessionStorage
});
const { pageInstanceId, sessionId } = runtimeContext;

let environmentSnapshot = null;
const logger = createLogger({
  sessionId,
  pageInstanceId,
  appVersion: BUILD_INFO.version,
  gitCommit: BUILD_INFO.gitCommit,
  environmentProvider: () => environmentSnapshot || collectEnvironment()
});

const largeTextEnabled = shouldUseLargeText({
  storedPreference: readLargeTextPreference(browserLocalStorage),
  width: innerWidth,
  height: innerHeight,
  userAgent: navigator.userAgent
});
document.body.classList.toggle("large-text", largeTextEnabled);

const previousCheckpointResult = readLifecycleCheckpoint(browserLocalStorage);
const previousCheckpoint = previousCheckpointResult.checkpoint;
const lifecycleTrace = createLifecycleTrace({
  storage: browserLocalStorage,
  runtimeContext
});
lifecycleTrace.append("script-start", { visibilityState: document.visibilityState });
const pageStartedAt = runtimeContext.bootedAt;
const lifecycleState = {
  lastEvent: "script-start",
  bfcacheEvidence: false,
  lastPagehideAt: null,
  lastPageshowAt: null,
  lastVisibilityChangeAt: null,
  pageshowPersisted: false,
  visibilityRestored: false,
  previousVisibility: document.visibilityState
};
const lifecycleProbe = installLifecycleProbe(logger, (update) => {
  if (update.lastEvent === "pagehide") lifecycleState.lastPagehideAt = update.eventAt;
  if (update.lastEvent === "pageshow") {
    lifecycleState.lastPageshowAt = update.eventAt;
    lifecycleState.pageshowPersisted = Boolean(update.persisted);
  }
  if (update.lastEvent === "visibilitychange") {
    lifecycleState.lastVisibilityChangeAt = update.eventAt;
    if (lifecycleState.previousVisibility === "hidden" && update.visibilityState === "visible") lifecycleState.visibilityRestored = true;
    lifecycleState.previousVisibility = update.visibilityState;
  }
  Object.assign(lifecycleState, update);
  lifecycleTrace.append(update.lastEvent, {
    wallTime: update.eventAt,
    visibilityState: update.visibilityState,
    persisted: update.persisted
  });
  persistLifecycleCheckpoint(update.lastEvent);
  updateLifecycleReadout();
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
$("#app-version").textContent = BUILD_INFO.version;
$("#git-commit").textContent = BUILD_INFO.gitCommit;
$("#session-short").textContent = shortId(sessionId);
updateNetworkStatus();

const largeTextToggle = $("#large-text-toggle");
largeTextToggle.setAttribute("aria-pressed", String(largeTextEnabled));
largeTextToggle.textContent = `Large Text: ${largeTextEnabled ? "On" : "Off"}`;
largeTextToggle.addEventListener("click", () => {
  const enabled = !document.body.classList.contains("large-text");
  document.body.classList.toggle("large-text", enabled);
  largeTextToggle.setAttribute("aria-pressed", String(enabled));
  largeTextToggle.textContent = `Large Text: ${enabled ? "On" : "Off"}`;
  try {
    writeLargeTextPreference(browserLocalStorage, enabled);
    logger.log("ui", "large-text-changed", { enabled, source: "manual" });
  } catch (error) {
    logger.log("ui", "large-text-save-failed", errorDetails(error));
  }
});
logger.log("ui", "large-text-initialized", {
  enabled: largeTextEnabled,
  viewport: { width: innerWidth, height: innerHeight },
  greatwhiteDetected: /Greatwhite/i.test(navigator.userAgent),
  storedPreference: readLargeTextPreference(browserLocalStorage)
});
logger.log("app", "runtime-context-initialized", runtimeContext);
if (previousCheckpointResult.error) logger.log("lifecycle", "checkpoint-read-failed", previousCheckpointResult.error);
if (lifecycleTrace.getReadError()) logger.log("lifecycle", "trace-read-failed", lifecycleTrace.getReadError());

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
// direction events reach the probe without navigation side effects. Home uses
// rendered rectangles; in a visual single column Left/Right therefore do not move.
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
  let next = index;
  if (currentPage() === "home") {
    next = getDirectionalNeighbor({
      key: event.key,
      currentIndex: index,
      rects: focusable.map((element) => element.getBoundingClientRect())
    });
  } else {
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    next = Math.max(0, Math.min(focusable.length - 1, index + delta));
  }
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

let environmentPageList = [];
let environmentPageIndex = 0;
function renderEnvironmentPage() {
  const page = environmentPageList[environmentPageIndex];
  if (!page) return;
  $("#environment-page-title").textContent = `${page.title} · ${environmentPageIndex + 1}/${environmentPageList.length}`;
  renderRows($("#environment-output"), page.rows);
  $("#environment-previous").disabled = environmentPageIndex === 0;
  $("#environment-next").disabled = environmentPageIndex === environmentPageList.length - 1;
}
$("#run-environment").addEventListener("click", () => {
  try {
    environmentSnapshot = collectEnvironment();
    logger.log("environment", "probe-complete", environmentSnapshot);
    environmentPageList = environmentPages(environmentSnapshot);
    environmentPageIndex = 0;
    renderEnvironmentPage();
    $("#environment-status").textContent = `Captured ${environmentSnapshot.capturedAt}`;
  } catch (error) {
    logger.log("environment", "probe-failed", errorDetails(error));
    $("#environment-status").textContent = `${error.name}: ${error.message}`;
  }
});
$("#environment-previous").addEventListener("click", () => {
  environmentPageIndex = Math.max(0, environmentPageIndex - 1);
  renderEnvironmentPage();
  logger.log("environment", "page-changed", { pageIndex: environmentPageIndex, title: environmentPageList[environmentPageIndex]?.title });
});
$("#environment-next").addEventListener("click", () => {
  if (!environmentPageList.length) return;
  environmentPageIndex = Math.min(environmentPageList.length - 1, environmentPageIndex + 1);
  renderEnvironmentPage();
  logger.log("environment", "page-changed", { pageIndex: environmentPageIndex, title: environmentPageList[environmentPageIndex]?.title });
});
$("#copy-environment").addEventListener("click", async () => {
  if (!environmentSnapshot) environmentSnapshot = collectEnvironment();
  const result = await copyText(logger, JSON.stringify(environmentSnapshot, null, 2), "Environment summary");
  $("#environment-status").textContent = result.message;
});

for (let index = 1; index <= 12; index += 1) {
  const button = document.createElement("button");
  button.id = `long-list-item-${index}`;
  button.dataset.testControl = `long-${index}`;
  button.textContent = `Long item ${String(index).padStart(2, "0")}`;
  $("#long-list").append(button);
}
const inputUi = {
  active: false,
  eventCount: 0,
  mode: "observe-only",
  recentEvents: [],
  metrics: {
    rawKeyboardEventCount: 0,
    completedPairCount: 0,
    unmatchedKeydowns: 0,
    unmatchedKeyups: 0
  }
};
const inputProbe = createInputProbe({
  logger,
  onUpdate(update) {
    Object.assign(inputUi, update);
    $("#input-status").textContent = `${inputUi.active ? "Running" : "Stopped"} · ${inputUi.metrics.rawKeyboardEventCount} raw keyboard events`;
    $("#input-count").textContent = String(inputUi.eventCount);
    $("#raw-keyboard-count").textContent = String(inputUi.metrics.rawKeyboardEventCount);
    $("#completed-pair-count").textContent = String(inputUi.metrics.completedPairCount);
    $("#unmatched-keydown-count").textContent = String(inputUi.metrics.unmatchedKeydowns);
    $("#unmatched-keyup-count").textContent = String(inputUi.metrics.unmatchedKeyups);
    if (update.focus) $("#input-focus").textContent = update.focus;
    if (update.selection) $("#input-selection").textContent = update.selection;
    if (update.lastKeydown) renderKeyEventSummary("keydown", update.lastKeydown);
    if (update.lastKeyup) renderKeyEventSummary("keyup", update.lastKeyup);
    if (update.pairSummary) renderPairSummary(update.pairSummary);
    if (update.recentEvents) renderInputEvents(update.recentEvents);
  }
});
$("#start-input").addEventListener("click", () => inputProbe.start());
$("#stop-input").addEventListener("click", () => inputProbe.stop());
const modeHelp = {
  "observe-only": "Observe Only records raw runtime behavior without preventDefault or app focus routing.",
  "browser-default": "Browser Default leaves focus and activation to the MRBD Web Runtime and records the result.",
  "app-navigation": "App Navigation records raw events first, then prevents Arrow/Enter defaults and moves focus itself. Escape remains untouched."
};
$$("[data-input-mode]").forEach((button) => button.addEventListener("click", () => {
  const mode = inputProbe.setMode(button.dataset.inputMode);
  $$("[data-input-mode]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate.dataset.inputMode === mode)));
  $("#input-mode-help").textContent = modeHelp[mode];
}));

function renderPairSummary(summary) {
  const container = $("#pair-summary");
  container.replaceChildren();
  summary.forEach((item) => {
    const row = document.createElement("div");
    row.className = "pair-row";
    const key = document.createElement("strong");
    const counts = document.createElement("span");
    const pairs = document.createElement("span");
    const interval = document.createElement("span");
    const unmatched = document.createElement("span");
    key.textContent = item.key;
    counts.textContent = `down ${item.downCount} · up ${item.upCount}`;
    pairs.textContent = `pairs ${item.completedPairCount}`;
    interval.textContent = item.latestDurationMs === null
      ? "interval —"
      : `latest interval ${item.latestDurationMs} ms`;
    unmatched.textContent = `unmatched d${item.unmatchedKeydowns}/u${item.unmatchedKeyups}`;
    row.append(key, counts, pairs, interval, unmatched);
    container.append(row);
  });
}

function renderKeyEventSummary(kind, event) {
  $(`#last-${kind}-type`).textContent = event.type;
  $(`#last-${kind}-key`).textContent = event.key;
  $(`#last-${kind}-code`).textContent = event.code;
  $(`#last-${kind}-timestamp`).textContent = `${event.timestamp} ms`;
  $(`#last-${kind}-focus`).textContent = event.focus;
  $(`#last-${kind}-seq`).textContent = `#${event.seq}`;
}

function renderInputEvents(events) {
  const container = $("#input-event-list");
  container.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("p");
    empty.textContent = "No input events observed.";
    container.append(empty);
    return;
  }
  events.slice(-4).reverse().forEach((event) => {
    const row = document.createElement("div");
    row.className = "input-event-row";
    const sequence = document.createElement("span");
    const eventName = document.createElement("strong");
    const detail = document.createElement("small");
    sequence.textContent = `#${event.seq}`;
    eventName.textContent = `${event.type} · ${event.key}`;
    detail.textContent = `code ${event.code} · ${event.timestamp} ms · focus ${event.focus} · click ${event.click ? "yes" : "no"}`;
    row.append(sequence, eventName, detail);
    container.append(row);
  });
}
renderPairSummary(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].map((key) => ({
  key,
  downCount: 0,
  upCount: 0,
  completedPairCount: 0,
  latestDurationMs: null,
  unmatchedKeydowns: 0,
  unmatchedKeyups: 0
})));

$("#raw-events-toggle").addEventListener("click", () => {
  const expanded = $("#raw-events-toggle").getAttribute("aria-expanded") !== "true";
  $("#raw-events-toggle").setAttribute("aria-expanded", String(expanded));
  $("#raw-events-toggle").textContent = `Raw Events: ${expanded ? "Expanded" : "Collapsed"}`;
  $("#input-event-list").hidden = !expanded;
});

async function runStorageAction(label, action) {
  $("#storage-status").textContent = `${label} running…`;
  try {
    const result = await action();
    logger.log("storage", `${label}-complete`, result);
    renderRows($("#storage-output"), Object.entries(flatten(result)));
    $("#storage-status").textContent = `${label} complete`;
    updateStorageSummary();
  } catch (error) {
    const details = errorDetails(error);
    logger.log("storage", `${label}-failed`, details);
    renderRows($("#storage-output"), Object.entries(details));
    $("#storage-status").textContent = `${details.name}: ${details.message}`;
  }
}

function updateStorageSummary() {
  let testValue = "Unavailable";
  try {
    testValue = browserLocalStorage?.getItem("mrbdProbe.testValue") ?? "(not set)";
  } catch (error) {
    testValue = `${errorDetails(error).name}: ${errorDetails(error).message}`;
  }
  const previousBoot = formatBootTimestamp(runtimeContext.previousBootAt);
  $("#storage-boot-count").textContent = String(runtimeContext.documentBootCount);
  $("#storage-current-value").textContent = testValue;
  $("#storage-previous-boot-local").textContent = previousBoot.local;
  $("#storage-previous-boot-utc").textContent = previousBoot.utc;
  $("#storage-time-zone").textContent = previousBoot.timeZone;
  $("#storage-page-instance").textContent = runtimeContext.pageInstanceId;
  const consistency = runtimeConsistency();
  $("#storage-context-consistency").textContent = consistency.status;
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
  return { accessible: true, written: value, read, updated, json, deleted: helper.get("temporary") === null, runtimeContext };
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
  const url = new URL("./__mrbd-cache-probe__", import.meta.url).href;
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
  const serviceWorkerUrl = new URL("./sw.js", import.meta.url);
  serviceWorkerUrl.searchParams.set("v", `${BUILD_INFO.version}-${BUILD_INFO.gitCommit}`);
  // Omitting an explicit scope keeps control limited to the directory containing sw.js.
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl);
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
  const consistency = runtimeConsistency();
  const rows = [
    ["Visibility", document.visibilityState],
    ["Page instance", runtimeContext.pageInstanceId],
    ["Session", runtimeContext.sessionId],
    ["Document boot count", String(runtimeContext.documentBootCount)],
    ["Runtime context consistency", consistency.status],
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

  const interpretation = classifyLifecycleEvidence({
    currentContext: runtimeContext,
    previousCheckpoint,
    traceEntries: lifecycleTrace.getEntries(),
    contextConsistent: consistency.status === "OK"
  });
  $("#lifecycle-interpretation").textContent = interpretation;
  renderDiagnosticRows([
    ["Current page instance", runtimeContext.pageInstanceId],
    ["Current session", runtimeContext.sessionId],
    ["Document boot count", String(runtimeContext.documentBootCount)],
    ["Runtime context consistency", consistency.status],
    ["Visibility", document.visibilityState],
    ["Last lifecycle event", lifecycleState.lastEvent],
    ["Last pagehide", lifecycleState.lastPagehideAt || "Not observed"],
    ["Last pageshow", lifecycleState.lastPageshowAt || "Not observed"],
    ["Last visibility change", lifecycleState.lastVisibilityChangeAt || "Not observed"],
    ["pageshow.persisted", lifecycleState.pageshowPersisted ? "true observed" : "Not observed"],
    ["Document booted at", pageStartedAt],
    ["Previous instance", previousCheckpoint?.pageInstanceId || "No checkpoint"],
    ["Previous document boot count", previousCheckpoint?.documentBootCount ?? "No checkpoint"],
    ["Previous last event", previousCheckpoint?.lastLifecycleEvent || "No checkpoint"],
    ["Previous state", previousCheckpoint?.visibilityState || "No checkpoint"],
    ["Previous saved at", previousCheckpoint?.savedAt || "No checkpoint"],
    ["Navigation type", navigation?.type || "unavailable"]
  ]);
  renderLifecycleTrace(lifecycleTrace.getEntries());
}

let contextErrorLogged = false;
function runtimeConsistency() {
  const displayedIds = [
    getRuntimeContext(),
    $("#storage-page-instance")?.textContent,
    $("#lifecycle-current-page-instance")?.textContent
  ].filter((value) => value && value !== "—");
  const result = checkRuntimeContextConsistency(runtimeContext, displayedIds);
  if (result.status === "ERROR" && !contextErrorLogged) {
    contextErrorLogged = true;
    logger.log("app", "runtime-context-consistency-error", result);
  }
  return result;
}

function renderDiagnosticRows(rows) {
  const container = $("#lifecycle-diagnostic");
  if (!container) return;
  container.replaceChildren();
  rows.forEach(([term, value]) => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    if (term === "Current page instance") dd.id = "lifecycle-current-page-instance";
    wrap.append(dt, dd);
    container.append(wrap);
  });
}

function renderLifecycleTrace(entries) {
  const container = $("#lifecycle-trace");
  if (!container) return;
  container.replaceChildren();
  entries.slice(-16).reverse().forEach((entry) => {
    const row = document.createElement("div");
    row.className = "trace-row";
    const event = document.createElement("strong");
    const identity = document.createElement("span");
    const timing = document.createElement("small");
    event.textContent = `#${entry.sequence} ${entry.event}`;
    identity.textContent = `boot ${entry.documentBootCount} · ${shortId(entry.pageInstanceId)} · ${entry.visibilityState} · persisted ${entry.persisted === null ? "(n/a)" : entry.persisted}`;
    timing.textContent = `${entry.localTime} · ${entry.wallTime}`;
    row.append(event, identity, timing);
    container.append(row);
  });
}

function persistLifecycleCheckpoint(lastLifecycleEvent) {
  if (!browserLocalStorage) return null;
  try {
    return writeLifecycleCheckpoint(browserLocalStorage, {
      pageInstanceId,
      sessionId,
      documentBootCount: runtimeContext.documentBootCount,
      bootedAt: runtimeContext.bootedAt,
      lastLifecycleEvent,
      visibilityState: document.visibilityState,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.log("lifecycle", "checkpoint-write-failed", errorDetails(error));
    return null;
  }
}

$("#mark-middle-pinch").addEventListener("click", () => {
  const marker = "before-middle-pinch";
  logger.log("lifecycle", "marker", { note: marker, intent: "MRBD system-menu lifecycle diagnostic" });
  lifecycleTrace.mark(marker);
  lifecycleState.lastEvent = marker;
  const checkpoint = persistLifecycleCheckpoint(marker);
  $("#lifecycle-status").textContent = checkpoint
    ? "Marker saved. Perform middle pinch, then return to this Web App."
    : "Marker logged in memory; lifecycle checkpoint could not be saved.";
  updateLifecycleReadout();
});

$("#add-marker").addEventListener("click", () => {
  const note = $("#marker-note").value.trim();
  logger.log("lifecycle", "marker", { note: note || "(no note)" });
  lifecycleTrace.mark("marker");
  $("#lifecycle-status").textContent = `Marker recorded: ${note || "(no note)"}`;
  updateLifecycleReadout();
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
  const summary = `MRBD Phase 1A Probe\nVersion ${snapshot.app.version} (${snapshot.app.gitCommit})\nSession ${snapshot.sessionId}\nEntries ${snapshot.entryCount}\nEnvironment and device result: verify from exported evidence`;
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

logger.log("app", "initialized", { buildInfo: BUILD_INFO, runtimeContext });
persistLifecycleCheckpoint("script-start");
refreshRecent();
updateStorageSummary();
updateLifecycleReadout();
