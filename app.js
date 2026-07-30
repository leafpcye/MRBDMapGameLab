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
import { getDirectionalNeighbor, isVisibleFocusCandidate } from "./modules/navigation.js";
import { initializeRuntimeContext, getRuntimeContext, checkRuntimeContextConsistency } from "./modules/runtime-context.js";
import { createLifecycleTrace } from "./modules/lifecycle-trace.js";
import { createActivationTracker, flashActivation } from "./modules/activation.js";
import { createRuntimeSnapshot, saveRuntimeSnapshot, readRuntimeSnapshot, compareRuntimeSnapshots } from "./modules/runtime-snapshot.js";
import { createLocationProbe, LOCATION_PRESETS, DEFAULT_LOCATION_THRESHOLDS } from "./modules/location.js";
import { createMotionProbe } from "./modules/motion.js";
import { createPermissionBootstrap } from "./modules/permissions-bootstrap.js";

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
const previousRuntimeSnapshotResult = readRuntimeSnapshot(browserLocalStorage);
let lastLifecycleMarker = "";
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

function activeFocusCandidates() {
  return $$(`.page.active button:not([disabled]), .page.active input:not([disabled]), .page.active select:not([disabled]), .page.active textarea:not([disabled])`)
    .filter(isVisibleFocusCandidate);
}

