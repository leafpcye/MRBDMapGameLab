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
    }
  };
}

export function errorDetails(error) {
  return { name: error?.name || "Error", message: error?.message || String(error) };
}

export function formatBootTimestamp(value, {
  localeFormatter = (date) => date.toLocaleString(),
  timeZoneResolver = () => Intl.DateTimeFormat().resolvedOptions().timeZone
} = {}) {
  if (!value) {
    return { local: "(first recorded document boot)", utc: "(none)", timeZone: timeZoneResolver() };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { local: "(invalid timestamp)", utc: String(value), timeZone: timeZoneResolver() };
  }
  return {
    local: localeFormatter(date),
    utc: date.toISOString(),
    timeZone: timeZoneResolver()
  };
}
