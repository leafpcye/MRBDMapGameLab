import { errorDetails } from "./storage.js";

export function createRateSampler({ hz = 10, now = () => performance.now() } = {}) {
  let intervalMs = 1000 / hz;
  let lastEmittedAt = -Infinity;
  let rawCount = 0;
  let emittedCount = 0;
  let startedAt = null;
  let lastRawAt = null;
  let lastObservedAt = null;
  const rawIntervals = [];
  return {
    observe(value) {
      const at = now();
      rawCount += 1;
      if (startedAt === null) startedAt = at;
      const rawIntervalMs = lastRawAt === null ? null : at - lastRawAt;
      if (rawIntervalMs !== null) rawIntervals.push(rawIntervalMs);
      lastRawAt = at;
      lastObservedAt = at;
      if (at - lastEmittedAt < intervalMs) return { emitted: false, rawCount, emittedCount, rawIntervalMs };
      lastEmittedAt = at;
      emittedCount += 1;
      return { emitted: true, value, at, rawCount, emittedCount, rawIntervalMs };
    },
    setHz(nextHz) { hz = nextHz; intervalMs = 1000 / hz; },
    stats() {
      const elapsedMs = startedAt === null ? 0 : Math.max(0, (lastObservedAt ?? startedAt) - startedAt);
      return {
        rawCount,
        emittedCount,
        droppedBySampler: rawCount - emittedCount,
        rawRateHz: elapsedMs ? Math.max(0, rawCount - 1) / (elapsedMs / 1000) : 0,
        outputRateHz: elapsedMs ? Math.max(0, emittedCount - 1) / (elapsedMs / 1000) : 0,
        averageRawIntervalMs: rawIntervals.length ? rawIntervals.reduce((sum, value) => sum + value, 0) / rawIntervals.length : null,
        minRawIntervalMs: rawIntervals.length ? Math.min(...rawIntervals) : null,
        maxRawIntervalMs: rawIntervals.length ? Math.max(...rawIntervals) : null,
        sessionDurationMs: elapsedMs,
        samplingHz: hz
      };
    },
    reset() { lastEmittedAt = -Infinity; rawCount = 0; emittedCount = 0; startedAt = null; lastRawAt = null; lastObservedAt = null; rawIntervals.length = 0; }
  };
}

export function orientationRecord(event) {
  return { alpha: event.alpha ?? null, beta: event.beta ?? null, gamma: event.gamma ?? null, absolute: event.absolute ?? null, timeStamp: event.timeStamp ?? null };
}

export function motionRecord(event) {
  const copy = (value) => value ? { x: value.x ?? null, y: value.y ?? null, z: value.z ?? null } : null;
  return {
    acceleration: copy(event.acceleration),
    accelerationIncludingGravity: copy(event.accelerationIncludingGravity),
    rotationRate: event.rotationRate ? {
      alpha: event.rotationRate.alpha ?? null,
      beta: event.rotationRate.beta ?? null,
      gamma: event.rotationRate.gamma ?? null
    } : null,
    intervalMs: event.interval ?? null,
    timeStamp: event.timeStamp ?? null
  };
}

