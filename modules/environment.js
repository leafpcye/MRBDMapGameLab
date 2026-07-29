function present(value) {
  return value ? "Present but not tested" : "Missing";
}

export function collectEnvironment() {
  const navigation = globalThis.performance?.getEntriesByType?.("navigation")?.[0];
  const apiPresence = {
    localStorage: present(hasProperty(globalThis, "localStorage")),
    sessionStorage: present(hasProperty(globalThis, "sessionStorage")),
    indexedDB: present("indexedDB" in globalThis),
    caches: present("caches" in globalThis),
    "navigator.serviceWorker": present("serviceWorker" in navigator),
    "navigator.geolocation": present("geolocation" in navigator),
    DeviceMotionEvent: present("DeviceMotionEvent" in globalThis),
    DeviceOrientationEvent: present("DeviceOrientationEvent" in globalThis),
    "navigator.mediaDevices": present("mediaDevices" in navigator),
    MediaRecorder: present("MediaRecorder" in globalThis),
    AudioContext: present("AudioContext" in globalThis || "webkitAudioContext" in globalThis),
    speechSynthesis: present("speechSynthesis" in globalThis),
    SpeechRecognition: present("SpeechRecognition" in globalThis),
    webkitSpeechRecognition: present("webkitSpeechRecognition" in globalThis),
    "navigator.share": present(typeof navigator.share === "function"),
    "navigator.clipboard": present(Boolean(navigator.clipboard)),
    "window.Blob": present("Blob" in globalThis),
    "URL.createObjectURL": present(typeof URL.createObjectURL === "function"),
    BroadcastChannel: present("BroadcastChannel" in globalThis),
    WebSocket: present("WebSocket" in globalThis),
    fetch: present("fetch" in globalThis)
  };
  return {
    capturedAt: new Date().toISOString(),
    runtime: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.from(navigator.languages || []),
      onLine: navigator.onLine,
      isSecureContext: globalThis.isSecureContext,
      href: location.href,
      origin: location.origin,
      referrer: document.referrer,
      visibilityState: document.visibilityState,
      screen: { width: screen.width, height: screen.height },
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      localTime: new Date().toString(),
      navigationType: navigation?.type ?? "unavailable"
    },
    apiPresence
  };
}

function hasProperty(object, property) {
  try {
    void object[property];
    return property in object;
  } catch {
    return true;
  }
}

export function environmentRows(snapshot) {
  const runtime = snapshot.runtime;
  return [
    ["Captured", snapshot.capturedAt],
    ["User agent", runtime.userAgent],
    ["Platform", runtime.platform],
    ["Language(s)", [runtime.language, ...runtime.languages].filter(Boolean).join(", ")],
    ["navigator.onLine", String(runtime.onLine)],
    ["Secure context", String(runtime.isSecureContext)],
    ["URL", runtime.href],
    ["Origin", runtime.origin],
    ["Referrer", runtime.referrer || "(empty)"],
    ["Visibility", runtime.visibilityState],
    ["Screen", `${runtime.screen.width} × ${runtime.screen.height}`],
    ["Viewport", `${runtime.viewport.width} × ${runtime.viewport.height}`],
    ["Device pixel ratio", String(runtime.devicePixelRatio)],
    ["Time zone", runtime.timeZone],
    ["Local time", runtime.localTime],
    ["Navigation type", runtime.navigationType],
    ...Object.entries(snapshot.apiPresence)
  ];
}

export function environmentPages(snapshot, pageSize = 7) {
  const { runtime, apiPresence } = snapshot;
  const summary = [
    ["User Agent", shortenUserAgent(runtime.userAgent)],
    ["Platform", runtime.platform],
    ["Secure context", String(runtime.isSecureContext)],
    ["Viewport", `${runtime.viewport.width} × ${runtime.viewport.height}`],
    ["Device pixel ratio", String(runtime.devicePixelRatio)],
    ["Online signal", String(runtime.onLine)],
    ["Service Worker", apiPresence["navigator.serviceWorker"]],
    ["localStorage", apiPresence.localStorage],
    ["IndexedDB", apiPresence.indexedDB],
    ["Geolocation", apiPresence["navigator.geolocation"]],
    ["DeviceOrientation", apiPresence.DeviceOrientationEvent],
    ["mediaDevices", apiPresence["navigator.mediaDevices"]]
  ];
  const runtimeDetails = environmentRows(snapshot).slice(0, 16);
  return [
    ...chunkRows(summary, 6, "Summary"),
    ...chunkRows(Object.entries(apiPresence), pageSize, "API Matrix"),
    ...chunkRows(runtimeDetails, pageSize, "Runtime Details")
  ];
}

function chunkRows(rows, size, title) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push({
      title: `${title} ${Math.floor(index / size) + 1}/${Math.ceil(rows.length / size)}`,
      rows: rows.slice(index, index + size)
    });
  }
  return chunks;
}

function shortenUserAgent(userAgent) {
  if (userAgent.length <= 90) return userAgent;
  return `${userAgent.slice(0, 87)}…`;
}
