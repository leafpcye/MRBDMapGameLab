import { errorDetails } from "./storage.js";

export const PERMISSION_BOOTSTRAP_GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 3000,
  maximumAge: 60000
});

const SENSOR_TYPES = [
  ["orientation", "DeviceOrientationEvent"],
  ["motion", "DeviceMotionEvent"]
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function geolocationError(error = {}) {
  const codeNames = {
    1: "PERMISSION_DENIED",
    2: "POSITION_UNAVAILABLE",
    3: "TIMEOUT"
  };
  return {
    code: Number.isFinite(error.code) ? error.code : null,
    codeName: codeNames[error.code] || "UNKNOWN",
    name: error.name || "GeolocationPositionError",
    message: error.message || ""
  };
}

function userActivationSnapshot(globalObject, event) {
  const activation = event?.userActivation || globalObject.navigator?.userActivation;
  return {
    isActive: activation?.isActive ?? "unavailable",
    hasBeenActive: activation?.hasBeenActive ?? "unavailable"
  };
}

function createLocationState() {
  return {
    state: "not-called",
    input: null,
    issuedAt: null,
    callbackAt: null,
    firstCallbackElapsedMs: null,
    result: null,
    error: null,
    options: { ...PERMISSION_BOOTSTRAP_GEOLOCATION_OPTIONS }
  };
}

export function createPermissionBootstrap({
  globalObject = globalThis,
  geolocation = globalObject.navigator?.geolocation,
  logger,
  onUpdate = () => {},
  wallTime = () => new Date().toISOString(),
  monotonicNow = () => globalObject.performance?.now?.() ?? Date.now()
} = {}) {
  let started = false;
  let startedAtMs = null;
  let postMenuStarted = false;
  let postMenuStartedAtMs = null;
  const state = {
    state: "not-started",
    started: false,
    input: null,
    environment: null,
    sensors: {
      orientation: "not-called",
      motion: "not-called"
    },
    location: {
      apiPresent: Boolean(geolocation?.getCurrentPosition),
      ...createLocationState()
    },
    postMenuLocation: {
      started: false,
      apiPresent: Boolean(geolocation?.getCurrentPosition),
      ...createLocationState()
    }
  };

  function emit(event, payload = {}) {
    logger?.log?.("permissions-bootstrap", event, payload);
    onUpdate(snapshot());
  }

  function snapshot() {
    return clone(state);
  }

  function recordSensorStatus(key, value, event, payload = {}) {
    state.sensors[key] = value;
    emit(event, { sensor: key, result: value, ...payload });
  }

  async function requestSensor(key, constructorName) {
    const constructor = globalObject[constructorName];
    if (!constructor) {
      recordSensorStatus(key, "api-missing", "sensor-permission-result", { constructorName });
      return;
    }
    if (typeof constructor.requestPermission !== "function") {
      recordSensorStatus(key, "requestPermission-missing", "sensor-permission-result", { constructorName });
      return;
    }
    const requestedAt = wallTime();
    emit("sensor-permission-issued", { sensor: key, constructorName, requestedAt });
    try {
      const result = await constructor.requestPermission();
      const normalized = result === "granted" || result === "denied" ? result : String(result);
      recordSensorStatus(key, normalized, "sensor-permission-result", {
        constructorName,
        requestedAt,
        completedAt: wallTime()
      });
    } catch (error) {
      const details = errorDetails(error);
      recordSensorStatus(key, "error", "sensor-permission-error", {
        constructorName,
        requestedAt,
        completedAt: wallTime(),
        error: details
      });
    }
  }

  function issueGeolocation({
    target,
    eventPrefix = "geolocation",
    requestStartedAtMs,
    controlsBootstrapState = false
  }) {
    if (!geolocation?.getCurrentPosition) {
      if (controlsBootstrapState) state.state = "complete";
      target.state = "api-missing";
      emit(`${eventPrefix}-error`, { state: "api-missing" });
      return;
    }

    if (controlsBootstrapState) state.state = "waiting";
    target.state = "issued";
    target.issuedAt = wallTime();
    emit(`${eventPrefix}-issued`, { options: target.options });

    const success = (position) => {
      const coords = position?.coords || {};
      if (controlsBootstrapState) state.state = "complete";
      target.state = "success";
      target.callbackAt = wallTime();
      target.firstCallbackElapsedMs = Math.max(0, monotonicNow() - requestStartedAtMs);
      target.result = {
        latitudePresent: Number.isFinite(coords.latitude),
        longitudePresent: Number.isFinite(coords.longitude),
        accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null
      };
      emit(`${eventPrefix}-success`, {
        firstCallbackElapsedMs: target.firstCallbackElapsedMs,
        result: target.result
      });
    };

    const failure = (error) => {
      if (controlsBootstrapState) state.state = "complete";
      target.state = "error";
      target.callbackAt = wallTime();
      target.firstCallbackElapsedMs = Math.max(0, monotonicNow() - requestStartedAtMs);
      target.error = geolocationError(error);
      emit(`${eventPrefix}-error`, {
        firstCallbackElapsedMs: target.firstCallbackElapsedMs,
        error: target.error
      });
    };

    try {
      geolocation.getCurrentPosition(
        success,
        failure,
        PERMISSION_BOOTSTRAP_GEOLOCATION_OPTIONS
      );
    } catch (error) {
      const details = errorDetails(error);
      if (controlsBootstrapState) state.state = "complete";
      target.state = "synchronous-error";
      target.error = details;
      target.callbackAt = wallTime();
      target.firstCallbackElapsedMs = Math.max(0, monotonicNow() - requestStartedAtMs);
      emit(`${eventPrefix}-synchronous-error`, {
        firstCallbackElapsedMs: target.firstCallbackElapsedMs,
        error: details
      });
    }
  }

  async function runSequence() {
    for (const [key, constructorName] of SENSOR_TYPES) {
      const constructor = globalObject[constructorName];
      if (typeof constructor?.requestPermission === "function") {
        await requestSensor(key, constructorName);
      } else if (!constructor) {
        recordSensorStatus(key, "api-missing", "sensor-permission-result", { constructorName });
      } else {
        recordSensorStatus(key, "requestPermission-missing", "sensor-permission-result", { constructorName });
      }
    }
    // When neither sensor exposes requestPermission, runSequence reaches this
    // call without yielding, so Location remains in the trusted activation
    // stack, matching the public DamammApps bootstrap.
    issueGeolocation({
      target: state.location,
      requestStartedAtMs: startedAtMs,
      controlsBootstrapState: true
    });
  }

  function startFromEvent(event = {}) {
    if (started) {
      emit("duplicate-start-blocked", {
        inputType: event.type || "unknown",
        key: event.key || null,
        trusted: Boolean(event.isTrusted)
      });
      return { accepted: false, reason: "already-started", completion: Promise.resolve(snapshot()) };
    }
    if (event.isTrusted !== true) {
      emit("start-rejected", {
        reason: "untrusted-event",
        inputType: event.type || "unknown",
        key: event.key || null
      });
      return { accepted: false, reason: "untrusted-event", completion: Promise.resolve(snapshot()) };
    }

    started = true;
    startedAtMs = monotonicNow();
    state.started = true;
    state.state = "requesting-sensors";
    state.input = {
      type: event.type || "unknown",
      key: event.key || null,
      trusted: true,
      userActivation: userActivationSnapshot(globalObject, event)
    };
    state.environment = {
      href: globalObject.location?.href || "unknown",
      secureContext: globalObject.isSecureContext ?? "unavailable",
      mrbdWebAppCapable: Boolean(
        globalObject.document?.querySelector?.('meta[name="mrbd-web-app-capable"][content="yes"]')
      ),
      serviceWorkerController: Boolean(globalObject.navigator?.serviceWorker?.controller),
      apiPresence: {
        geolocation: Boolean(geolocation?.getCurrentPosition),
        DeviceOrientationEvent: Boolean(globalObject.DeviceOrientationEvent),
        DeviceMotionEvent: Boolean(globalObject.DeviceMotionEvent)
      }
    };
    emit("start-entered", {
      input: state.input,
      environment: state.environment
    });

    const completion = runSequence().then(() => snapshot());
    return { accepted: true, reason: null, completion };
  }

  function verifyLocationFromEvent(event = {}) {
    if (!started) {
      emit("post-menu-verification-blocked", {
        reason: "bootstrap-not-started",
        inputType: event.type || "unknown"
      });
      return { accepted: false, reason: "bootstrap-not-started", snapshot: snapshot() };
    }
    if (state.state !== "complete") {
      emit("post-menu-verification-blocked", {
        reason: "bootstrap-not-complete",
        bootstrapState: state.state,
        inputType: event.type || "unknown"
      });
      return { accepted: false, reason: "bootstrap-not-complete", snapshot: snapshot() };
    }
    if (postMenuStarted) {
      emit("post-menu-duplicate-start-blocked", {
        inputType: event.type || "unknown",
        key: event.key || null,
        trusted: Boolean(event.isTrusted)
      });
      return { accepted: false, reason: "already-started", snapshot: snapshot() };
    }
    if (event.isTrusted !== true) {
      emit("post-menu-start-rejected", {
        reason: "untrusted-event",
        inputType: event.type || "unknown",
        key: event.key || null
      });
      return { accepted: false, reason: "untrusted-event", snapshot: snapshot() };
    }

    postMenuStarted = true;
    postMenuStartedAtMs = monotonicNow();
    state.postMenuLocation.started = true;
    state.postMenuLocation.input = {
      type: event.type || "unknown",
      key: event.key || null,
      trusted: true,
      userActivation: userActivationSnapshot(globalObject, event)
    };
    emit("post-menu-verification-start-entered", {
      input: state.postMenuLocation.input,
      initialLocationState: state.location.state,
      options: state.postMenuLocation.options
    });
    issueGeolocation({
      target: state.postMenuLocation,
      eventPrefix: "post-menu-geolocation",
      requestStartedAtMs: postMenuStartedAtMs
    });
    return { accepted: true, reason: null, snapshot: snapshot() };
  }

  return {
    startFromEvent,
    verifyLocationFromEvent,
    snapshot,
    isStarted: () => started,
    isPostMenuVerificationStarted: () => postMenuStarted
  };
}
