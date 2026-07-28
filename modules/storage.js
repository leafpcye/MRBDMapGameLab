export function createStorageHelper(storage, prefix = "mrbdProbe.") {
  function key(name) {
    return name.startsWith(prefix) ? name : `${prefix}${name}`;
  }
  return {
    set(name, value) {
      storage.setItem(key(name), String(value));
      return String(value);
    },
    get(name) {
      return storage.getItem(key(name));
    },
    remove(name) {
      storage.removeItem(key(name));
    },
    setJSON(name, value) {
      const serialized = JSON.stringify(value);
      storage.setItem(key(name), serialized);
      return value;
    },
    getJSON(name, fallback = null) {
      const raw = storage.getItem(key(name));
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (error) {
        const wrapped = new Error(`Invalid JSON in ${key(name)}: ${error.message}`);
        wrapped.name = "StorageParseError";
        wrapped.cause = error;
        throw wrapped;
      }
    },
    recordLaunch(at = new Date().toISOString()) {
      const rawCount = storage.getItem(key("launchCount"));
      const parsed = Number.parseInt(rawCount ?? "0", 10);
      const launchCount = Number.isFinite(parsed) && parsed >= 0 ? parsed + 1 : 1;
      const firstLaunchAt = storage.getItem(key("firstLaunchAt")) || at;
      storage.setItem(key("launchCount"), String(launchCount));
      storage.setItem(key("firstLaunchAt"), firstLaunchAt);
      storage.setItem(key("lastLaunchAt"), at);
      return { launchCount, firstLaunchAt, lastLaunchAt: at };
    }
  };
}

export function errorDetails(error) {
  return { name: error?.name || "Error", message: error?.message || String(error) };
}