function openPage(page) {
  $$(".page").forEach((section) => section.classList.toggle("active", section.dataset.page === page));
  $("#current-page").textContent = page[0].toUpperCase() + page.slice(1);
  logger.log("ui", "page-opened", { page });
  requestAnimationFrame(() => activeFocusCandidates()[0]?.focus());
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
  // Hidden instrument pages stay in the DOM for evidence retention. Excluding
  // their controls prevents Neural Band focus from skipping visible presets.
  const focusable = activeFocusCandidates();
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

function renderPermissionBootstrap(snapshot) {
  $("#permissions-state").textContent = snapshot.state;
  $("#permissions-orientation").textContent = snapshot.sensors.orientation;
  $("#permissions-motion").textContent = snapshot.sensors.motion;
  $("#permissions-location").textContent = snapshot.location.state;
  $("#permissions-callback-time").textContent = snapshot.location.firstCallbackElapsedMs === null
    ? "—"
    : `${Math.round(snapshot.location.firstCallbackElapsedMs)} ms`;
  $("#permissions-post-menu-location").textContent = snapshot.postMenuLocation.state;
  $("#permissions-post-menu-callback-time").textContent = snapshot.postMenuLocation.firstCallbackElapsedMs === null
    ? "—"
    : `${Math.round(snapshot.postMenuLocation.firstCallbackElapsedMs)} ms`;
  $("#permissions-bootstrap-start").disabled = snapshot.started;
  $("#permissions-post-menu-verify").disabled =
    snapshot.state !== "complete" || snapshot.postMenuLocation.started;
  renderRows($("#permissions-output"), Object.entries(flatten({
    input: snapshot.input,
    environment: snapshot.environment,
    sensors: snapshot.sensors,
    initialLocation: snapshot.location,
    postMenuLocation: snapshot.postMenuLocation
  })));

  if (snapshot.state === "not-started") {
    $("#permissions-status").textContent = "Not started · no permission API has been called";
    return;
  }
  if (snapshot.state === "requesting-sensors") {
    $("#permissions-status").textContent = "Requesting Sensors, then Location…";
    return;
  }
  if (snapshot.state === "waiting") {
    $("#permissions-status").textContent = "Location request issued · waiting for the first callback";
    return;
  }
  if (snapshot.postMenuLocation.state === "issued") {
    $("#permissions-status").textContent = "Post-menu Location verification issued · waiting for callback";
    return;
  }
  if (snapshot.postMenuLocation.started) {
    $("#permissions-status").textContent =
      `Verification complete · initial ${snapshot.location.state} · post-menu ${snapshot.postMenuLocation.state}`;
    $("#permissions-instruction").textContent =
      "Record both Location results and export the log. The post-menu result does not overwrite the initial Bootstrap evidence.";
    return;
  }
  $("#permissions-status").textContent = `Bootstrap complete · initial Location ${snapshot.location.state}`;
  $("#permissions-instruction").textContent =
    "Use middle pinch, enable the Runtime permissions, Resume, then press Verify Location After Menu Change once.";
}

const permissionBootstrap = createPermissionBootstrap({
  globalObject: window,
  geolocation: navigator.geolocation,
  logger,
  onUpdate: renderPermissionBootstrap
});
const permissionsStartButton = $("#permissions-bootstrap-start");
permissionsStartButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.repeat) return;
  event.preventDefault();
  permissionBootstrap.startFromEvent(event);
});
permissionsStartButton.addEventListener("click", (event) => {
  permissionBootstrap.startFromEvent(event);
});
const permissionsPostMenuButton = $("#permissions-post-menu-verify");
permissionsPostMenuButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.repeat) return;
  event.preventDefault();
  permissionBootstrap.verifyLocationFromEvent(event);
});
permissionsPostMenuButton.addEventListener("click", (event) => {
  permissionBootstrap.verifyLocationFromEvent(event);
});
function openStandaloneLocationRuntime() {
  window.location.href = new URL("./plugin-location-parity.html", window.location.href).href;
}
$("#open-plugin-location-parity").addEventListener("click", openStandaloneLocationRuntime);
$("#open-location-runtime").addEventListener("click", openStandaloneLocationRuntime);
renderPermissionBootstrap(permissionBootstrap.snapshot());

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
const pointerTimes = new Map();
const activationTracker = createActivationTracker({
  onActivation(result) {
    const control = $$("[data-test-control]").find((item) => item.dataset.testControl === result.name);
    $("#activation-feedback").textContent = `Activated: ${control?.textContent?.trim() || result.name}\nActivation count: ${result.count}\nLast activation: ${result.localTime}\nSource: ${result.source}`;
    if (control) flashActivation({ setActive: (active) => control.classList.toggle("activation-flash", active) });
    logger.log("input", "control-activated", result);
  }
});
$("#input-controls").addEventListener("pointerdown", (event) => {
  const control = event.target.closest?.("[data-test-control]");
  if (control) pointerTimes.set(control.dataset.testControl, Date.now());
});
$("#input-controls").addEventListener("keydown", (event) => {
  const control = event.target.closest?.("[data-test-control]");
  if (control && event.key === "Enter" && !event.repeat) {
    activationTracker.activate(control.dataset.testControl, "keyboard");
  }
});
$("#input-controls").addEventListener("click", (event) => {
  const control = event.target.closest?.("[data-test-control]");
  if (!control) return;
  const lastPointer = pointerTimes.get(control.dataset.testControl) ?? -Infinity;
  const source = Date.now() - lastPointer < 1000 ? "pointer" : event.detail > 0 ? "click" : "unknown";
  activationTracker.activate(control.dataset.testControl, source);
});
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
  renderRuntimeSnapshot();
}

function renderRuntimeSnapshot() {
  const current = createRuntimeSnapshot(runtimeContext, {
    marker: lastLifecycleMarker,
    classification: classifyLifecycleEvidence({
      currentContext: runtimeContext,
      previousCheckpoint,
      traceEntries: lifecycleTrace.getEntries(),
      contextConsistent: runtimeConsistency().status === "OK"
    })
  });
  const comparison = compareRuntimeSnapshots(previousRuntimeSnapshotResult.snapshot, current);
  renderRows($("#runtime-snapshot-readout"), [
    ["Current page", current.pageInstanceId],
    ["Current session", current.sessionId],
    ["Current boot", String(current.documentBootCount)],
    ["Last marker", lastLifecycleMarker || "None in this document"],
    ["Classification", current.classification],
    ["Previous saved page", previousRuntimeSnapshotResult.snapshot?.pageInstanceId || "None"],
    ["Previous saved session", previousRuntimeSnapshotResult.snapshot?.sessionId || "None"],
    ["Previous saved boot", previousRuntimeSnapshotResult.snapshot?.documentBootCount ?? "None"],
    ["Changed", comparison.changed === null ? "No comparison" : String(comparison.changed)],
    ["Comparison", comparison.classification]
  ]);
}