export function createMotionProbe({
  eventTarget = globalThis,
  logger,
  runtimeContext,
  onUpdate = () => {},
  getLocation = () => null,
  hz = 10
}) {
  let orientationActive = false;
  let motionActive = false;
  let latestOrientation = null;
  let latestMotion = null;
  let orientationSessionId = null;
  let motionSessionId = null;
  const orientationSampler = createRateSampler({ hz });
  const motionSampler = createRateSampler({ hz });

  function handleOrientation(event) {
    const record = orientationRecord(event);
    const sampled = orientationSampler.observe(record);
    Object.assign(record, {
      receivedAt: new Date().toISOString(),
      callbackIntervalMs: sampled.rawIntervalMs,
      visibilityState: globalThis.document?.visibilityState ?? "unknown",
      pageInstanceId: runtimeContext.pageInstanceId,
      motionSessionId: orientationSessionId
    });
    latestOrientation = record;
    if (sampled.emitted) {
      logger.log("orientation", "sample", { ...record, samplingHz: orientationSampler.stats().samplingHz });
      onUpdate({ kind: "orientation", current: record, sampled: true, stats: orientationSampler.stats() });
    }
  }
  function handleMotion(event) {
    const record = motionRecord(event);
    const sampled = motionSampler.observe(record);
    Object.assign(record, {
      receivedAt: new Date().toISOString(),
      callbackIntervalMs: sampled.rawIntervalMs,
      visibilityState: globalThis.document?.visibilityState ?? "unknown",
      pageInstanceId: runtimeContext.pageInstanceId,
      motionSessionId
    });
    latestMotion = record;
    if (sampled.emitted) {
      logger.log("motion", "sample", { ...record, samplingHz: motionSampler.stats().samplingHz });
      onUpdate({ kind: "motion", current: record, sampled: true, stats: motionSampler.stats() });
    }
  }
  async function requestPermissionFor(type) {
    const constructor = globalThis[type];
    try {
      const result = typeof constructor?.requestPermission === "function"
        ? await constructor.requestPermission()
        : constructor ? "not-required-by-api" : "api-missing";
      logger.log("motion", "permission-result", { type, result });
      onUpdate({ kind: "permission", type, result });
      return result;
    } catch (error) {
      const details = errorDetails(error);
      logger.log("motion", "permission-error", { type, ...details });
      onUpdate({ kind: "permission", type, result: `${details.name}: ${details.message}` });
      return "error";
    }
  }
  function setActive(kind, active) {
    const isOrientation = kind === "orientation";
    const type = isOrientation ? "deviceorientation" : "devicemotion";
    const handler = isOrientation ? handleOrientation : handleMotion;
    const currentlyActive = isOrientation ? orientationActive : motionActive;
    if (active === currentlyActive) return false;
    if (active && isOrientation) orientationSessionId = `orientation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (active && !isOrientation) motionSessionId = `motion-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    eventTarget[active ? "addEventListener" : "removeEventListener"](type, handler);
    if (isOrientation) orientationActive = active;
    else motionActive = active;
    logger.log(kind, active ? "started" : "stopped", { stats: (isOrientation ? orientationSampler : motionSampler).stats() });
    onUpdate({ kind, active, stats: (isOrientation ? orientationSampler : motionSampler).stats() });
    return true;
  }

  return {
    requestPermission: async () => ({
      orientation: await requestPermissionFor("DeviceOrientationEvent"),
      motion: await requestPermissionFor("DeviceMotionEvent")
    }),
    startOrientation: () => setActive("orientation", true),
    stopOrientation: () => setActive("orientation", false),
    startMotion: () => setActive("motion", true),
    stopMotion: () => setActive("motion", false),
    startBoth() { setActive("orientation", true); setActive("motion", true); },
    stopBoth() { setActive("orientation", false); setActive("motion", false); },
    setSamplingHz(nextHz) { orientationSampler.setHz(nextHz); motionSampler.setHz(nextHz); logger.log("motion", "sampling-rate-changed", { samplingHz: nextHz }); },
    addMarker(note = "") {
      const marker = {
        note,
        wallTime: new Date().toISOString(),
        monotonicMs: performance.now(),
        runtimeContext,
        orientation: latestOrientation,
        motion: latestMotion,
        location: getLocation()
      };
      logger.log("motion", "marker", marker);
      return marker;
    },
    clear() { orientationSampler.reset(); motionSampler.reset(); latestOrientation = null; latestMotion = null; logger.log("motion", "samples-cleared", {}); },
    snapshot: () => ({
      apiPresence: { DeviceOrientationEvent: "DeviceOrientationEvent" in globalThis, DeviceMotionEvent: "DeviceMotionEvent" in globalThis },
      active: { orientation: orientationActive, motion: motionActive },
      orientation: { sessionId: orientationSessionId, current: latestOrientation, stats: orientationSampler.stats() },
      motion: { sessionId: motionSessionId, current: latestMotion, stats: motionSampler.stats() }
    }),
    isActive: () => orientationActive || motionActive
  };
}
