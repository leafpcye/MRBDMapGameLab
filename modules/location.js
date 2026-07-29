import { errorDetails } from "./storage.js";

export const LOCATION_PRESETS = {
  "high-accuracy": { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  balanced: { enableHighAccuracy: false, timeout: 15000, maximumAge: 5000 },
  "cached-quick": { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
};

export const DEFAULT_LOCATION_THRESHOLDS = {
  poorAccuracyM: 50,
  suspiciousJumpDistanceM: 100,
  suspiciousDerivedSpeedMps: 15,
  duplicateToleranceM: 0.5,
  longCallbackGapMs: 10000
};

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
  logger,
  runtimeContext,
  onUpdate = () => {},
  thresholds = DEFAULT_LOCATION_THRESHOLDS
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

  return {
    setOptions(next) { options = { ...next }; return options; },
    getOne() {
      try { requireApi(); geolocation.getCurrentPosition(success, failure, options); logger.log("location", "get-one-requested", { options }); }
      catch (error) { failure(error); }
    },
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
