import { errorDetails } from "./storage.js";

export const LOCATION_PRESETS = {
  "high-accuracy": { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  balanced: { enableHighAccuracy: false, timeout: 10000, maximumAge: 5000 },
  "cached-quick": { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
};

export const GEOLOCATION_REQUEST_STATES = [
  "idle",
  "input-received",
  "request-entered",
  "request-issued",
  "waiting",
  "success",
  "error",
  "client-timeout",
  "cancelled"
];

export function formatDiagnosticValue(value) {
  if (value === undefined) return "(undefined)";
  if (value === null) return "(null)";
  if (value === "") return "(empty)";
  return String(value);
}

export function userActivationSnapshot(navigatorObject = globalThis.navigator) {
  const activation = navigatorObject?.userActivation;
  return {
    isActive: activation ? Boolean(activation.isActive) : "unavailable",
    hasBeenActive: activation ? Boolean(activation.hasBeenActive) : "unavailable"
  };
}

export async function queryGeolocationPermission(permissions = globalThis.navigator?.permissions) {
  if (!permissions?.query) {
    return { apiPresent: false, state: "unavailable", error: null };
  }
  try {
    const status = await permissions.query({ name: "geolocation" });
    return { apiPresent: true, state: status?.state || "unavailable", error: null, status };
  } catch (error) {
    return { apiPresent: true, state: "query-error", error: errorDetails(error) };
  }
}

export function createGeolocationRequestMachine({
  geolocation = globalThis.navigator?.geolocation,
  permissions = globalThis.navigator?.permissions,
  logger,
  onTransition = () => {},
  onSuccess = () => {},
  onError = () => {},
  now = () => Date.now(),
  monotonicNow = () => globalThis.performance?.now?.() ?? 0,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancelSchedule = (token) => clearTimeout(token),
  idFactory
} = {}) {
  let sequence = 0;
  let watchdog = null;
  let active = null;
  let lastTrustedEnterAt = -Infinity;

  const makeId = idFactory || (() => `geo-one-${String(++sequence).padStart(4, "0")}`);
  const log = (event, payload) => logger?.log?.("location", event, payload);

  function snapshot() {
    if (!active) {
      return {
        requestId: "—",
        state: "idle",
        elapsedMs: 0,
        lastTransition: "idle",
        triggerSource: "—",
        inputEventType: "—",
        inputEventKey: "—",
        inputEventIsTrusted: "—",
        userActivationIsActive: "unavailable",
        userActivationHasBeenActive: "unavailable",
        permissionStateBefore: "unavailable",
        permissionStateAfter: "unavailable",
        handlerEntered: false,
        callIssued: false,
        result: null
      };
    }
    return {
      ...active,
      elapsedMs: Math.max(0, now() - active.startedAtMs)
    };
  }

  function transition(state, detail = {}) {
    if (!GEOLOCATION_REQUEST_STATES.includes(state)) throw new TypeError(`Unknown geolocation request state: ${state}`);
    active = {
      ...active,
      ...detail,
      state,
      lastTransition: state,
      lastTransitionAt: new Date(now()).toISOString()
    };
    const value = snapshot();
    log("request-transition", value);
    onTransition(value);
    return value;
  }

  function finishWatchdog() {
    if (watchdog !== null) cancelSchedule(watchdog);
    watchdog = null;
  }

  function updatePermission(phase, result, requestId = active?.requestId) {
    if (!active || active.requestId !== requestId) return;
    const key = phase === "before" ? "permissionStateBefore" : "permissionStateAfter";
    const errorKey = phase === "before" ? "permissionQueryErrorBefore" : "permissionQueryErrorAfter";
    active = { ...active, [key]: result.state, [errorKey]: result.error };
    log(`permission-${phase}`, { requestId: active.requestId, state: result.state, error: result.error });
    onTransition(snapshot());
  }

  function refreshPermissionAfter() {
    const requestId = active?.requestId;
    queryGeolocationPermission(permissions).then((result) => updatePermission("after", result, requestId));
  }

  function settleSuccess(position) {
    if (!active || !["request-entered", "request-issued", "waiting"].includes(active.state)) return;
    finishWatchdog();
    const coords = position?.coords || {};
    transition("success", {
      result: {
        latitudePresent: Number.isFinite(coords.latitude),
        longitudePresent: Number.isFinite(coords.longitude),
        accuracy: coords.accuracy ?? null,
        error: null
      }
    });
    onSuccess(position, snapshot());
    refreshPermissionAfter();
  }

  function settleError(error) {
    if (!active || !["request-entered", "request-issued", "waiting"].includes(active.state)) return;
    finishWatchdog();
    const details = geolocationErrorDetails(error);
    transition("error", {
      result: {
        latitudePresent: false,
        longitudePresent: false,
        accuracy: null,
        error: details
      }
    });
    onError(error, snapshot());
    refreshPermissionAfter();
  }

  function start(input, selectedOptions, permissionStateBefore = "unavailable") {
    const startedAtMs = now();
    active = {
      requestId: makeId(),
      state: "idle",
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtMs,
      startedPerformanceMs: Number(monotonicNow().toFixed?.(2) ?? monotonicNow()),
      triggerSource: input.triggerSource || "unknown",
      inputEventType: input.inputEventType ?? null,
      inputEventKey: input.inputEventKey ?? null,
      inputEventIsTrusted: Boolean(input.inputEventIsTrusted),
      userActivationIsActive: input.userActivation?.isActive ?? "unavailable",
      userActivationHasBeenActive: input.userActivation?.hasBeenActive ?? "unavailable",
      permissionStateBefore,
      permissionStateAfter: "unavailable",
      permissionQueryErrorBefore: null,
      permissionQueryErrorAfter: null,
      selectedOptions: { ...selectedOptions },
      handlerEntered: false,
      callIssued: false,
      result: null
    };
    transition("input-received");
    transition("request-entered", { handlerEntered: true });

    try {
      if (!geolocation?.getCurrentPosition) throw Object.assign(new Error("Geolocation API missing"), { name: "MissingAPIError" });
      // Nothing asynchronous is inserted before this privileged API call.
      geolocation.getCurrentPosition(settleSuccess, settleError, selectedOptions);
      if (active?.state === "request-entered") {
        transition("request-issued", { callIssued: true });
        transition("waiting");
        watchdog = schedule(() => {
          if (active?.state !== "waiting") return;
          transition("client-timeout", {
            result: {
              latitudePresent: false,
              longitudePresent: false,
              accuracy: null,
              error: {
                name: "ClientTimeoutError",
                code: null,
                codeName: "CLIENT_TIMEOUT",
                message: "No success or error callback was received before the diagnostic watchdog expired."
              }
            }
          });
          refreshPermissionAfter();
        }, Number(selectedOptions.timeout) + 2000);
      }
    } catch (error) {
      settleError(error);
    }
    return snapshot();
  }

  function requestFromTrustedEnter(event, selectedOptions, permissionStateBefore) {
    if (event?.key !== "Enter" || event?.isTrusted !== true) return { accepted: false, reason: "not-trusted-enter", snapshot: snapshot() };
    if (active && ["request-entered", "request-issued", "waiting"].includes(active.state)) {
      log("request-input-deduplicated", {
        requestId: active.requestId,
        reason: "request-in-flight",
        inputEventType: event.type,
        inputEventKey: event.key,
        inputEventIsTrusted: true
      });
      return { accepted: false, reason: "request-in-flight", snapshot: snapshot() };
    }
    lastTrustedEnterAt = now();
    return { accepted: true, snapshot: start({
      triggerSource: "keyboard",
      inputEventType: event.type,
      inputEventKey: event.key,
      inputEventIsTrusted: event.isTrusted,
      userActivation: event.userActivation || userActivationSnapshot()
    }, selectedOptions, permissionStateBefore) };
  }

  function requestFromClick(event, selectedOptions, permissionStateBefore) {
    const generatedAfterEnter = now() - lastTrustedEnterAt <= 750;
    const inFlight = active && ["request-entered", "request-issued", "waiting"].includes(active.state);
    if (generatedAfterEnter || inFlight) {
      const reason = generatedAfterEnter ? "trusted-enter-token" : "request-in-flight";
      log("request-input-deduplicated", {
        requestId: active?.requestId || null,
        reason,
        inputEventType: event?.type || "click",
        inputEventIsTrusted: Boolean(event?.isTrusted)
      });
      return { accepted: false, reason, snapshot: snapshot() };
    }
    return { accepted: true, snapshot: start({
      triggerSource: "click",
      inputEventType: event?.type || "click",
      inputEventKey: event?.key ?? null,
      inputEventIsTrusted: Boolean(event?.isTrusted),
      userActivation: event?.userActivation || userActivationSnapshot()
    }, selectedOptions, permissionStateBefore) };
  }

  return {
    requestFromTrustedEnter,
    requestFromClick,
    snapshot,
    cancel() {
      if (!active || !["request-entered", "request-issued", "waiting"].includes(active.state)) return false;
      finishWatchdog();
      transition("cancelled");
      return true;
    },
    isInFlight: () => Boolean(active && ["request-entered", "request-issued", "waiting"].includes(active.state))
  };
}

export const DEFAULT_LOCATION_THRESHOLDS = {
  poorAccuracyM: 50,
  suspiciousJumpDistanceM: 100,
  suspiciousDerivedSpeedMps: 15,
  duplicateToleranceM: 0.5,
  longCallbackGapMs: 10000
};

export function locationPresetOptions(name) {
  if (!Object.hasOwn(LOCATION_PRESETS, name)) throw new TypeError(`Unknown location preset: ${name}`);
  return { ...LOCATION_PRESETS[name] };
}

export function createFinitePager(pageKeys, initialIndex = 0) {
  let index = Math.max(0, Math.min(pageKeys.length - 1, initialIndex));
  const snapshot = () => ({
    index,
    page: pageKeys[index],
    pageNumber: index + 1,
    pageCount: pageKeys.length,
    canPrevious: index > 0,
    canNext: index < pageKeys.length - 1
  });
  return {
    snapshot,
    previous() { index = Math.max(0, index - 1); return snapshot(); },
    next() { index = Math.min(pageKeys.length - 1, index + 1); return snapshot(); }
  };
}

export function boundedDiagnosticEvents(entries, entry, limit = 5) {
  return [...entries, entry].slice(-Math.max(1, limit));
}

export function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLat = radians(b.latitude - a.latitude);
  const normalizedLongitude = ((b.longitude - a.longitude + 540) % 360) - 180;
  const deltaLon = radians(normalizedLongitude);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function geolocationErrorDetails(error) {
  const codes = { 1: "PERMISSION_DENIED", 2: "POSITION_UNAVAILABLE", 3: "TIMEOUT" };
  return { code: error?.code ?? null, codeName: codes[error?.code] || "UNKNOWN", ...errorDetails(error) };
}

export function createLocationAccumulator({
  thresholds = DEFAULT_LOCATION_THRESHOLDS,
  now = () => Date.now(),
  monotonicNow = () => performance.now()
} = {}) {
  let records = [];
  let cumulativeDistanceM = 0;
  let flaggedDistanceM = 0;
  let errorCount = 0;

  function add(position, context = {}) {
    const receivedAtMs = now();
    const coords = position.coords || {};
    const previous = records.at(-1);
    const raw = {
      latitude: coords.latitude ?? null,
      longitude: coords.longitude ?? null,
      accuracy: coords.accuracy ?? null,
      altitude: coords.altitude ?? null,
      altitudeAccuracy: coords.altitudeAccuracy ?? null,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
      timestamp: position.timestamp ?? null
    };
    const intervalMs = previous ? receivedAtMs - previous.receivedAtMs : null;
    const distanceM = previous ? haversineMeters(previous.raw, raw) : 0;
    const derivedSpeedMps = intervalMs > 0 ? distanceM / (intervalMs / 1000) : null;
    const ageMs = raw.timestamp === null ? null : Math.max(0, receivedAtMs - raw.timestamp);
    const flags = [];
    if (raw.accuracy !== null && raw.accuracy > thresholds.poorAccuracyM) flags.push("poor-accuracy");
    if (previous && distanceM <= thresholds.duplicateToleranceM) flags.push("duplicate");
    if (distanceM > thresholds.suspiciousJumpDistanceM) flags.push("large-jump");
    if (derivedSpeedMps !== null && derivedSpeedMps > thresholds.suspiciousDerivedSpeedMps) flags.push("high-derived-speed");
    if (intervalMs !== null && intervalMs > thresholds.longCallbackGapMs) flags.push("long-gap");
    if (previous?.raw.timestamp != null && raw.timestamp != null && raw.timestamp < previous.raw.timestamp) flags.push("timestamp-regression");
    if (raw.heading === null) flags.push("missing-heading");
    if (raw.speed === null) flags.push("missing-speed");
    cumulativeDistanceM += distanceM;
    if (flags.length) flaggedDistanceM += distanceM;
    const record = {
      raw,
      receivedAt: new Date(receivedAtMs).toISOString(),
      receivedAtMs,
      monotonicMs: Number(monotonicNow().toFixed(2)),
      intervalMs,
      distanceM,
      cumulativeDistanceM,
      flaggedDistanceM,
      derivedSpeedMps,
      ageMs,
      flags,
      visibilityState: globalThis.document?.visibilityState ?? "unknown",
      online: globalThis.navigator?.onLine ?? null,
      ...context
    };
    records.push(record);
    return record;
  }

  function summary() {
    const accuracies = records.map((item) => item.raw.accuracy).filter(Number.isFinite);
    const intervals = records.map((item) => item.intervalMs).filter(Number.isFinite);
    const started = records[0]?.receivedAtMs;
    const ended = records.at(-1)?.receivedAtMs;
    return {
      sampleCount: records.length,
      durationMs: started === undefined ? 0 : ended - started,
      averageIntervalMs: intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null,
      minimumIntervalMs: intervals.length ? Math.min(...intervals) : null,
      maximumIntervalMs: intervals.length ? Math.max(...intervals) : null,
      latestAccuracyM: records.at(-1)?.raw.accuracy ?? null,
      bestAccuracyM: accuracies.length ? Math.min(...accuracies) : null,
      worstAccuracyM: accuracies.length ? Math.max(...accuracies) : null,
      averageAccuracyM: accuracies.length ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length : null,
      cumulativeDistanceM,
      flaggedDistanceM,
      flaggedSampleCount: records.filter((item) => item.flags.length).length,
      latestReportedSpeedMps: records.at(-1)?.raw.speed ?? null,
      latestReportedHeadingDegrees: records.at(-1)?.raw.heading ?? null,
      lastCallbackAgeMs: ended === undefined ? null : Math.max(0, now() - ended),
      errorCount
    };
  }

  return {
    add,
    summary,
    getRecords: () => JSON.parse(JSON.stringify(records)),
    recordError() { errorCount += 1; },
    clear() { records = []; cumulativeDistanceM = 0; flaggedDistanceM = 0; errorCount = 0; }
  };
}

export function createLocationProbe({
  geolocation = globalThis.navigator?.geolocation,
  permissions = globalThis.navigator?.permissions,
  logger,
  runtimeContext,
  onUpdate = () => {},
  onRequestTransition = () => {},
  thresholds = DEFAULT_LOCATION_THRESHOLDS,
  requestMachineOptions = {}
}) {
  const accumulator = createLocationAccumulator({ thresholds });
  let watchId = null;
  let watchSessionId = null;
  let options = { ...LOCATION_PRESETS["high-accuracy"] };

  const context = () => ({
    watchSessionId,
    pageInstanceId: runtimeContext.pageInstanceId,
    sessionId: runtimeContext.sessionId,
    documentBootCount: runtimeContext.documentBootCount
  });
  const success = (position) => {
    const record = accumulator.add(position, context());
    logger.log("location", "position", record);
    onUpdate({ status: "position-received", record, summary: accumulator.summary(), active: watchId !== null });
  };
  const failure = (error) => {
    accumulator.recordError();
    const details = geolocationErrorDetails(error);
    logger.log("location", "error", {
      ...details,
      receivedAt: new Date().toISOString(),
      visibilityState: globalThis.document?.visibilityState ?? "unknown",
      online: globalThis.navigator?.onLine ?? null,
      ...context()
    });
    onUpdate({ status: `${details.codeName}: ${details.message}`, error: details, active: watchId !== null });
  };
  const requireApi = () => {
    if (!geolocation) throw Object.assign(new Error("Geolocation API missing"), { name: "MissingAPIError" });
  };
  const requestMachine = createGeolocationRequestMachine({
    geolocation,
    permissions,
    logger,
    onTransition: onRequestTransition,
    onSuccess: success,
    onError: failure,
    ...requestMachineOptions
  });

  return {
    setOptions(next) { options = { ...next }; return options; },
    getOne() {
      return requestMachine.requestFromClick({ type: "click", isTrusted: false }, options, "unavailable");
    },
    requestOneFromTrustedEnter(event, permissionStateBefore = "unavailable") {
      return requestMachine.requestFromTrustedEnter(event, options, permissionStateBefore);
    },
    requestOneFromClick(event, permissionStateBefore = "unavailable") {
      return requestMachine.requestFromClick(event, options, permissionStateBefore);
    },
    requestSnapshot: () => requestMachine.snapshot(),
    cancelRequest: () => requestMachine.cancel(),
    refreshPermission: () => queryGeolocationPermission(permissions),
    startWatch() {
      if (watchId !== null) return false;
      try {
        requireApi();
        watchSessionId = `watch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        watchId = geolocation.watchPosition(success, failure, options);
        logger.log("location", "watch-started", { watchId, watchSessionId, options });
        onUpdate({ status: "watch-active", active: true });
        return true;
      } catch (error) { failure(error); return false; }
    },
    stopWatch() {
      if (watchId === null) return false;
      geolocation.clearWatch(watchId);
      logger.log("location", "watch-stopped", { watchId, watchSessionId, summary: accumulator.summary() });
      watchId = null;
      onUpdate({ status: "watch-stopped", active: false, summary: accumulator.summary() });
      return true;
    },
    clear() { accumulator.clear(); logger.log("location", "samples-cleared", {}); onUpdate({ status: "cleared", record: null, summary: accumulator.summary() }); },
    addMarker(note = "") {
      const marker = { note, at: new Date().toISOString(), monotonicMs: performance.now(), ...context(), latestPosition: accumulator.getRecords().at(-1) || null };
      logger.log("location", "marker", marker);
      return marker;
    },
    snapshot: () => ({
      apiPresent: Boolean(geolocation),
      active: watchId !== null,
      watchStatus: watchId !== null ? "active" : "stopped",
      watchSessionId,
      options,
      thresholds,
      summary: { watchStatus: watchId !== null ? "active" : "stopped", watchSessionId, ...accumulator.summary() },
      records: accumulator.getRecords()
    }),
    isActive: () => watchId !== null
  };
}
