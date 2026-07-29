export function createActivationTracker({
  now = () => Date.now(),
  dedupeMs = 350,
  onActivation = () => {}
} = {}) {
  const counts = new Map();
  const lastKeyboard = new Map();

  function activate(name, source = "unknown") {
    const at = now();
    if (source !== "keyboard" && at - (lastKeyboard.get(name) ?? -Infinity) <= dedupeMs) {
      return { activated: false, duplicateOf: "keyboard", name, source };
    }
    if (source === "keyboard") lastKeyboard.set(name, at);
    const result = {
      activated: true,
      name,
      source,
      count: (counts.get(name) ?? 0) + 1,
      at,
      localTime: new Date(at).toLocaleTimeString()
    };
    counts.set(name, result.count);
    onActivation(result);
    return result;
  }

  return { activate, getCount: (name) => counts.get(name) ?? 0 };
}

export function flashActivation({
  setActive,
  schedule = (callback, delay) => setTimeout(callback, delay),
  durationMs = 750
}) {
  setActive(true);
  schedule(() => setActive(false), durationMs);
  return { active: true, durationMs };
}