$("#save-runtime-snapshot").addEventListener("click", () => {
  try {
    const snapshot = createRuntimeSnapshot(runtimeContext, {
      marker: lastLifecycleMarker,
      classification: $("#lifecycle-interpretation").textContent
    });
    saveRuntimeSnapshot(browserLocalStorage, snapshot);
    logger.log("lifecycle", "runtime-snapshot-saved", snapshot);
    $("#lifecycle-status").textContent = "Current runtime snapshot saved to localStorage.";
  } catch (error) {
    logger.log("lifecycle", "runtime-snapshot-save-failed", errorDetails(error));
    $("#lifecycle-status").textContent = `${error.name}: ${error.message}`;
  }
  renderRuntimeSnapshot();
});

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
  lastLifecycleMarker = marker;
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
  lastLifecycleMarker = note || "(no note)";
  logger.log("lifecycle", "marker", { note: note || "(no note)" });
  lifecycleTrace.mark("marker");
  $("#lifecycle-status").textContent = `Marker recorded: ${note || "(no note)"}`;
  updateLifecycleReadout();
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
function updateNetworkStatus(event) {
  $("#network-status").textContent = navigator.onLine ? "ONLINE*" : "OFFLINE*";
  $("#network-runtime-state").textContent = navigator.onLine ? "true · runtime reports online" : "false · not proof of no internet";
  $("#network-cached-page").textContent = navigator.serviceWorker?.controller
    ? "Service Worker controller present; cache contents not verified"
    : "No controlling Service Worker observed";
  if (event?.type) logger.log("network", event.type, { navigatorOnLine: navigator.onLine });
}
$("#run-network").addEventListener("click", async () => {
  $("#network-probe-status").textContent = "Same-origin live fetch running…";
  const result = await runNetworkProbe(logger);
  renderRows($("#network-output"), Object.entries(flatten(result)));
  $("#network-live-fetch").textContent = result.liveFetchSucceeded ? "Succeeded" : "Failed";
  $("#network-cached-page").textContent = result.likelyCachedPageAvailable
    ? "Service Worker controller present; cache contents not verified"
    : "No controlling Service Worker observed";
  $("#network-last-status").textContent = result.status === null ? "No HTTP response" : `HTTP ${result.status}`;
  if (result.liveFetchSucceeded) $("#network-last-success").textContent = result.endedAt;
  if (result.error) $("#network-last-error").textContent = `${result.error.name}: ${result.error.message}`;
  $("#network-probe-status").textContent = result.interpretation;
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
  const summary = `MRBD Capability Probe\nVersion ${snapshot.app.version} (${snapshot.app.gitCommit})\nSession ${snapshot.sessionId}\nEntries ${snapshot.entryCount}\nEnvironment and device result: verify from exported evidence`;
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

const locationThresholds = { ...DEFAULT_LOCATION_THRESHOLDS };
let latestLocationRecord = null;
const locationMarkers = [];
let selectedLocationPreset = "high-accuracy";
let locationPermissionState = "unavailable";
let locationPermissionError = null;
let lastLocationInput = "None";
let lastTrustedLocationInput = "None";
let locationElapsedTimer = null;

function renderLocationRequest(snapshot) {
  $("#location-request-state").textContent = snapshot.state;
  $("#geo-last-input").textContent = lastLocationInput;
  $("#geo-last-trusted-input").textContent = lastTrustedLocationInput;
  $("#geo-last-activation").textContent = `active ${snapshot.userActivationIsActive} · ever ${snapshot.userActivationHasBeenActive}`;
  $("#geo-handler-entered").textContent = snapshot.handlerEntered ? "Yes" : "No";
  $("#geo-call-issued").textContent = snapshot.callIssued ? "Yes" : "No";
  renderRows($("#location-request-output"), Object.entries(flatten({
    geolocationApiPresent: Boolean(navigator.geolocation),
    requestId: snapshot.requestId,
    requestState: snapshot.state,
    triggerSource: snapshot.triggerSource,
    trustedEvent: snapshot.inputEventIsTrusted,
    userActivationIsActive: snapshot.userActivationIsActive,
    userActivationHasBeenActive: snapshot.userActivationHasBeenActive,
    permissionBefore: snapshot.permissionStateBefore,
    permissionAfter: snapshot.permissionStateAfter,
    permissionsApiPresent: Boolean(navigator.permissions?.query),
    latestPermissionQueryState: locationPermissionState,
    latestPermissionQueryError: locationPermissionError,
    permissionQueryErrorBefore: snapshot.permissionQueryErrorBefore,
    permissionQueryErrorAfter: snapshot.permissionQueryErrorAfter,
    elapsedMs: snapshot.elapsedMs,
    lastTransition: snapshot.lastTransition
  })));
  const result = snapshot.result || {};
  renderRows($("#location-quick-result"), Object.entries(flatten({
    input: `${snapshot.state !== "idle" ? "received" : "none"} · trusted ${snapshot.inputEventIsTrusted}`,
    userActivation: `active ${snapshot.userActivationIsActive} · ever ${snapshot.userActivationHasBeenActive}`,
    execution: `handler ${snapshot.handlerEntered ? "yes" : "no"} · call ${snapshot.callIssued ? "yes" : "no"}`,
    permission: `before ${snapshot.permissionStateBefore} · after ${snapshot.permissionStateAfter}`,
    request: `${snapshot.requestId} · ${snapshot.state} · ${snapshot.elapsedMs} ms`,
    result: `lat ${result.latitudePresent ?? "?"} · lon ${result.longitudePresent ?? "?"} · accuracy ${result.accuracy ?? "?"} m`,
    error: `${result.error?.codeName ?? "none"} · ${result.error?.message ?? "none"}`
  })));
  $("#location-status").textContent = snapshot.state === "client-timeout"
    ? "client-timeout: No success or error callback was received before the diagnostic watchdog expired."
    : snapshot.state === "idle"
      ? "No request issued · idle"
      : `Request ${snapshot.requestId} · ${snapshot.state}`;
  clearInterval(locationElapsedTimer);
  locationElapsedTimer = null;
  if (["request-entered", "request-issued", "waiting"].includes(snapshot.state)) {
    locationElapsedTimer = setInterval(() => renderLocationRequest(locationProbe.requestSnapshot()), 250);
  }
}

function renderLocationData(update = {}) {
  if (update.record) latestLocationRecord = update.record;
  $("#location-watch").textContent = (update.active ?? locationProbe.isActive()) ? "Active" : "Stopped";
  const snapshot = locationProbe.snapshot();
  const latest = update.record || latestLocationRecord;
  $("#location-callback-age").textContent = snapshot.summary.lastCallbackAgeMs === null
    ? "—"
    : `${Math.round(snapshot.summary.lastCallbackAgeMs)} ms`;
  renderRows($("#location-position-summary"), Object.entries(flatten({
    positionReceived: Boolean(latest),
    latitudePresent: Number.isFinite(latest?.raw?.latitude),
    longitudePresent: Number.isFinite(latest?.raw?.longitude),
    accuracyM: latest?.raw?.accuracy ?? null,
    speedMps: latest?.raw?.speed ?? null,
    headingDegrees: latest?.raw?.heading ?? null,
    altitudeM: latest?.raw?.altitude ?? null,
    receivedAt: latest?.receivedAt ?? null,
    flags: latest?.flags ?? []
  })));
  renderRows($("#location-current"), Object.entries(flatten(latest || { position: "No position received" })));
  renderRows($("#location-summary"), Object.entries(flatten(snapshot.summary)));
  renderRows($("#location-quality-output"), Object.entries(flatten({
    thresholds: locationThresholds,
    latestFlags: latest?.flags ?? [],
    rawCumulativeDistanceM: snapshot.summary.cumulativeDistanceM,
    flaggedPointDistanceImpactM: snapshot.summary.flaggedDistanceM
  })));
  renderCombined();
}

const locationProbe = createLocationProbe({
  logger,
  runtimeContext,
  thresholds: locationThresholds,
  onRequestTransition: renderLocationRequest,
  onUpdate(update) {
    if (update.error) $("#location-status").textContent = `${update.error.codeName}: ${update.error.message}`;
    renderLocationData(update);
  }
});

async function refreshLocationPermission() {
  const result = await locationProbe.refreshPermission();
  locationPermissionState = result.state;
  locationPermissionError = result.error;
  $("#location-permission-note").textContent = result.state === "denied"
    ? "Permission is denied. One explicit test request is still allowed; the MRBD Runtime or host may control recovery."
    : result.state === "query-error"
      ? `Permission query error: ${result.error?.name}: ${result.error?.message}`
      : `Permissions API: ${result.apiPresent ? "present" : "missing"} · state ${result.state}`;
  logger.log("location", "permission-state-refreshed", {
    permissionsApiPresent: result.apiPresent,
    state: result.state,
    error: result.error,
    note: "Query only; no location request issued"
  });
  renderLocationRequest(locationProbe.requestSnapshot());
  return result;
}
$("#refresh-location-permission").addEventListener("click", refreshLocationPermission);

function syncLocationOptions() {
  Object.assign(locationThresholds, {
    poorAccuracyM: Number($("#threshold-accuracy").value),
    suspiciousJumpDistanceM: Number($("#threshold-jump").value),
    suspiciousDerivedSpeedMps: Number($("#threshold-speed").value),
    duplicateToleranceM: Number($("#threshold-duplicate").value),
    longCallbackGapMs: Number($("#threshold-gap").value)
  });
  const options = locationProbe.setOptions(LOCATION_PRESETS[selectedLocationPreset]);
  renderRows($("#location-options-output"), Object.entries(options));
  return options;
}

$$("[data-location-preset]").forEach((button) => button.addEventListener("click", () => {
  selectedLocationPreset = button.dataset.locationPreset;
  $$("[data-location-preset]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  syncLocationOptions();
  logger.log("location", "preset-selected", { preset: selectedLocationPreset, options: LOCATION_PRESETS[selectedLocationPreset] });
}));
$(".preset-selector").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  const buttons = $$("[data-location-preset]");
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)))].focus();
});

function recordLocationInput(event) {
  lastLocationInput = `${event.type} ${event.key || "(no key)"} · trusted ${Boolean(event.isTrusted)}`;
  if (event.isTrusted) lastTrustedLocationInput = `${event.type} ${event.key || "(no key)"}`;
}

function installOneShotTrigger(button) {
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    recordLocationInput(event);
    if (!event.isTrusted) {
      logger.log("location", "untrusted-enter-observed", { type: event.type, key: event.key, isTrusted: event.isTrusted });
      renderLocationRequest(locationProbe.requestSnapshot());
      return;
    }
    event.preventDefault();
    syncLocationOptions();
    // Direct request in this trusted keydown stack: no click(), await, timer, or promise.
    locationProbe.requestOneFromTrustedEnter(event, locationPermissionState);
  });
  button.addEventListener("click", (event) => {
    recordLocationInput(event);
    syncLocationOptions();
    // Direct request in this native click stack.
    locationProbe.requestOneFromClick(event, locationPermissionState);
  });
}
installOneShotTrigger($("#location-quick"));
installOneShotTrigger($("#location-one"));

$("#location-start").addEventListener("click", () => {
  syncLocationOptions();
  $("#location-status").textContent = "Watch request issued by explicit click";
  locationProbe.startWatch();
});
$("#location-stop").addEventListener("click", () => locationProbe.stopWatch());
$("#location-clear").addEventListener("click", () => {
  locationProbe.cancelRequest();
  latestLocationRecord = null;
  locationProbe.clear();
  renderLocationData();
});
$("#location-details-toggle").addEventListener("click", () => {
  const expanded = $("#location-details-toggle").getAttribute("aria-expanded") === "true";
  $("#location-details-toggle").setAttribute("aria-expanded", String(!expanded));
  $("#location-details-toggle").textContent = expanded ? "Show Coordinate Details" : "Hide Coordinate Details";
  $("#location-current").hidden = expanded;
});
$("#location-marker").addEventListener("click", () => {
  locationMarkers.push(locationProbe.addMarker($("#location-marker-note").value.trim()));
  $("#location-status").textContent = "Location marker recorded";
});

function deviceTestMetadata() {
  return {
    testPhase: "Phase 1B foreground",
    device: "Fill during real-device test",
    operator: "Fill during real-device test",
    appVersion: BUILD_INFO.version,
    gitCommit: BUILD_INFO.gitCommit,
    exportedAt: new Date().toISOString()
  };
}
function filteredExport(type, moduleNames, probeData) {
  return JSON.stringify({
    schemaVersion: 1,
    exportType: type,
    deviceTestMetadata: deviceTestMetadata(),
    runtimeContext,
    environment: collectEnvironment(),
    ...probeData,
    entries: logger.getEntries().filter((entry) => moduleNames.includes(entry.module))
  }, null, 2);
}
$("#location-export").addEventListener("click", () => {
  const snapshot = locationProbe.snapshot();
  const content = filteredExport("location", ["location"], {
    locationOptions: snapshot.options,
    qualityThresholds: snapshot.thresholds,
    sensorSamplingSettings: null,
    markers: locationMarkers,
    summary: snapshot.summary,
    records: snapshot.records
  });
  $("#location-status").textContent = triggerDownload(logger, content, "application/json", "location.json").message;
});

let motionSamplingHz = 10;
let motionMarkerPreset = "Baseline — both still";
const motionMarkers = [];
const motionUi = { orientation: null, motion: null, permission: null };
const motionProbe = createMotionProbe({
  logger,
  runtimeContext,
  getLocation: () => latestLocationRecord,
  onUpdate(update) {
    if (update.kind === "permission") {
      motionUi.permission = { ...(motionUi.permission || {}), [update.type]: update.result };
      $("#motion-status").textContent = `${update.type}: ${update.result}`;
      $("#sensor-permission").textContent = Object.entries(motionUi.permission).map(([key, value]) => `${key.replace("Device", "")}: ${value}`).join(" · ");
      return;
    }
    if (update.kind === "orientation") {
      if (update.current) motionUi.orientation = update;
      renderRows($("#orientation-output"), Object.entries(flatten({
        units: "alpha/beta/gamma degrees",
        current: motionUi.orientation?.current || "No sample",
        stats: update.stats
      })));
    }
    if (update.kind === "motion") {
      if (update.current) motionUi.motion = update;
      renderRows($("#motion-output"), Object.entries(flatten({
        units: "acceleration m/s²; rotation rate deg/s; interval ms",
        current: motionUi.motion?.current || "No sample",
        stats: update.stats
      })));
    }
    $("#motion-status").textContent = `${motionProbe.isActive() ? "Running" : "Stopped"} · UI/log ${motionSamplingHz} Hz`;
    renderCombined();
  }
});
$("#orientation-api").textContent = `DeviceOrientationEvent: ${"DeviceOrientationEvent" in window ? "Present" : "Missing"} · requestPermission: ${typeof window.DeviceOrientationEvent?.requestPermission === "function" ? "Present" : "Missing"}`;
$("#motion-api").textContent = `DeviceMotionEvent: ${"DeviceMotionEvent" in window ? "Present" : "Missing"} · requestPermission: ${typeof window.DeviceMotionEvent?.requestPermission === "function" ? "Present" : "Missing"}`;
$("#motion-permission").addEventListener("click", () => motionProbe.requestPermission());
$("#orientation-start").addEventListener("click", () => motionProbe.startOrientation());
$("#orientation-stop").addEventListener("click", () => motionProbe.stopOrientation());
$("#motion-start").addEventListener("click", () => motionProbe.startMotion());
$("#motion-stop").addEventListener("click", () => motionProbe.stopMotion());
$("#both-start").addEventListener("click", () => motionProbe.startBoth());
$("#both-stop").addEventListener("click", () => motionProbe.stopBoth());
$$("[data-sampling-hz]").forEach((button) => button.addEventListener("click", () => {
  motionSamplingHz = Number(button.dataset.samplingHz);
  motionProbe.setSamplingHz(motionSamplingHz);
  $$("[data-sampling-hz]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
}));
$$("[data-motion-marker-preset]").forEach((button) => button.addEventListener("click", () => {
  motionMarkerPreset = button.dataset.motionMarkerPreset;
  $$("[data-motion-marker-preset]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
}));
$("#motion-marker").addEventListener("click", () => {
  const note = [motionMarkerPreset, $("#motion-marker-note").value.trim()].filter(Boolean).join(" · ");
  motionMarkers.push(motionProbe.addMarker(note));
  $("#motion-status").textContent = "IMU marker recorded";
});
$("#motion-clear").addEventListener("click", () => { motionProbe.clear(); motionUi.orientation = null; motionUi.motion = null; });
$("#motion-export").addEventListener("click", () => {
  const content = filteredExport("imu", ["motion", "orientation"], {
    locationOptions: null,
    qualityThresholds: null,
    sensorSamplingSettings: { uiAndLogSamplingHz: motionSamplingHz, note: "Not the hardware sensor frequency" },
    imu: motionProbe.snapshot(),
    markers: motionMarkers,
    summary: motionProbe.snapshot()
  });
  $("#motion-status").textContent = triggerDownload(logger, content, "application/json", "imu.json").message;
});

let combinedStartedAt = null;
let combinedSessionId = null;
const combinedMarkers = [];
let combinedTimer = null;
function renderCombined() {
  const now = Date.now();
  const locationAgeMs = latestLocationRecord ? now - latestLocationRecord.receivedAtMs : null;
  const orientationAgeMs = motionUi.orientation?.current?.timeStamp == null ? null : performance.now() - motionUi.orientation.current.timeStamp;
  const motionAgeMs = motionUi.motion?.current?.timeStamp == null ? null : performance.now() - motionUi.motion.current.timeStamp;
  const rows = [
    ["Combined", combinedStartedAt ? "Active" : "Stopped"],
    ["Combined session", combinedSessionId || "—"],
    ["Elapsed", combinedStartedAt ? `${now - combinedStartedAt} ms` : "—"],
    ["Location", locationProbe.isActive() ? "Active" : "Stopped"],
    ["Orientation", motionProbe.snapshot().active.orientation ? "Active" : "Stopped"],
    ["Motion", motionProbe.snapshot().active.motion ? "Active" : "Stopped"],
    ["Location age", locationAgeMs === null ? "No sample" : `${locationAgeMs} ms`],
    ["Orientation age", orientationAgeMs === null ? "No sample" : `${orientationAgeMs.toFixed(0)} ms`],
    ["Motion age", motionAgeMs === null ? "No sample" : `${motionAgeMs.toFixed(0)} ms`]
  ];
  const container = $("#combined-readout");
  container.replaceChildren();
  rows.forEach(([label, value]) => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrap.append(dt, dd);
    container.append(wrap);
  });
  renderRows($("#combined-detail"), Object.entries(flatten({
    location: latestLocationRecord || "No sample",
    orientation: motionUi.orientation?.current || "No sample",
    motion: motionUi.motion?.current || "No sample"
  })));
}
$("#combined-start").addEventListener("click", () => {
  syncLocationOptions();
  locationProbe.startWatch();
  motionProbe.startBoth();
  combinedStartedAt = Date.now();
  combinedSessionId = `combined-${combinedStartedAt}-${Math.random().toString(16).slice(2, 8)}`;
  logger.log("combined", "started", { combinedSessionId, startedAt: new Date(combinedStartedAt).toISOString(), samplingHz: motionSamplingHz });
  $("#combined-status").textContent = "Running in foreground";
  clearInterval(combinedTimer);
  combinedTimer = setInterval(renderCombined, 1000);
  renderCombined();
});
function stopCombined() {
  locationProbe.stopWatch();
  motionProbe.stopBoth();
  clearInterval(combinedTimer);
  combinedTimer = null;
  logger.log("combined", "stopped", { combinedSessionId, elapsedMs: combinedStartedAt ? Date.now() - combinedStartedAt : 0 });
  combinedStartedAt = null;
  $("#combined-status").textContent = "Stopped";
  renderCombined();
}
$("#combined-stop").addEventListener("click", stopCombined);
$("#combined-marker").addEventListener("click", () => {
  const marker = {
    wallTime: new Date().toISOString(),
    monotonicMs: performance.now(),
    runtimeContext,
    combinedSessionId,
    location: latestLocationRecord,
    orientation: motionUi.orientation?.current || null,
    motion: motionUi.motion?.current || null
  };
  combinedMarkers.push(marker);
  logger.log("combined", "marker", marker);
});
$("#combined-export").addEventListener("click", () => {
  const content = filteredExport("location-and-imu", ["location", "motion", "orientation", "combined"], {
    locationOptions: locationProbe.snapshot().options,
    qualityThresholds: locationThresholds,
    sensorSamplingSettings: { uiAndLogSamplingHz: motionSamplingHz, note: "Not the hardware sensor frequency" },
    location: locationProbe.snapshot().records,
    imu: motionProbe.snapshot(),
    markers: combinedMarkers,
    summary: { location: locationProbe.snapshot().summary }
  });
  $("#combined-status").textContent = triggerDownload(logger, content, "application/json", "combined.json").message;
});

function installTwoPagePager(prefix, titles) {
  let index = 0;
  const panels = prefix === "motion"
    ? [$("#orientation-panel"), $("#motion-panel")]
    : [$("#combined-detail"), $("#combined-log")];
  const render = () => {
    panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
    $(`#${prefix}-page-title`).textContent = `${titles[index]} · ${index + 1}/${titles.length}`;
    $(`#${prefix}-previous`).disabled = index === 0;
    $(`#${prefix}-next`).disabled = index === titles.length - 1;
  };
  $(`#${prefix}-previous`).addEventListener("click", () => { index = Math.max(0, index - 1); render(); });
  $(`#${prefix}-next`).addEventListener("click", () => { index = Math.min(titles.length - 1, index + 1); render(); });
  render();
}

function installLocationPager() {
  const pages = [
    { key: "request", title: "Request" },
    { key: "current", title: "Current Position" },
    { key: "stats", title: "Session Stats" },
    { key: "quality", title: "Quality" },
    { key: "events", title: "Recent Events" }
  ];
  let index = 0;
  const render = () => {
    $$("[data-location-page]").forEach((panel) => { panel.hidden = panel.dataset.locationPage !== pages[index].key; });
    $("#location-page-label").textContent = `Legacy Location — ${index + 1}/${pages.length} · ${pages[index].title}`;
    $("#location-previous").disabled = index === 0;
    $("#location-next").disabled = index === pages.length - 1;
    logger.log("location", "instrument-page-changed", { page: pages[index].key, pageNumber: index + 1, totalPages: pages.length });
  };
  $("#location-previous").addEventListener("click", () => { index = Math.max(0, index - 1); render(); });
  $("#location-next").addEventListener("click", () => { index = Math.min(pages.length - 1, index + 1); render(); });
  render();
}
installLocationPager();
installTwoPagePager("motion", ["Orientation", "Motion"]);
installTwoPagePager("combined", ["Status", "Recent Combined Events"]);
syncLocationOptions();
renderLocationRequest(locationProbe.requestSnapshot());
renderLocationData();
renderRows($("#orientation-output"), [["Orientation", "No sample"]]);
renderRows($("#motion-output"), [["Motion", "No sample"]]);
renderCombined();

window.addEventListener("pagehide", () => {
  locationProbe.cancelRequest();
  locationProbe.stopWatch();
  motionProbe.stopBoth();
  clearInterval(combinedTimer);
  clearInterval(locationElapsedTimer);
});

function flatten(value, prefix = "", result = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, result));
  } else {
    result[prefix] = Array.isArray(value)
      ? JSON.stringify(value)
      : value === undefined
        ? "(undefined)"
        : value === null
          ? "(null)"
          : value === ""
            ? "(empty)"
            : String(value);
  }
  return result;
}

logger.log("app", "initialized", { buildInfo: BUILD_INFO, runtimeContext });
persistLifecycleCheckpoint("script-start");
refreshRecent();
updateStorageSummary();
updateLifecycleReadout();
